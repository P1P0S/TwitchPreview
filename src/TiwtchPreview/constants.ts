import { createSignal } from 'solid-js';

const DEFAULT_PANEL_WIDTH = 460;
const DEFAULT_PANEL_HEIGHT = 290;
const DEFAULT_HOVER_DELAY = 500;
const DEFAULT_HIDE_DELAY = 300;

const DEFAULT_BLOCKED_ROUTES = [
  'directory',
  'downloads',
  'jobs',
  'p',
  'search',
  'settings',
  'subscriptions',
  'turbo',
  'wallet',
  'videos',
];

function loadSetting<T>(key: string, fallback: T): T {
  try {
    const val = GM_getValue(key, undefined);
    if (val !== undefined) return val as T;
  } catch {
    /* noop */
  }
  return fallback;
}

function saveSetting<T>(key: string, value: T) {
  try {
    GM_setValue(key, value);
  } catch {
    /* noop */
  }
}

const [panelWidth, _setPanelWidth] = createSignal(
  loadSetting('panelWidth', DEFAULT_PANEL_WIDTH),
);
const [panelHeight, _setPanelHeight] = createSignal(
  loadSetting('panelHeight', DEFAULT_PANEL_HEIGHT),
);
const [hoverDelay, _setHoverDelay] = createSignal(
  loadSetting('hoverDelay', DEFAULT_HOVER_DELAY),
);
const [hideDelay, _setHideDelay] = createSignal(
  loadSetting('hideDelay', DEFAULT_HIDE_DELAY),
);
const [blockedRoutes, _setBlockedRoutes] = createSignal<string[]>(
  loadSetting('blockedRoutes', DEFAULT_BLOCKED_ROUTES),
);

export function setPanelWidth(v: number) {
  _setPanelWidth(v);
  saveSetting('panelWidth', v);
}
export function setPanelHeight(v: number) {
  _setPanelHeight(v);
  saveSetting('panelHeight', v);
}
export function setHoverDelay(v: number) {
  _setHoverDelay(v);
  saveSetting('hoverDelay', v);
}
export function setHideDelay(v: number) {
  _setHideDelay(v);
  saveSetting('hideDelay', v);
}
export function setBlockedRoutes(v: string[]) {
  _setBlockedRoutes(v);
  saveSetting('blockedRoutes', v);
}

export function resetAllSettings() {
  setPanelWidth(DEFAULT_PANEL_WIDTH);
  setPanelHeight(DEFAULT_PANEL_HEIGHT);
  setHoverDelay(DEFAULT_HOVER_DELAY);
  setHideDelay(DEFAULT_HIDE_DELAY);
  setBlockedRoutes([...DEFAULT_BLOCKED_ROUTES]);
}

export {
  panelWidth as PANEL_WIDTH,
  panelHeight as PANEL_HEIGHT,
  hoverDelay as HOVER_DELAY,
  hideDelay as HIDE_DELAY,
  blockedRoutes as BLOCKED_ROUTES,
  DEFAULT_PANEL_WIDTH,
  DEFAULT_PANEL_HEIGHT,
  DEFAULT_HOVER_DELAY,
  DEFAULT_HIDE_DELAY,
  DEFAULT_BLOCKED_ROUTES,
};
