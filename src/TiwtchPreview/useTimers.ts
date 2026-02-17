import { HIDE_DELAY } from './constants';

export interface TimerActions {
  scheduleHide: (callback: () => void) => void;
  cancelHide: () => void;
  setHoverTimer: (callback: () => void, delay: number) => void;
  cancelHover: () => void;
  clearAllTimers: () => void;
}

export function useTimers(): TimerActions {
  let hoverTimer: number | null = null;
  let hideTimer: number | null = null;

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

  const scheduleHide = (callback: () => void) => {
    cancelHide();
    hideTimer = window.setTimeout(() => {
      callback();
      hideTimer = null;
    }, HIDE_DELAY());
  };

  const setHoverTimer = (callback: () => void, delay: number) => {
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
    clearAllTimers,
  };
}
