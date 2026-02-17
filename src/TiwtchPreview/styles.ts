import type { JSX } from 'solid-js';
import { PANEL_WIDTH, PANEL_HEIGHT } from './constants';

const FONT_STACK =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export function panelStyle(
  isVisible: boolean,
  isDragging: boolean,
  hasChannel: boolean,
): JSX.CSSProperties {
  return {
    position: 'fixed',
    'z-index': 999999,
    display: hasChannel ? 'block' : 'none',
    width: `${PANEL_WIDTH()}px`,
    height: `${PANEL_HEIGHT()}px`,
    background: '#18181b',
    border: '1px solid #323237',
    'border-radius': '12px',
    'box-shadow':
      '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)',
    padding: 0,
    'pointer-events': 'auto',
    overflow: 'hidden',
    'user-select': 'none',
    opacity: isVisible ? '1' : '0',
    transform: isVisible ? 'scale(1)' : 'scale(0.95)',
    transition: isDragging ? 'none' : 'opacity 0.2s ease, transform 0.2s ease',
  };
}

export const headerStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  padding: '10px 12px',
  background: 'linear-gradient(to bottom, #1f1f23, #18181b)',
  'border-bottom': '1px solid #323237',
};

export const headerLeftStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '8px',
  flex: 1,
  'min-width': 0,
};

export const liveDotStyle: JSX.CSSProperties = {
  width: '8px',
  height: '8px',
  'border-radius': '50%',
  background: '#ff4655',
  'box-shadow': '0 0 8px rgba(255, 70, 85, 0.6)',
  animation: 'pulse 2s ease-in-out infinite',
};

export const channelNameStyle: JSX.CSSProperties = {
  color: '#efeff1',
  'font-size': '14px',
  'font-weight': '600',
  'font-family': FONT_STACK,
  'white-space': 'nowrap',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
};

export const liveBadgeStyle: JSX.CSSProperties = {
  color: '#fff',
  'font-size': '10px',
  'font-weight': '700',
  'font-family': FONT_STACK,
  'text-transform': 'uppercase',
  background: '#e91916',
  padding: '2px 6px',
  'border-radius': '4px',
  'letter-spacing': '0.5px',
};

export const buttonGroupStyle: JSX.CSSProperties = {
  display: 'flex',
  gap: '6px',
};

export const iconButtonStyle: JSX.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#efeff1',
  cursor: 'pointer',
  padding: '4px 8px',
  'border-radius': '6px',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  transition: 'background 0.2s ease',
};

export const dragButtonStyle: JSX.CSSProperties = {
  ...iconButtonStyle,
  cursor: 'grab',
};

export const loaderOverlayStyle: JSX.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  'z-index': 10,
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  gap: '12px',
};

export const spinnerStyle: JSX.CSSProperties = {
  width: '32px',
  height: '32px',
  border: '3px solid rgba(145, 71, 255, 0.2)',
  'border-top-color': '#9147ff',
  'border-radius': '50%',
  animation: 'spin 0.8s linear infinite',
};

export const loaderTextStyle: JSX.CSSProperties = {
  color: '#efeff1',
  'font-size': '12px',
  'font-family': FONT_STACK,
};

export const iframeStyle: JSX.CSSProperties = {
  width: '100%',
  height: 'calc(100% - 40px)',
  border: 0,
  display: 'block',
  background: '#0e0e10',
};

export function applyHover(e: MouseEvent & { currentTarget: HTMLElement }) {
  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
}

export function removeHover(e: MouseEvent & { currentTarget: HTMLElement }) {
  e.currentTarget.style.background = 'transparent';
}

export { FONT_STACK };
