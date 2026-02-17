import { createSignal, For } from 'solid-js';
import type { JSX } from 'solid-js';
import {
  PANEL_WIDTH,
  PANEL_HEIGHT,
  HOVER_DELAY,
  HIDE_DELAY,
  BLOCKED_ROUTES,
  setPanelWidth,
  setPanelHeight,
  setHoverDelay,
  setHideDelay,
  setBlockedRoutes,
  resetAllSettings,
  DEFAULT_PANEL_WIDTH,
  DEFAULT_PANEL_HEIGHT,
  DEFAULT_HOVER_DELAY,
  DEFAULT_HIDE_DELAY,
} from './constants';

const FONT =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

const overlayStyle: JSX.CSSProperties = {
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
  'backdrop-filter': 'blur(4px)',
};

const modalStyle: JSX.CSSProperties = {
  background: '#1f1f23',
  border: '1px solid #323237',
  'border-radius': '12px',
  padding: '24px',
  width: '380px',
  'max-height': '80vh',
  'overflow-y': 'auto',
  color: '#efeff1',
  'font-family': FONT,
  'box-shadow': '0 16px 48px rgba(0, 0, 0, 0.8)',
};

const titleStyle: JSX.CSSProperties = {
  'font-size': '18px',
  'font-weight': '700',
  margin: '0 0 20px 0',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
};

const fieldStyle: JSX.CSSProperties = {
  'margin-bottom': '16px',
};

const labelStyle: JSX.CSSProperties = {
  display: 'block',
  'font-size': '12px',
  'font-weight': '600',
  color: '#adadb8',
  'margin-bottom': '6px',
  'text-transform': 'uppercase',
  'letter-spacing': '0.5px',
};

const inputStyle: JSX.CSSProperties = {
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
  transition: 'border-color 0.2s',
};

const textareaStyle: JSX.CSSProperties = {
  ...inputStyle,
  'min-height': '80px',
  resize: 'vertical',
};

const hintStyle: JSX.CSSProperties = {
  'font-size': '11px',
  color: '#71717a',
  'margin-top': '4px',
};

const btnRowStyle: JSX.CSSProperties = {
  display: 'flex',
  gap: '8px',
  'margin-top': '20px',
  'justify-content': 'flex-end',
};

const btnBase: JSX.CSSProperties = {
  padding: '8px 16px',
  'border-radius': '6px',
  border: 'none',
  'font-size': '13px',
  'font-weight': '600',
  'font-family': FONT,
  cursor: 'pointer',
  transition: 'background 0.2s',
};

const btnPrimary: JSX.CSSProperties = {
  ...btnBase,
  background: '#9147ff',
  color: '#fff',
};

const btnSecondary: JSX.CSSProperties = {
  ...btnBase,
  background: '#323237',
  color: '#efeff1',
};

const btnDanger: JSX.CSSProperties = {
  ...btnBase,
  background: 'transparent',
  color: '#e91916',
  padding: '8px 12px',
};

const closeBtnStyle: JSX.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#efeff1',
  cursor: 'pointer',
  padding: '4px',
  'border-radius': '6px',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
};

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel(props: SettingsPanelProps) {
  const [width, setWidth] = createSignal(String(PANEL_WIDTH()));
  const [height, setHeight] = createSignal(String(PANEL_HEIGHT()));
  const [hover, setHover] = createSignal(String(HOVER_DELAY()));
  const [hide, setHide] = createSignal(String(HIDE_DELAY()));
  const [routes, setRoutes] = createSignal(BLOCKED_ROUTES().join(', '));

  const handleSave = () => {
    const w = parseInt(width(), 10);
    const h = parseInt(height(), 10);
    const hov = parseInt(hover(), 10);
    const hid = parseInt(hide(), 10);

    if (!isNaN(w) && w >= 200 && w <= 1200) setPanelWidth(w);
    if (!isNaN(h) && h >= 150 && h <= 800) setPanelHeight(h);
    if (!isNaN(hov) && hov >= 0 && hov <= 5000) setHoverDelay(hov);
    if (!isNaN(hid) && hid >= 0 && hid <= 5000) setHideDelay(hid);

    const parsed = routes()
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    setBlockedRoutes(parsed);

    props.onClose();
  };

  const handleReset = () => {
    resetAllSettings();
    setWidth(String(DEFAULT_PANEL_WIDTH));
    setHeight(String(DEFAULT_PANEL_HEIGHT));
    setHover(String(DEFAULT_HOVER_DELAY));
    setHide(String(DEFAULT_HIDE_DELAY));
    setRoutes(BLOCKED_ROUTES().join(', '));
  };

  const handleOverlayClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) props.onClose();
  };

  const fields: Array<{
    label: string;
    value: () => string;
    setter: (v: string) => void;
    hint: string;
    type: 'number' | 'text';
  }> = [
    {
      label: 'Panel Width (px)',
      value: width,
      setter: setWidth,
      hint: `Min: 200, Max: 1200, Default: ${DEFAULT_PANEL_WIDTH}`,
      type: 'number',
    },
    {
      label: 'Panel Height (px)',
      value: height,
      setter: setHeight,
      hint: `Min: 150, Max: 800, Default: ${DEFAULT_PANEL_HEIGHT}`,
      type: 'number',
    },
    {
      label: 'Hover Delay (ms)',
      value: hover,
      setter: setHover,
      hint: `Time before preview appears. Default: ${DEFAULT_HOVER_DELAY}`,
      type: 'number',
    },
    {
      label: 'Hide Delay (ms)',
      value: hide,
      setter: setHide,
      hint: `Time before preview hides. Default: ${DEFAULT_HIDE_DELAY}`,
      type: 'number',
    },
  ];

  return (
    <div style={overlayStyle} onClick={handleOverlayClick}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={titleStyle}>
          <span>Settings</span>
          <button
            style={closeBtnStyle}
            onClick={props.onClose}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <For each={fields}>
          {(field) => (
            <div style={fieldStyle}>
              <label style={labelStyle}>{field.label}</label>
              <input
                type={field.type}
                style={inputStyle}
                value={field.value()}
                onInput={(e) => field.setter(e.currentTarget.value)}
                onFocus={(e) => {
                  e.currentTarget.style['border-color'] = '#9147ff';
                }}
                onBlur={(e) => {
                  e.currentTarget.style['border-color'] = '#323237';
                }}
              />
              <div style={hintStyle}>{field.hint}</div>
            </div>
          )}
        </For>

        <div style={fieldStyle}>
          <label style={labelStyle}>Blocked Routes</label>
          <textarea
            style={textareaStyle}
            value={routes()}
            onInput={(e) => setRoutes(e.currentTarget.value)}
            onFocus={(e) => {
              e.currentTarget.style['border-color'] = '#9147ff';
            }}
            onBlur={(e) => {
              e.currentTarget.style['border-color'] = '#323237';
            }}
          />
          <div style={hintStyle}>Comma-separated list of routes to ignore</div>
        </div>

        <div style={btnRowStyle}>
          <button
            style={btnDanger}
            onClick={handleReset}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(233, 25, 22, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            Reset Defaults
          </button>
          <div style={{ flex: 1 }} />
          <button
            style={btnSecondary}
            onClick={props.onClose}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#3f3f46';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#323237';
            }}
          >
            Cancel
          </button>
          <button
            style={btnPrimary}
            onClick={handleSave}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#772ce8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#9147ff';
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
