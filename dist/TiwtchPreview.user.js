// ==UserScript==
// @name        TiwtchPreview
// @namespace   Violentmonkey Scripts
// @description Show mini preview of Twitch Stream.
// @match       *://*.twitch.tv/*
// @version     0.0.1
// @license     MIT
// @icon        https://external-content.duckduckgo.com/ip3/www.twitch.tv.ico
// @author      Pipos_
// @require     https://cdn.jsdelivr.net/npm/@violentmonkey/dom@2
// @require     https://cdn.jsdelivr.net/npm/@violentmonkey/ui@0.7
// @downloadURL https://raw.githubusercontent.com/P1P0S/TwitchPreview/master/dist/TiwtchPreview.user.js
// @updateURL   https://raw.githubusercontent.com/P1P0S/TwitchPreview/master/dist/TiwtchPreview.user.js
// @homepageURL https://github.com/P1P0S/TwitchPreview
// @supportURL  https://github.com/P1P0S/TwitchPreview/issues
// @grant       GM_addStyle
// @grant       GM_getValue
// @grant       GM_setValue
// ==/UserScript==

(function () {
'use strict';

const IS_DEV = false;
const equalFn = (a, b) => a === b;
const $TRACK = Symbol("solid-track");
const signalOptions = {
  equals: equalFn
};
let runEffects = runQueue;
const STALE = 1;
const PENDING = 2;
const UNOWNED = {
  owned: null,
  cleanups: null,
  context: null,
  owner: null
};
var Owner = null;
let Transition = null;
let ExternalSourceConfig = null;
let Listener = null;
let Updates = null;
let Effects = null;
let ExecCount = 0;
function createRoot(fn, detachedOwner) {
  const listener = Listener,
    owner = Owner,
    unowned = fn.length === 0,
    current = detachedOwner === undefined ? owner : detachedOwner,
    root = unowned ? UNOWNED : {
      owned: null,
      cleanups: null,
      context: current ? current.context : null,
      owner: current
    },
    updateFn = unowned ? fn : () => fn(() => untrack(() => cleanNode(root)));
  Owner = root;
  Listener = null;
  try {
    return runUpdates(updateFn, true);
  } finally {
    Listener = listener;
    Owner = owner;
  }
}
function createSignal(value, options) {
  options = options ? Object.assign({}, signalOptions, options) : signalOptions;
  const s = {
    value,
    observers: null,
    observerSlots: null,
    comparator: options.equals || undefined
  };
  const setter = value => {
    if (typeof value === "function") {
      value = value(s.value);
    }
    return writeSignal(s, value);
  };
  return [readSignal.bind(s), setter];
}
function createRenderEffect(fn, value, options) {
  const c = createComputation(fn, value, false, STALE);
  updateComputation(c);
}
function createMemo(fn, value, options) {
  options = options ? Object.assign({}, signalOptions, options) : signalOptions;
  const c = createComputation(fn, value, true, 0);
  c.observers = null;
  c.observerSlots = null;
  c.comparator = options.equals || undefined;
  updateComputation(c);
  return readSignal.bind(c);
}
function untrack(fn) {
  if (Listener === null) return fn();
  const listener = Listener;
  Listener = null;
  try {
    if (ExternalSourceConfig) ;
    return fn();
  } finally {
    Listener = listener;
  }
}
function onCleanup(fn) {
  if (Owner === null) ;else if (Owner.cleanups === null) Owner.cleanups = [fn];else Owner.cleanups.push(fn);
  return fn;
}
function readSignal() {
  if (this.sources && (this.state)) {
    if ((this.state) === STALE) updateComputation(this);else {
      const updates = Updates;
      Updates = null;
      runUpdates(() => lookUpstream(this), false);
      Updates = updates;
    }
  }
  if (Listener) {
    const sSlot = this.observers ? this.observers.length : 0;
    if (!Listener.sources) {
      Listener.sources = [this];
      Listener.sourceSlots = [sSlot];
    } else {
      Listener.sources.push(this);
      Listener.sourceSlots.push(sSlot);
    }
    if (!this.observers) {
      this.observers = [Listener];
      this.observerSlots = [Listener.sources.length - 1];
    } else {
      this.observers.push(Listener);
      this.observerSlots.push(Listener.sources.length - 1);
    }
  }
  return this.value;
}
function writeSignal(node, value, isComp) {
  let current = node.value;
  if (!node.comparator || !node.comparator(current, value)) {
    node.value = value;
    if (node.observers && node.observers.length) {
      runUpdates(() => {
        for (let i = 0; i < node.observers.length; i += 1) {
          const o = node.observers[i];
          const TransitionRunning = Transition && Transition.running;
          if (TransitionRunning && Transition.disposed.has(o)) ;
          if (TransitionRunning ? !o.tState : !o.state) {
            if (o.pure) Updates.push(o);else Effects.push(o);
            if (o.observers) markDownstream(o);
          }
          if (!TransitionRunning) o.state = STALE;
        }
        if (Updates.length > 10e5) {
          Updates = [];
          if (IS_DEV) ;
          throw new Error();
        }
      }, false);
    }
  }
  return value;
}
function updateComputation(node) {
  if (!node.fn) return;
  cleanNode(node);
  const time = ExecCount;
  runComputation(node, node.value, time);
}
function runComputation(node, value, time) {
  let nextValue;
  const owner = Owner,
    listener = Listener;
  Listener = Owner = node;
  try {
    nextValue = node.fn(value);
  } catch (err) {
    if (node.pure) {
      {
        node.state = STALE;
        node.owned && node.owned.forEach(cleanNode);
        node.owned = null;
      }
    }
    node.updatedAt = time + 1;
    return handleError(err);
  } finally {
    Listener = listener;
    Owner = owner;
  }
  if (!node.updatedAt || node.updatedAt <= time) {
    if (node.updatedAt != null && "observers" in node) {
      writeSignal(node, nextValue);
    } else node.value = nextValue;
    node.updatedAt = time;
  }
}
function createComputation(fn, init, pure, state = STALE, options) {
  const c = {
    fn,
    state: state,
    updatedAt: null,
    owned: null,
    sources: null,
    sourceSlots: null,
    cleanups: null,
    value: init,
    owner: Owner,
    context: Owner ? Owner.context : null,
    pure
  };
  if (Owner === null) ;else if (Owner !== UNOWNED) {
    {
      if (!Owner.owned) Owner.owned = [c];else Owner.owned.push(c);
    }
  }
  return c;
}
function runTop(node) {
  if ((node.state) === 0) return;
  if ((node.state) === PENDING) return lookUpstream(node);
  if (node.suspense && untrack(node.suspense.inFallback)) return node.suspense.effects.push(node);
  const ancestors = [node];
  while ((node = node.owner) && (!node.updatedAt || node.updatedAt < ExecCount)) {
    if (node.state) ancestors.push(node);
  }
  for (let i = ancestors.length - 1; i >= 0; i--) {
    node = ancestors[i];
    if ((node.state) === STALE) {
      updateComputation(node);
    } else if ((node.state) === PENDING) {
      const updates = Updates;
      Updates = null;
      runUpdates(() => lookUpstream(node, ancestors[0]), false);
      Updates = updates;
    }
  }
}
function runUpdates(fn, init) {
  if (Updates) return fn();
  let wait = false;
  if (!init) Updates = [];
  if (Effects) wait = true;else Effects = [];
  ExecCount++;
  try {
    const res = fn();
    completeUpdates(wait);
    return res;
  } catch (err) {
    if (!wait) Effects = null;
    Updates = null;
    handleError(err);
  }
}
function completeUpdates(wait) {
  if (Updates) {
    runQueue(Updates);
    Updates = null;
  }
  if (wait) return;
  const e = Effects;
  Effects = null;
  if (e.length) runUpdates(() => runEffects(e), false);
}
function runQueue(queue) {
  for (let i = 0; i < queue.length; i++) runTop(queue[i]);
}
function lookUpstream(node, ignore) {
  node.state = 0;
  for (let i = 0; i < node.sources.length; i += 1) {
    const source = node.sources[i];
    if (source.sources) {
      const state = source.state;
      if (state === STALE) {
        if (source !== ignore && (!source.updatedAt || source.updatedAt < ExecCount)) runTop(source);
      } else if (state === PENDING) lookUpstream(source, ignore);
    }
  }
}
function markDownstream(node) {
  for (let i = 0; i < node.observers.length; i += 1) {
    const o = node.observers[i];
    if (!o.state) {
      o.state = PENDING;
      if (o.pure) Updates.push(o);else Effects.push(o);
      o.observers && markDownstream(o);
    }
  }
}
function cleanNode(node) {
  let i;
  if (node.sources) {
    while (node.sources.length) {
      const source = node.sources.pop(),
        index = node.sourceSlots.pop(),
        obs = source.observers;
      if (obs && obs.length) {
        const n = obs.pop(),
          s = source.observerSlots.pop();
        if (index < obs.length) {
          n.sourceSlots[s] = index;
          obs[index] = n;
          source.observerSlots[index] = s;
        }
      }
    }
  }
  if (node.tOwned) {
    for (i = node.tOwned.length - 1; i >= 0; i--) cleanNode(node.tOwned[i]);
    delete node.tOwned;
  }
  if (node.owned) {
    for (i = node.owned.length - 1; i >= 0; i--) cleanNode(node.owned[i]);
    node.owned = null;
  }
  if (node.cleanups) {
    for (i = node.cleanups.length - 1; i >= 0; i--) node.cleanups[i]();
    node.cleanups = null;
  }
  node.state = 0;
}
function castError(err) {
  if (err instanceof Error) return err;
  return new Error(typeof err === "string" ? err : "Unknown error", {
    cause: err
  });
}
function handleError(err, owner = Owner) {
  const error = castError(err);
  throw error;
}

const FALLBACK = Symbol("fallback");
function dispose(d) {
  for (let i = 0; i < d.length; i++) d[i]();
}
function mapArray(list, mapFn, options = {}) {
  let items = [],
    mapped = [],
    disposers = [],
    len = 0,
    indexes = mapFn.length > 1 ? [] : null;
  onCleanup(() => dispose(disposers));
  return () => {
    let newItems = list() || [],
      newLen = newItems.length,
      i,
      j;
    newItems[$TRACK];
    return untrack(() => {
      let newIndices, newIndicesNext, temp, tempdisposers, tempIndexes, start, end, newEnd, item;
      if (newLen === 0) {
        if (len !== 0) {
          dispose(disposers);
          disposers = [];
          items = [];
          mapped = [];
          len = 0;
          indexes && (indexes = []);
        }
        if (options.fallback) {
          items = [FALLBACK];
          mapped[0] = createRoot(disposer => {
            disposers[0] = disposer;
            return options.fallback();
          });
          len = 1;
        }
      }
      else if (len === 0) {
        mapped = new Array(newLen);
        for (j = 0; j < newLen; j++) {
          items[j] = newItems[j];
          mapped[j] = createRoot(mapper);
        }
        len = newLen;
      } else {
        temp = new Array(newLen);
        tempdisposers = new Array(newLen);
        indexes && (tempIndexes = new Array(newLen));
        for (start = 0, end = Math.min(len, newLen); start < end && items[start] === newItems[start]; start++);
        for (end = len - 1, newEnd = newLen - 1; end >= start && newEnd >= start && items[end] === newItems[newEnd]; end--, newEnd--) {
          temp[newEnd] = mapped[end];
          tempdisposers[newEnd] = disposers[end];
          indexes && (tempIndexes[newEnd] = indexes[end]);
        }
        newIndices = new Map();
        newIndicesNext = new Array(newEnd + 1);
        for (j = newEnd; j >= start; j--) {
          item = newItems[j];
          i = newIndices.get(item);
          newIndicesNext[j] = i === undefined ? -1 : i;
          newIndices.set(item, j);
        }
        for (i = start; i <= end; i++) {
          item = items[i];
          j = newIndices.get(item);
          if (j !== undefined && j !== -1) {
            temp[j] = mapped[i];
            tempdisposers[j] = disposers[i];
            indexes && (tempIndexes[j] = indexes[i]);
            j = newIndicesNext[j];
            newIndices.set(item, j);
          } else disposers[i]();
        }
        for (j = start; j < newLen; j++) {
          if (j in temp) {
            mapped[j] = temp[j];
            disposers[j] = tempdisposers[j];
            if (indexes) {
              indexes[j] = tempIndexes[j];
              indexes[j](j);
            }
          } else mapped[j] = createRoot(mapper);
        }
        mapped = mapped.slice(0, len = newLen);
        items = newItems.slice(0);
      }
      return mapped;
    });
    function mapper(disposer) {
      disposers[j] = disposer;
      if (indexes) {
        const [s, set] = createSignal(j);
        indexes[j] = set;
        return mapFn(newItems[j], s);
      }
      return mapFn(newItems[j]);
    }
  };
}
function createComponent(Comp, props) {
  return untrack(() => Comp(props || {}));
}

const narrowedError = name => `Stale read from <${name}>.`;
function For(props) {
  const fallback = "fallback" in props && {
    fallback: () => props.fallback
  };
  return createMemo(mapArray(() => props.each, props.children, fallback || undefined));
}
function Show(props) {
  const keyed = props.keyed;
  const conditionValue = createMemo(() => props.when, undefined, undefined);
  const condition = keyed ? conditionValue : createMemo(conditionValue, undefined, {
    equals: (a, b) => !a === !b
  });
  return createMemo(() => {
    const c = condition();
    if (c) {
      const child = props.children;
      const fn = typeof child === "function" && child.length > 0;
      return fn ? untrack(() => child(keyed ? c : () => {
        if (!untrack(condition)) throw narrowedError("Show");
        return conditionValue();
      })) : child;
    }
    return props.fallback;
  }, undefined, undefined);
}

function reconcileArrays(parentNode, a, b) {
  let bLength = b.length,
    aEnd = a.length,
    bEnd = bLength,
    aStart = 0,
    bStart = 0,
    after = a[aEnd - 1].nextSibling,
    map = null;
  while (aStart < aEnd || bStart < bEnd) {
    if (a[aStart] === b[bStart]) {
      aStart++;
      bStart++;
      continue;
    }
    while (a[aEnd - 1] === b[bEnd - 1]) {
      aEnd--;
      bEnd--;
    }
    if (aEnd === aStart) {
      const node = bEnd < bLength ? bStart ? b[bStart - 1].nextSibling : b[bEnd - bStart] : after;
      while (bStart < bEnd) parentNode.insertBefore(b[bStart++], node);
    } else if (bEnd === bStart) {
      while (aStart < aEnd) {
        if (!map || !map.has(a[aStart])) a[aStart].remove();
        aStart++;
      }
    } else if (a[aStart] === b[bEnd - 1] && b[bStart] === a[aEnd - 1]) {
      const node = a[--aEnd].nextSibling;
      parentNode.insertBefore(b[bStart++], a[aStart++].nextSibling);
      parentNode.insertBefore(b[--bEnd], node);
      a[aEnd] = b[bEnd];
    } else {
      if (!map) {
        map = new Map();
        let i = bStart;
        while (i < bEnd) map.set(b[i], i++);
      }
      const index = map.get(a[aStart]);
      if (index != null) {
        if (bStart < index && index < bEnd) {
          let i = aStart,
            sequence = 1,
            t;
          while (++i < aEnd && i < bEnd) {
            if ((t = map.get(a[i])) == null || t !== index + sequence) break;
            sequence++;
          }
          if (sequence > index - bStart) {
            const node = a[aStart];
            while (bStart < index) parentNode.insertBefore(b[bStart++], node);
          } else parentNode.replaceChild(b[bStart++], a[aStart++]);
        } else aStart++;
      } else a[aStart++].remove();
    }
  }
}

const $$EVENTS = "_$DX_DELEGATE";
function render(code, element, init, options = {}) {
  let disposer;
  createRoot(dispose => {
    disposer = dispose;
    element === document ? code() : insert(element, code(), element.firstChild ? null : undefined, init);
  }, options.owner);
  return () => {
    disposer();
    element.textContent = "";
  };
}
function template(html, isImportNode, isSVG, isMathML) {
  let node;
  const create = () => {
    const t = isMathML ? document.createElementNS("http://www.w3.org/1998/Math/MathML", "template") : document.createElement("template");
    t.innerHTML = html;
    return isSVG ? t.content.firstChild.firstChild : isMathML ? t.firstChild : t.content.firstChild;
  };
  const fn = isImportNode ? () => untrack(() => document.importNode(node || (node = create()), true)) : () => (node || (node = create())).cloneNode(true);
  fn.cloneNode = fn;
  return fn;
}
function delegateEvents(eventNames, document = window.document) {
  const e = document[$$EVENTS] || (document[$$EVENTS] = new Set());
  for (let i = 0, l = eventNames.length; i < l; i++) {
    const name = eventNames[i];
    if (!e.has(name)) {
      e.add(name);
      document.addEventListener(name, eventHandler);
    }
  }
}
function setAttribute(node, name, value) {
  if (value == null) node.removeAttribute(name);else node.setAttribute(name, value);
}
function addEventListener(node, name, handler, delegate) {
  if (delegate) {
    if (Array.isArray(handler)) {
      node[`$$${name}`] = handler[0];
      node[`$$${name}Data`] = handler[1];
    } else node[`$$${name}`] = handler;
  } else if (Array.isArray(handler)) {
    const handlerFn = handler[0];
    node.addEventListener(name, handler[0] = e => handlerFn.call(node, handler[1], e));
  } else node.addEventListener(name, handler, typeof handler !== "function" && handler);
}
function style(node, value, prev) {
  if (!value) return prev ? setAttribute(node, "style") : value;
  const nodeStyle = node.style;
  if (typeof value === "string") return nodeStyle.cssText = value;
  typeof prev === "string" && (nodeStyle.cssText = prev = undefined);
  prev || (prev = {});
  value || (value = {});
  let v, s;
  for (s in prev) {
    value[s] == null && nodeStyle.removeProperty(s);
    delete prev[s];
  }
  for (s in value) {
    v = value[s];
    if (v !== prev[s]) {
      nodeStyle.setProperty(s, v);
      prev[s] = v;
    }
  }
  return prev;
}
function use(fn, element, arg) {
  return untrack(() => fn(element, arg));
}
function insert(parent, accessor, marker, initial) {
  if (marker !== undefined && !initial) initial = [];
  if (typeof accessor !== "function") return insertExpression(parent, accessor, initial, marker);
  createRenderEffect(current => insertExpression(parent, accessor(), current, marker), initial);
}
function eventHandler(e) {
  let node = e.target;
  const key = `$$${e.type}`;
  const oriTarget = e.target;
  const oriCurrentTarget = e.currentTarget;
  const retarget = value => Object.defineProperty(e, "target", {
    configurable: true,
    value
  });
  const handleNode = () => {
    const handler = node[key];
    if (handler && !node.disabled) {
      const data = node[`${key}Data`];
      data !== undefined ? handler.call(node, data, e) : handler.call(node, e);
      if (e.cancelBubble) return;
    }
    node.host && typeof node.host !== "string" && !node.host._$host && node.contains(e.target) && retarget(node.host);
    return true;
  };
  const walkUpTree = () => {
    while (handleNode() && (node = node._$host || node.parentNode || node.host));
  };
  Object.defineProperty(e, "currentTarget", {
    configurable: true,
    get() {
      return node || document;
    }
  });
  if (e.composedPath) {
    const path = e.composedPath();
    retarget(path[0]);
    for (let i = 0; i < path.length - 2; i++) {
      node = path[i];
      if (!handleNode()) break;
      if (node._$host) {
        node = node._$host;
        walkUpTree();
        break;
      }
      if (node.parentNode === oriCurrentTarget) {
        break;
      }
    }
  }
  else walkUpTree();
  retarget(oriTarget);
}
function insertExpression(parent, value, current, marker, unwrapArray) {
  while (typeof current === "function") current = current();
  if (value === current) return current;
  const t = typeof value,
    multi = marker !== undefined;
  parent = multi && current[0] && current[0].parentNode || parent;
  if (t === "string" || t === "number") {
    if (t === "number") {
      value = value.toString();
      if (value === current) return current;
    }
    if (multi) {
      let node = current[0];
      if (node && node.nodeType === 3) {
        node.data !== value && (node.data = value);
      } else node = document.createTextNode(value);
      current = cleanChildren(parent, current, marker, node);
    } else {
      if (current !== "" && typeof current === "string") {
        current = parent.firstChild.data = value;
      } else current = parent.textContent = value;
    }
  } else if (value == null || t === "boolean") {
    current = cleanChildren(parent, current, marker);
  } else if (t === "function") {
    createRenderEffect(() => {
      let v = value();
      while (typeof v === "function") v = v();
      current = insertExpression(parent, v, current, marker);
    });
    return () => current;
  } else if (Array.isArray(value)) {
    const array = [];
    const currentArray = current && Array.isArray(current);
    if (normalizeIncomingArray(array, value, current, unwrapArray)) {
      createRenderEffect(() => current = insertExpression(parent, array, current, marker, true));
      return () => current;
    }
    if (array.length === 0) {
      current = cleanChildren(parent, current, marker);
      if (multi) return current;
    } else if (currentArray) {
      if (current.length === 0) {
        appendNodes(parent, array, marker);
      } else reconcileArrays(parent, current, array);
    } else {
      current && cleanChildren(parent);
      appendNodes(parent, array);
    }
    current = array;
  } else if (value.nodeType) {
    if (Array.isArray(current)) {
      if (multi) return current = cleanChildren(parent, current, marker, value);
      cleanChildren(parent, current, null, value);
    } else if (current == null || current === "" || !parent.firstChild) {
      parent.appendChild(value);
    } else parent.replaceChild(value, parent.firstChild);
    current = value;
  } else ;
  return current;
}
function normalizeIncomingArray(normalized, array, current, unwrap) {
  let dynamic = false;
  for (let i = 0, len = array.length; i < len; i++) {
    let item = array[i],
      prev = current && current[normalized.length],
      t;
    if (item == null || item === true || item === false) ; else if ((t = typeof item) === "object" && item.nodeType) {
      normalized.push(item);
    } else if (Array.isArray(item)) {
      dynamic = normalizeIncomingArray(normalized, item, prev) || dynamic;
    } else if (t === "function") {
      if (unwrap) {
        while (typeof item === "function") item = item();
        dynamic = normalizeIncomingArray(normalized, Array.isArray(item) ? item : [item], Array.isArray(prev) ? prev : [prev]) || dynamic;
      } else {
        normalized.push(item);
        dynamic = true;
      }
    } else {
      const value = String(item);
      if (prev && prev.nodeType === 3 && prev.data === value) normalized.push(prev);else normalized.push(document.createTextNode(value));
    }
  }
  return dynamic;
}
function appendNodes(parent, array, marker = null) {
  for (let i = 0, len = array.length; i < len; i++) parent.insertBefore(array[i], marker);
}
function cleanChildren(parent, current, marker, replacement) {
  if (marker === undefined) return parent.textContent = "";
  const node = replacement || document.createTextNode("");
  if (current.length) {
    let inserted = false;
    for (let i = current.length - 1; i >= 0; i--) {
      const el = current[i];
      if (node !== el) {
        const isParent = el.parentNode === parent;
        if (!inserted && !i) isParent ? parent.replaceChild(node, el) : parent.insertBefore(node, marker);else isParent && el.remove();
      } else inserted = true;
    }
  } else parent.insertBefore(node, marker);
  return [node];
}

const DEFAULT_PANEL_WIDTH = 460;
const DEFAULT_PANEL_HEIGHT = 290;
const DEFAULT_HOVER_DELAY = 500;
const DEFAULT_HIDE_DELAY = 300;
const DEFAULT_BLOCKED_ROUTES = ['directory', 'downloads', 'jobs', 'p', 'search', 'settings', 'subscriptions', 'turbo', 'wallet', 'videos'];
function loadSetting(key, fallback) {
  try {
    const val = GM_getValue(key, undefined);
    if (val !== undefined) return val;
  } catch (_unused) {/* noop */}
  return fallback;
}
function saveSetting(key, value) {
  try {
    GM_setValue(key, value);
  } catch (_unused2) {/* noop */}
}
const [panelWidth, _setPanelWidth] = createSignal(loadSetting('panelWidth', DEFAULT_PANEL_WIDTH));
const [panelHeight, _setPanelHeight] = createSignal(loadSetting('panelHeight', DEFAULT_PANEL_HEIGHT));
const [hoverDelay, _setHoverDelay] = createSignal(loadSetting('hoverDelay', DEFAULT_HOVER_DELAY));
const [hideDelay, _setHideDelay] = createSignal(loadSetting('hideDelay', DEFAULT_HIDE_DELAY));
const [blockedRoutes, _setBlockedRoutes] = createSignal(loadSetting('blockedRoutes', DEFAULT_BLOCKED_ROUTES));
function setPanelWidth(v) {
  _setPanelWidth(v);
  saveSetting('panelWidth', v);
}
function setPanelHeight(v) {
  _setPanelHeight(v);
  saveSetting('panelHeight', v);
}
function setHoverDelay(v) {
  _setHoverDelay(v);
  saveSetting('hoverDelay', v);
}
function setHideDelay(v) {
  _setHideDelay(v);
  saveSetting('hideDelay', v);
}
function setBlockedRoutes(v) {
  _setBlockedRoutes(v);
  saveSetting('blockedRoutes', v);
}
function resetAllSettings() {
  setPanelWidth(DEFAULT_PANEL_WIDTH);
  setPanelHeight(DEFAULT_PANEL_HEIGHT);
  setHoverDelay(DEFAULT_HOVER_DELAY);
  setHideDelay(DEFAULT_HIDE_DELAY);
  setBlockedRoutes([...DEFAULT_BLOCKED_ROUTES]);
}

function getTwitchParent() {
  return window.location.hostname;
}
function buildEmbedUrl(channelLogin) {
  const parent = encodeURIComponent(getTwitchParent());
  const ch = encodeURIComponent(channelLogin);
  return `https://player.twitch.tv/?channel=${ch}&parent=${parent}&muted=true&autoplay=true`;
}
function extractChannelLoginFromLink(a) {
  const href = a.getAttribute('href');
  if (!href) return null;
  const clean = href.split('?')[0].split('#')[0];
  const parts = clean.split('/').filter(Boolean);
  if (!parts.length) return null;
  const login = parts[0];
  const blocked = new Set(blockedRoutes());
  if (blocked.has(login)) return null;
  if (!/^[a-z0-9_]{2,25}$/i.test(login)) return null;
  return login;
}
function findAnchorFromTarget(target) {
  if (!(target instanceof Element)) return null;
  return target.closest('a[href^="/"]');
}
function isSidebarChannelLink(a) {
  const nav = a.closest('nav');
  if (!nav) return false;
  const rect = nav.getBoundingClientRect();
  return rect.left < 80 && rect.width < 500;
}

function useDrag(onDragEndOutside) {
  const [isDragging, setIsDragging] = createSignal(false);
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let currentPanelRef = null;
  const onDragMove = e => {
    if (!isDragging() || !currentPanelRef) return;
    e.preventDefault();
    let left = e.clientX - dragOffsetX;
    let top = e.clientY - dragOffsetY;
    left = Math.max(0, Math.min(window.innerWidth - panelWidth(), left));
    top = Math.max(0, Math.min(window.innerHeight - panelHeight(), top));
    currentPanelRef.style.left = `${left}px`;
    currentPanelRef.style.top = `${top}px`;
  };
  const onDragEnd = e => {
    if (!isDragging()) return;
    setIsDragging(false);
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);
    if (currentPanelRef) {
      const rect = currentPanelRef.getBoundingClientRect();
      const isOutside = e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;
      if (isOutside) {
        onDragEndOutside();
      }
    }
  };
  const onDragStart = (e, panelRef) => {
    e.preventDefault();
    currentPanelRef = panelRef;
    setIsDragging(true);
    dragOffsetX = e.clientX - panelRef.offsetLeft;
    dragOffsetY = e.clientY - panelRef.offsetTop;
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
  };
  const cleanupDrag = () => {
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);
  };
  return {
    isDragging,
    onDragStart,
    cleanupDrag
  };
}

function useTimers() {
  let hoverTimer = null;
  let hideTimer = null;
  const cancelHide = () => {
    if (hideTimer) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
  };
  const cancelHover = () => {
    if (hoverTimer) {
      window.clearTimeout(hoverTimer);
      hoverTimer = null;
    }
  };
  const scheduleHide = callback => {
    cancelHide();
    hideTimer = window.setTimeout(() => {
      callback();
      hideTimer = null;
    }, hideDelay());
  };
  const setHoverTimer = (callback, delay) => {
    cancelHover();
    hoverTimer = window.setTimeout(() => {
      callback();
      hoverTimer = null;
    }, delay);
  };
  const clearAllTimers = () => {
    cancelHide();
    cancelHover();
  };
  return {
    scheduleHide,
    cancelHide,
    setHoverTimer,
    cancelHover,
    clearAllTimers
  };
}

function usePreviewPanel() {
  const [getChannel, setChannel] = createSignal(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [isVisible, setIsVisible] = createSignal(false);
  const [isPinned, setIsPinned] = createSignal(false);
  const [showSettings, setShowSettings] = createSignal(false);
  let iframeEl = null;
  let panelRef;
  const timers = useTimers();
  const hidePanel = () => {
    setIsVisible(false);
    setIsPinned(false);
    setTimeout(() => {
      setChannel(null);
      if (iframeEl) iframeEl.src = '';
    }, 200);
  };
  const requestHide = () => {
    if (isPinned() || drag.isDragging()) return;
    timers.scheduleHide(hidePanel);
  };
  const drag = useDrag(() => {
    if (!isPinned()) {
      requestHide();
    }
  });
  const showPanel = (login, linkRect) => {
    setChannel(login);
    setIsLoading(true);
    setIsVisible(true);
    if (iframeEl) {
      iframeEl.src = buildEmbedUrl(login);
      setTimeout(() => setIsLoading(false), 800);
    }
    if (!panelRef) return;
    let left = linkRect.right + 15;
    let top = linkRect.top - 20;
    if (left + panelWidth() > window.innerWidth) {
      left = linkRect.left - panelWidth() - 15;
    }
    if (top + panelHeight() > window.innerHeight) {
      top = window.innerHeight - panelHeight() - 10;
    }
    if (top < 10) top = 10;
    panelRef.style.left = `${left}px`;
    panelRef.style.top = `${top}px`;
  };
  const onMouseOver = ev => {
    const a = findAnchorFromTarget(ev.target);
    if (!a || !isSidebarChannelLink(a)) return;
    const login = extractChannelLoginFromLink(a);
    if (!login) return;
    timers.cancelHide();
    if (getChannel() === login) return;
    timers.setHoverTimer(() => {
      const rect = a.getBoundingClientRect();
      showPanel(login, rect);
    }, hoverDelay());
  };
  const onMouseOut = ev => {
    const a = findAnchorFromTarget(ev.target);
    if (!a || !isSidebarChannelLink(a)) return;
    timers.cancelHover();
    requestHide();
  };
  const openInTwitch = () => {
    const ch = getChannel();
    if (ch) {
      window.open(`https://www.twitch.tv/${ch}`, '_blank');
    }
  };
  const togglePin = () => {
    setIsPinned(!isPinned());
  };
  const toggleSettings = () => {
    setShowSettings(!showSettings());
  };
  const handlePanelMouseEnter = () => {
    timers.cancelHide();
  };
  const handlePanelMouseLeave = () => {
    requestHide();
  };
  const handleDragStart = e => {
    if (!panelRef) return;
    timers.cancelHide();
    drag.onDragStart(e, panelRef);
  };
  window.addEventListener('mouseover', onMouseOver, true);
  window.addEventListener('mouseout', onMouseOut, true);
  onCleanup(() => {
    var _panelRef;
    window.removeEventListener('mouseover', onMouseOver, true);
    window.removeEventListener('mouseout', onMouseOut, true);
    drag.cleanupDrag();
    timers.clearAllTimers();
    if ((_panelRef = panelRef) != null && _panelRef.parentNode) {
      panelRef.parentNode.removeChild(panelRef);
    }
  });
  return {
    getChannel,
    isLoading,
    isVisible,
    isPinned,
    isDragging: drag.isDragging,
    showSettings,
    setIframeRef: el => {
      iframeEl = el;
    },
    setPanelRef: el => {
      panelRef = el;
    },
    hidePanel,
    openInTwitch,
    togglePin,
    toggleSettings,
    handlePanelMouseEnter,
    handlePanelMouseLeave,
    handleDragStart
  };
}

function _extends() {
  return _extends = Object.assign ? Object.assign.bind() : function (n) {
    for (var e = 1; e < arguments.length; e++) {
      var t = arguments[e];
      for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
    }
    return n;
  }, _extends.apply(null, arguments);
}

const FONT_STACK = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
function panelStyle(isVisible, isDragging, hasChannel) {
  return {
    position: 'fixed',
    'z-index': 999999,
    display: hasChannel ? 'block' : 'none',
    width: `${panelWidth()}px`,
    height: `${panelHeight()}px`,
    background: '#18181b',
    border: '1px solid #323237',
    'border-radius': '12px',
    'box-shadow': '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)',
    padding: 0,
    'pointer-events': 'auto',
    overflow: 'hidden',
    'user-select': 'none',
    opacity: isVisible ? '1' : '0',
    transform: isVisible ? 'scale(1)' : 'scale(0.95)',
    transition: isDragging ? 'none' : 'opacity 0.2s ease, transform 0.2s ease'
  };
}
const headerStyle = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  padding: '10px 12px',
  background: 'linear-gradient(to bottom, #1f1f23, #18181b)',
  'border-bottom': '1px solid #323237'
};
const headerLeftStyle = {
  display: 'flex',
  'align-items': 'center',
  gap: '8px',
  flex: 1,
  'min-width': 0
};
const liveDotStyle = {
  width: '8px',
  height: '8px',
  'border-radius': '50%',
  background: '#ff4655',
  'box-shadow': '0 0 8px rgba(255, 70, 85, 0.6)',
  animation: 'pulse 2s ease-in-out infinite'
};
const channelNameStyle = {
  color: '#efeff1',
  'font-size': '14px',
  'font-weight': '600',
  'font-family': FONT_STACK,
  'white-space': 'nowrap',
  overflow: 'hidden',
  'text-overflow': 'ellipsis'
};
const liveBadgeStyle = {
  color: '#fff',
  'font-size': '10px',
  'font-weight': '700',
  'font-family': FONT_STACK,
  'text-transform': 'uppercase',
  background: '#e91916',
  padding: '2px 6px',
  'border-radius': '4px',
  'letter-spacing': '0.5px'
};
const buttonGroupStyle = {
  display: 'flex',
  gap: '6px'
};
const iconButtonStyle = {
  background: 'transparent',
  border: 'none',
  color: '#efeff1',
  cursor: 'pointer',
  padding: '4px 8px',
  'border-radius': '6px',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  transition: 'background 0.2s ease'
};
const dragButtonStyle = _extends({}, iconButtonStyle, {
  cursor: 'grab'
});
const loaderOverlayStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  'z-index': 10,
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  gap: '12px'
};
const spinnerStyle = {
  width: '32px',
  height: '32px',
  border: '3px solid rgba(145, 71, 255, 0.2)',
  'border-top-color': '#9147ff',
  'border-radius': '50%',
  animation: 'spin 0.8s linear infinite'
};
const loaderTextStyle = {
  color: '#efeff1',
  'font-size': '12px',
  'font-family': FONT_STACK
};
const iframeStyle = {
  width: '100%',
  height: 'calc(100% - 40px)',
  border: 0,
  display: 'block',
  background: '#0e0e10'
};
function applyHover(e) {
  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
}
function removeHover(e) {
  e.currentTarget.style.background = 'transparent';
}

var _tmpl$$2 = /*#__PURE__*/template(`<svg width=16 height=16 viewBox="0 0 24 24"fill=none stroke=currentColor stroke-width=2><circle cx=12 cy=5 r=1></circle><circle cx=19 cy=5 r=1></circle><circle cx=5 cy=5 r=1></circle><circle cx=12 cy=12 r=1></circle><circle cx=19 cy=12 r=1></circle><circle cx=5 cy=12 r=1></circle><circle cx=12 cy=19 r=1></circle><circle cx=19 cy=19 r=1></circle><circle cx=5 cy=19 r=1>`),
  _tmpl$2$2 = /*#__PURE__*/template(`<svg width=16 height=16 viewBox="0 0 24 24"stroke=currentColor stroke-width=2><path d="M12 17v5"></path><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z">`),
  _tmpl$3 = /*#__PURE__*/template(`<svg xmlns=http://www.w3.org/2000/svg width=16 height=16 viewBox="0 0 24 24"fill=none stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"></path><circle cx=12 cy=12 r=3>`),
  _tmpl$4 = /*#__PURE__*/template(`<svg width=16 height=16 viewBox="0 0 24 24"fill=none stroke=currentColor stroke-width=2><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6">`),
  _tmpl$5 = /*#__PURE__*/template(`<svg width=16 height=16 viewBox="0 0 24 24"fill=none stroke=currentColor stroke-width=2><circle cx=12 cy=12 r=10></circle><path d="m15 9-6 6"></path><path d="m9 9 6 6">`),
  _tmpl$6 = /*#__PURE__*/template(`<div><div><div></div><span></span><span>LIVE</span></div><button title="Drag to move"></button><div><button></button><button title=Settings></button><button title="Open in new tab"></button><button title=Close>`);
function DragIcon() {
  return _tmpl$$2();
}
function PinIcon(props) {
  return (() => {
    var _el$2 = _tmpl$2$2();
    createRenderEffect(() => setAttribute(_el$2, "fill", props.filled ? 'currentColor' : 'none'));
    return _el$2;
  })();
}
function SettingsIcon() {
  return _tmpl$3();
}
function ExternalLinkIcon() {
  return _tmpl$4();
}
function CloseIcon() {
  return _tmpl$5();
}
function HeaderBar(props) {
  return (() => {
    var _el$6 = _tmpl$6(),
      _el$7 = _el$6.firstChild,
      _el$8 = _el$7.firstChild,
      _el$9 = _el$8.nextSibling,
      _el$0 = _el$9.nextSibling,
      _el$1 = _el$7.nextSibling,
      _el$10 = _el$1.nextSibling,
      _el$11 = _el$10.firstChild,
      _el$12 = _el$11.nextSibling,
      _el$13 = _el$12.nextSibling,
      _el$14 = _el$13.nextSibling;
    insert(_el$9, () => props.channel());
    addEventListener(_el$1, "mouseleave", removeHover);
    addEventListener(_el$1, "mouseenter", applyHover);
    addEventListener(_el$1, "mousedown", props.onDragStart, true);
    insert(_el$1, createComponent(DragIcon, {}));
    addEventListener(_el$11, "mouseleave", removeHover);
    addEventListener(_el$11, "mouseenter", applyHover);
    addEventListener(_el$11, "click", props.onTogglePin, true);
    insert(_el$11, createComponent(PinIcon, {
      get filled() {
        return props.isPinned();
      }
    }));
    addEventListener(_el$12, "mouseleave", removeHover);
    addEventListener(_el$12, "mouseenter", applyHover);
    addEventListener(_el$12, "click", props.onOpenSettings, true);
    insert(_el$12, createComponent(SettingsIcon, {}));
    addEventListener(_el$13, "mouseleave", removeHover);
    addEventListener(_el$13, "mouseenter", applyHover);
    addEventListener(_el$13, "click", props.onOpenInTwitch, true);
    insert(_el$13, createComponent(ExternalLinkIcon, {}));
    addEventListener(_el$14, "mouseleave", removeHover);
    addEventListener(_el$14, "mouseenter", applyHover);
    addEventListener(_el$14, "click", props.onClose, true);
    insert(_el$14, createComponent(CloseIcon, {}));
    createRenderEffect(_p$ => {
      var _v$ = headerStyle,
        _v$2 = headerLeftStyle,
        _v$3 = liveDotStyle,
        _v$4 = channelNameStyle,
        _v$5 = liveBadgeStyle,
        _v$6 = dragButtonStyle,
        _v$7 = buttonGroupStyle,
        _v$8 = iconButtonStyle,
        _v$9 = props.isPinned() ? 'Unpin' : 'Pin',
        _v$0 = iconButtonStyle,
        _v$1 = iconButtonStyle,
        _v$10 = iconButtonStyle;
      _p$.e = style(_el$6, _v$, _p$.e);
      _p$.t = style(_el$7, _v$2, _p$.t);
      _p$.a = style(_el$8, _v$3, _p$.a);
      _p$.o = style(_el$9, _v$4, _p$.o);
      _p$.i = style(_el$0, _v$5, _p$.i);
      _p$.n = style(_el$1, _v$6, _p$.n);
      _p$.s = style(_el$10, _v$7, _p$.s);
      _p$.h = style(_el$11, _v$8, _p$.h);
      _v$9 !== _p$.r && setAttribute(_el$11, "title", _p$.r = _v$9);
      _p$.d = style(_el$12, _v$0, _p$.d);
      _p$.l = style(_el$13, _v$1, _p$.l);
      _p$.u = style(_el$14, _v$10, _p$.u);
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined,
      o: undefined,
      i: undefined,
      n: undefined,
      s: undefined,
      h: undefined,
      r: undefined,
      d: undefined,
      l: undefined,
      u: undefined
    });
    return _el$6;
  })();
}
delegateEvents(["mousedown", "click"]);

var _tmpl$$1 = /*#__PURE__*/template(`<div><div><div><span>Settings</span><button><svg width=18 height=18 viewBox="0 0 24 24"fill=none stroke=currentColor stroke-width=2><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button></div><div><label>Blocked Routes</label><textarea></textarea><div>Comma-separated list of routes to ignore</div></div><div><button>Reset Defaults</button><div style=flex:1></div><button>Cancel</button><button>Save`),
  _tmpl$2$1 = /*#__PURE__*/template(`<div><label></label><input><div>`);
const FONT = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const overlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  background: 'rgba(0, 0, 0, 0.7)',
  'z-index': 9999999,
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'backdrop-filter': 'blur(4px)'
};
const modalStyle = {
  background: '#1f1f23',
  border: '1px solid #323237',
  'border-radius': '12px',
  padding: '24px',
  width: '380px',
  'max-height': '80vh',
  'overflow-y': 'auto',
  color: '#efeff1',
  'font-family': FONT,
  'box-shadow': '0 16px 48px rgba(0, 0, 0, 0.8)'
};
const titleStyle = {
  'font-size': '18px',
  'font-weight': '700',
  margin: '0 0 20px 0',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between'
};
const fieldStyle = {
  'margin-bottom': '16px'
};
const labelStyle = {
  display: 'block',
  'font-size': '12px',
  'font-weight': '600',
  color: '#adadb8',
  'margin-bottom': '6px',
  'text-transform': 'uppercase',
  'letter-spacing': '0.5px'
};
const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  background: '#0e0e10',
  border: '1px solid #323237',
  'border-radius': '6px',
  color: '#efeff1',
  'font-size': '14px',
  'font-family': FONT,
  outline: 'none',
  'box-sizing': 'border-box',
  transition: 'border-color 0.2s'
};
const textareaStyle = _extends({}, inputStyle, {
  'min-height': '80px',
  resize: 'vertical'
});
const hintStyle = {
  'font-size': '11px',
  color: '#71717a',
  'margin-top': '4px'
};
const btnRowStyle = {
  display: 'flex',
  gap: '8px',
  'margin-top': '20px',
  'justify-content': 'flex-end'
};
const btnBase = {
  padding: '8px 16px',
  'border-radius': '6px',
  border: 'none',
  'font-size': '13px',
  'font-weight': '600',
  'font-family': FONT,
  cursor: 'pointer',
  transition: 'background 0.2s'
};
const btnPrimary = _extends({}, btnBase, {
  background: '#9147ff',
  color: '#fff'
});
const btnSecondary = _extends({}, btnBase, {
  background: '#323237',
  color: '#efeff1'
});
const btnDanger = _extends({}, btnBase, {
  background: 'transparent',
  color: '#e91916',
  padding: '8px 12px'
});
const closeBtnStyle = {
  background: 'transparent',
  border: 'none',
  color: '#efeff1',
  cursor: 'pointer',
  padding: '4px',
  'border-radius': '6px',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center'
};
function SettingsPanel(props) {
  const [width, setWidth] = createSignal(String(panelWidth()));
  const [height, setHeight] = createSignal(String(panelHeight()));
  const [hover, setHover] = createSignal(String(hoverDelay()));
  const [hide, setHide] = createSignal(String(hideDelay()));
  const [routes, setRoutes] = createSignal(blockedRoutes().join(', '));
  const handleSave = () => {
    const w = parseInt(width(), 10);
    const h = parseInt(height(), 10);
    const hov = parseInt(hover(), 10);
    const hid = parseInt(hide(), 10);
    if (!isNaN(w) && w >= 200 && w <= 1200) setPanelWidth(w);
    if (!isNaN(h) && h >= 150 && h <= 800) setPanelHeight(h);
    if (!isNaN(hov) && hov >= 0 && hov <= 5000) setHoverDelay(hov);
    if (!isNaN(hid) && hid >= 0 && hid <= 5000) setHideDelay(hid);
    const parsed = routes().split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    setBlockedRoutes(parsed);
    props.onClose();
  };
  const handleReset = () => {
    resetAllSettings();
    setWidth(String(DEFAULT_PANEL_WIDTH));
    setHeight(String(DEFAULT_PANEL_HEIGHT));
    setHover(String(DEFAULT_HOVER_DELAY));
    setHide(String(DEFAULT_HIDE_DELAY));
    setRoutes(blockedRoutes().join(', '));
  };
  const handleOverlayClick = e => {
    if (e.target === e.currentTarget) props.onClose();
  };
  const fields = [{
    label: 'Panel Width (px)',
    value: width,
    setter: setWidth,
    hint: `Min: 200, Max: 1200, Default: ${DEFAULT_PANEL_WIDTH}`,
    type: 'number'
  }, {
    label: 'Panel Height (px)',
    value: height,
    setter: setHeight,
    hint: `Min: 150, Max: 800, Default: ${DEFAULT_PANEL_HEIGHT}`,
    type: 'number'
  }, {
    label: 'Hover Delay (ms)',
    value: hover,
    setter: setHover,
    hint: `Time before preview appears. Default: ${DEFAULT_HOVER_DELAY}`,
    type: 'number'
  }, {
    label: 'Hide Delay (ms)',
    value: hide,
    setter: setHide,
    hint: `Time before preview hides. Default: ${DEFAULT_HIDE_DELAY}`,
    type: 'number'
  }];
  return (() => {
    var _el$ = _tmpl$$1(),
      _el$2 = _el$.firstChild,
      _el$3 = _el$2.firstChild,
      _el$4 = _el$3.firstChild,
      _el$5 = _el$4.nextSibling,
      _el$6 = _el$3.nextSibling,
      _el$7 = _el$6.firstChild,
      _el$8 = _el$7.nextSibling,
      _el$9 = _el$8.nextSibling,
      _el$0 = _el$6.nextSibling,
      _el$1 = _el$0.firstChild,
      _el$10 = _el$1.nextSibling,
      _el$11 = _el$10.nextSibling,
      _el$12 = _el$11.nextSibling;
    _el$.$$click = handleOverlayClick;
    style(_el$, overlayStyle);
    _el$2.$$click = e => e.stopPropagation();
    style(_el$2, modalStyle);
    style(_el$3, titleStyle);
    _el$5.addEventListener("mouseleave", e => {
      e.currentTarget.style.background = 'transparent';
    });
    _el$5.addEventListener("mouseenter", e => {
      e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
    });
    addEventListener(_el$5, "click", props.onClose, true);
    style(_el$5, closeBtnStyle);
    insert(_el$2, createComponent(For, {
      each: fields,
      children: field => (() => {
        var _el$13 = _tmpl$2$1(),
          _el$14 = _el$13.firstChild,
          _el$15 = _el$14.nextSibling,
          _el$16 = _el$15.nextSibling;
        insert(_el$14, () => field.label);
        _el$15.addEventListener("blur", e => {
          e.currentTarget.style['border-color'] = '#323237';
        });
        _el$15.addEventListener("focus", e => {
          e.currentTarget.style['border-color'] = '#9147ff';
        });
        _el$15.$$input = e => field.setter(e.currentTarget.value);
        insert(_el$16, () => field.hint);
        createRenderEffect(_p$ => {
          var _v$8 = fieldStyle,
            _v$9 = labelStyle,
            _v$0 = field.type,
            _v$1 = inputStyle,
            _v$10 = hintStyle;
          _p$.e = style(_el$13, _v$8, _p$.e);
          _p$.t = style(_el$14, _v$9, _p$.t);
          _v$0 !== _p$.a && setAttribute(_el$15, "type", _p$.a = _v$0);
          _p$.o = style(_el$15, _v$1, _p$.o);
          _p$.i = style(_el$16, _v$10, _p$.i);
          return _p$;
        }, {
          e: undefined,
          t: undefined,
          a: undefined,
          o: undefined,
          i: undefined
        });
        createRenderEffect(() => _el$15.value = field.value());
        return _el$13;
      })()
    }), _el$6);
    _el$8.addEventListener("blur", e => {
      e.currentTarget.style['border-color'] = '#323237';
    });
    _el$8.addEventListener("focus", e => {
      e.currentTarget.style['border-color'] = '#9147ff';
    });
    _el$8.$$input = e => setRoutes(e.currentTarget.value);
    style(_el$0, btnRowStyle);
    _el$1.addEventListener("mouseleave", e => {
      e.currentTarget.style.background = 'transparent';
    });
    _el$1.addEventListener("mouseenter", e => {
      e.currentTarget.style.background = 'rgba(233, 25, 22, 0.1)';
    });
    _el$1.$$click = handleReset;
    _el$11.addEventListener("mouseleave", e => {
      e.currentTarget.style.background = '#323237';
    });
    _el$11.addEventListener("mouseenter", e => {
      e.currentTarget.style.background = '#3f3f46';
    });
    addEventListener(_el$11, "click", props.onClose, true);
    _el$12.addEventListener("mouseleave", e => {
      e.currentTarget.style.background = '#9147ff';
    });
    _el$12.addEventListener("mouseenter", e => {
      e.currentTarget.style.background = '#772ce8';
    });
    _el$12.$$click = handleSave;
    createRenderEffect(_p$ => {
      var _v$ = fieldStyle,
        _v$2 = labelStyle,
        _v$3 = textareaStyle,
        _v$4 = hintStyle,
        _v$5 = btnDanger,
        _v$6 = btnSecondary,
        _v$7 = btnPrimary;
      _p$.e = style(_el$6, _v$, _p$.e);
      _p$.t = style(_el$7, _v$2, _p$.t);
      _p$.a = style(_el$8, _v$3, _p$.a);
      _p$.o = style(_el$9, _v$4, _p$.o);
      _p$.i = style(_el$1, _v$5, _p$.i);
      _p$.n = style(_el$11, _v$6, _p$.n);
      _p$.s = style(_el$12, _v$7, _p$.s);
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined,
      o: undefined,
      i: undefined,
      n: undefined,
      s: undefined
    });
    createRenderEffect(() => _el$8.value = routes());
    return _el$;
  })();
}
delegateEvents(["click", "input"]);

var _tmpl$ = /*#__PURE__*/template(`<div><div></div><span>Loading...`),
  _tmpl$2 = /*#__PURE__*/template(`<div><iframe allow="autoplay; fullscreen"allowfullscreen loading=eager></iframe><style>\n          @keyframes pulse \{\n            0%, 100% \{ opacity: 1; }\n            50% \{ opacity: 0.5; }\n          }\n          @keyframes spin \{\n            to \{ transform: rotate(360deg); }\n          }\n        `, true, false, false);
function App() {
  const panel = usePreviewPanel();
  return [(() => {
    var _el$ = _tmpl$2(),
      _el$5 = _el$.firstChild;
    addEventListener(_el$, "mouseleave", panel.handlePanelMouseLeave);
    addEventListener(_el$, "mouseenter", panel.handlePanelMouseEnter);
    var _ref$ = panel.setPanelRef;
    typeof _ref$ === "function" ? use(_ref$, _el$) : panel.setPanelRef = _el$;
    insert(_el$, createComponent(HeaderBar, {
      get channel() {
        return panel.getChannel;
      },
      get isPinned() {
        return panel.isPinned;
      },
      get onDragStart() {
        return panel.handleDragStart;
      },
      get onTogglePin() {
        return panel.togglePin;
      },
      get onOpenSettings() {
        return panel.toggleSettings;
      },
      get onOpenInTwitch() {
        return panel.openInTwitch;
      },
      get onClose() {
        return panel.hidePanel;
      }
    }), _el$5);
    insert(_el$, createComponent(Show, {
      get when() {
        return panel.isLoading();
      },
      get children() {
        var _el$2 = _tmpl$(),
          _el$3 = _el$2.firstChild,
          _el$4 = _el$3.nextSibling;
        createRenderEffect(_p$ => {
          var _v$ = loaderOverlayStyle,
            _v$2 = spinnerStyle,
            _v$3 = loaderTextStyle;
          _p$.e = style(_el$2, _v$, _p$.e);
          _p$.t = style(_el$3, _v$2, _p$.t);
          _p$.a = style(_el$4, _v$3, _p$.a);
          return _p$;
        }, {
          e: undefined,
          t: undefined,
          a: undefined
        });
        return _el$2;
      }
    }), _el$5);
    var _ref$2 = panel.setIframeRef;
    typeof _ref$2 === "function" ? use(_ref$2, _el$5) : panel.setIframeRef = _el$5;
    createRenderEffect(_p$ => {
      var _v$4 = panelStyle(panel.isVisible(), panel.isDragging(), !!panel.getChannel()),
        _v$5 = iframeStyle;
      _p$.e = style(_el$, _v$4, _p$.e);
      _p$.t = style(_el$5, _v$5, _p$.t);
      return _p$;
    }, {
      e: undefined,
      t: undefined
    });
    return _el$;
  })(), createComponent(Show, {
    get when() {
      return panel.showSettings();
    },
    get children() {
      return createComponent(SettingsPanel, {
        get onClose() {
          return panel.toggleSettings;
        }
      });
    }
  })];
}
const root = document.createElement('div');
document.body.appendChild(root);
render(() => createComponent(App, {}), root);

})();
