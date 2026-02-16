// ==UserScript==
// @name        TiwtchPreview
// @namespace   Violentmonkey Scripts
// @description Show mini preview of Twitch Stream.
// @match       *://*.twitch.tv/*
// @version     0.0.1
// @icon        https://external-content.duckduckgo.com/ip3/www.twitch.tv.ico
// @author      Pipos_
// @require     https://cdn.jsdelivr.net/npm/@violentmonkey/dom@2
// @require     https://cdn.jsdelivr.net/npm/@violentmonkey/ui@0.7
// @grant       GM_addStyle
// ==/UserScript==

(function () {
'use strict';

const IS_DEV = false;
const equalFn = (a, b) => a === b;
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
function createComponent(Comp, props) {
  return untrack(() => Comp(props || {}));
}

const narrowedError = name => `Stale read from <${name}>.`;
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
function setStyleProperty(node, name, value) {
  value != null ? node.style.setProperty(name, value) : node.style.removeProperty(name);
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

var _tmpl$ = /*#__PURE__*/template(`<div style="position:absolute;top:50%;left:50%;transform:translate(-50%, -50%);z-index:10;display:flex;flex-direction:column;align-items:center;gap:12px"><div style="width:32px;height:32px;border:3px solid rgba(145, 71, 255, 0.2);border-top-color:#9147ff;border-radius:50%;animation:spin 0.8s linear infinite"></div><span style="color:#efeff1;font-size:12px;font-family:Inter, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, sans-serif">Carregando...`),
  _tmpl$2 = /*#__PURE__*/template(`<div style="position:fixed;z-index:999999;width:460px;height:290px;background:#18181b;border:1px solid #323237;border-radius:12px;box-shadow:0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);padding:0;pointer-events:auto;overflow:hidden;user-select:none"><div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:linear-gradient(to bottom, #1f1f23, #18181b);border-bottom:1px solid #323237"><div style=display:flex;align-items:center;gap:8px;flex:1;min-width:0><div style="width:8px;height:8px;border-radius:50%;background:#ff4655;box-shadow:0 0 8px rgba(255, 70, 85, 0.6);animation:pulse 2s ease-in-out infinite"></div><span style="color:#efeff1;font-size:14px;font-weight:600;font-family:Inter, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></span><span style="color:#fff;font-size:10px;font-weight:700;font-family:Inter, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, sans-serif;text-transform:uppercase;background:#e91916;padding:2px 6px;border-radius:4px;letter-spacing:0.5px">LIVE</span></div><button title="Drag to move"style="background:transparent;border:none;color:#efeff1;cursor:grab;padding:4px 8px;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:background 0.2s ease"><svg width=16 height=16 viewBox="0 0 24 24"fill=none stroke=currentColor stroke-width=2><circle cx=12 cy=5 r=1></circle><circle cx=19 cy=5 r=1></circle><circle cx=5 cy=5 r=1></circle><circle cx=12 cy=12 r=1></circle><circle cx=19 cy=12 r=1></circle><circle cx=5 cy=12 r=1></circle><circle cx=12 cy=19 r=1></circle><circle cx=19 cy=19 r=1></circle><circle cx=5 cy=19 r=1></circle></svg></button><div style=display:flex;gap:6px><button style="background:transparent;border:none;color:#efeff1;cursor:pointer;padding:4px 8px;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:background 0.2s ease"><svg width=16 height=16 viewBox="0 0 24 24"stroke=currentColor stroke-width=2><path d="M12 17v5"></path><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"></path></svg></button><button title="Open in new tab"style="background:transparent;border:none;color:#efeff1;cursor:pointer;padding:4px 8px;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:background 0.2s ease;font-size:12px"><svg width=16 height=16 viewBox="0 0 24 24"fill=none stroke=currentColor stroke-width=2><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg></button><button title=Close style="background:transparent;border:none;color:#efeff1;cursor:pointer;padding:4px 8px;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:background 0.2s ease"><svg width=16 height=16 viewBox="0 0 24 24"fill=none stroke=currentColor stroke-width=2><circle cx=12 cy=12 r=10></circle><path d="m15 9-6 6"></path><path d="m9 9 6 6"></path></svg></button></div></div><iframe allow="autoplay; fullscreen"allowfullscreen loading=eager style="width:100%;height:calc(100% - 40px);border:0;display:block;background:#0e0e10"></iframe><style>\n        @keyframes pulse \{\n          0%, 100% \{ opacity: 1; }\n          50% \{ opacity: 0.5; }\n        }\n        @keyframes spin \{\n          to \{ transform: rotate(360deg); }\n        }\n      `, true, false, false);
const PANEL_WIDTH = 460;
const PANEL_HEIGHT = 290;
const HOVER_DELAY = 120;
const HIDE_DELAY = 300;
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
  const blocked = new Set(['directory', 'downloads', 'jobs', 'p', 'search', 'settings', 'subscriptions', 'turbo', 'wallet', 'videos']);
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
function App() {
  const [getChannel, setChannel] = createSignal(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [isVisible, setIsVisible] = createSignal(false);
  const [isPinned, setIsPinned] = createSignal(false);
  const [isDragging, setIsDragging] = createSignal(false);
  let iframeEl = null;
  let hoverTimer = null;
  let hideTimer = null;
  let panelRef;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
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
    if (left + PANEL_WIDTH > window.innerWidth) {
      left = linkRect.left - PANEL_WIDTH - 15;
    }
    if (top + PANEL_HEIGHT > window.innerHeight) {
      top = window.innerHeight - PANEL_HEIGHT - 10;
    }
    if (top < 10) top = 10;
    panelRef.style.left = `${left}px`;
    panelRef.style.top = `${top}px`;
  };
  const hidePanel = () => {
    setIsVisible(false);
    setIsPinned(false);
    setTimeout(() => {
      setChannel(null);
      if (iframeEl) iframeEl.src = '';
    }, 200);
  };
  const scheduleHide = () => {
    if (isPinned() || isDragging()) return;
    if (hideTimer) window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      hidePanel();
      hideTimer = null;
    }, HIDE_DELAY);
  };
  const clearTimers = () => {
    if (hoverTimer) {
      window.clearTimeout(hoverTimer);
      hoverTimer = null;
    }
    if (hideTimer) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
  };
  const onMouseOver = ev => {
    const a = findAnchorFromTarget(ev.target);
    if (!a) return;
    if (!isSidebarChannelLink(a)) return;
    const login = extractChannelLoginFromLink(a);
    if (!login) return;
    if (hideTimer) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
    if (getChannel() === login) return;
    if (hoverTimer) window.clearTimeout(hoverTimer);
    hoverTimer = window.setTimeout(() => {
      const rect = a.getBoundingClientRect();
      showPanel(login, rect);
      hoverTimer = null;
    }, HOVER_DELAY);
  };
  const onMouseOut = ev => {
    const a = findAnchorFromTarget(ev.target);
    if (!a) return;
    if (!isSidebarChannelLink(a)) return;
    if (hoverTimer) {
      window.clearTimeout(hoverTimer);
      hoverTimer = null;
    }
    scheduleHide();
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
  const onDragStart = e => {
    e.preventDefault();
    if (!panelRef) return;
    setIsDragging(true);
    dragOffsetX = e.clientX - panelRef.offsetLeft;
    dragOffsetY = e.clientY - panelRef.offsetTop;
    if (hideTimer) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
  };
  const onDragMove = e => {
    if (!isDragging() || !panelRef) return;
    e.preventDefault();
    let left = e.clientX - dragOffsetX;
    let top = e.clientY - dragOffsetY;
    left = Math.max(0, Math.min(window.innerWidth - PANEL_WIDTH, left));
    top = Math.max(0, Math.min(window.innerHeight - PANEL_HEIGHT, top));
    panelRef.style.left = `${left}px`;
    panelRef.style.top = `${top}px`;
  };
  const onDragEnd = e => {
    if (!isDragging()) return;
    setIsDragging(false);
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);
    if (!isPinned() && panelRef) {
      const rect = panelRef.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
        scheduleHide();
      }
    }
  };
  window.addEventListener('mouseover', onMouseOver, true);
  window.addEventListener('mouseout', onMouseOut, true);
  onCleanup(() => {
    window.removeEventListener('mouseover', onMouseOver, true);
    window.removeEventListener('mouseout', onMouseOut, true);
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);
    clearTimers();
    if (panelRef != null && panelRef.parentNode) {
      panelRef.parentNode.removeChild(panelRef);
    }
  });
  return (() => {
    var _el$ = _tmpl$2(),
      _el$2 = _el$.firstChild,
      _el$3 = _el$2.firstChild,
      _el$4 = _el$3.firstChild,
      _el$5 = _el$4.nextSibling;
      _el$5.nextSibling;
      var _el$7 = _el$3.nextSibling,
      _el$8 = _el$7.nextSibling,
      _el$9 = _el$8.firstChild,
      _el$0 = _el$9.firstChild,
      _el$1 = _el$9.nextSibling,
      _el$10 = _el$1.nextSibling,
      _el$14 = _el$2.nextSibling;
    _el$.addEventListener("mouseleave", () => {
      scheduleHide();
    });
    _el$.addEventListener("mouseenter", () => {
      if (hideTimer) {
        window.clearTimeout(hideTimer);
        hideTimer = null;
      }
    });
    var _ref$ = panelRef;
    typeof _ref$ === "function" ? use(_ref$, _el$) : panelRef = _el$;
    insert(_el$5, getChannel);
    _el$7.addEventListener("mouseleave", e => {
      e.currentTarget.style.background = 'transparent';
    });
    _el$7.addEventListener("mouseenter", e => {
      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
    });
    _el$7.$$mousedown = onDragStart;
    _el$9.addEventListener("mouseleave", e => {
      e.currentTarget.style.background = 'transparent';
    });
    _el$9.addEventListener("mouseenter", e => {
      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
    });
    _el$9.$$click = togglePin;
    _el$1.addEventListener("mouseleave", e => {
      e.currentTarget.style.background = 'transparent';
    });
    _el$1.addEventListener("mouseenter", e => {
      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
    });
    _el$1.$$click = openInTwitch;
    _el$10.addEventListener("mouseleave", e => {
      e.currentTarget.style.background = 'transparent';
    });
    _el$10.addEventListener("mouseenter", e => {
      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
    });
    _el$10.$$click = hidePanel;
    insert(_el$, createComponent(Show, {
      get when() {
        return isLoading();
      },
      get children() {
        var _el$11 = _tmpl$(),
          _el$12 = _el$11.firstChild;
          _el$12.nextSibling;
        return _el$11;
      }
    }), _el$14);
    use(el => iframeEl = el, _el$14);
    createRenderEffect(_p$ => {
      var _v$ = getChannel() ? 'block' : 'none',
        _v$2 = isVisible() ? '1' : '0',
        _v$3 = isVisible() ? 'scale(1)' : 'scale(0.95)',
        _v$4 = isDragging() ? 'none' : 'opacity 0.2s ease, transform 0.2s ease',
        _v$5 = isPinned() ? 'Unpin' : 'Pin',
        _v$6 = isPinned() ? 'currentColor' : 'none';
      _v$ !== _p$.e && setStyleProperty(_el$, "display", _p$.e = _v$);
      _v$2 !== _p$.t && setStyleProperty(_el$, "opacity", _p$.t = _v$2);
      _v$3 !== _p$.a && setStyleProperty(_el$, "transform", _p$.a = _v$3);
      _v$4 !== _p$.o && setStyleProperty(_el$, "transition", _p$.o = _v$4);
      _v$5 !== _p$.i && setAttribute(_el$9, "title", _p$.i = _v$5);
      _v$6 !== _p$.n && setAttribute(_el$0, "fill", _p$.n = _v$6);
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined,
      o: undefined,
      i: undefined,
      n: undefined
    });
    return _el$;
  })();
}
const root = document.createElement('div');
document.body.appendChild(root);
render(() => createComponent(App, {}), root);
delegateEvents(["mousedown", "click"]);

})();
