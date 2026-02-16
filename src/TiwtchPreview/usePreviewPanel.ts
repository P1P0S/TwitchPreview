import { createSignal, onCleanup } from 'solid-js';
import { PANEL_WIDTH, PANEL_HEIGHT, HOVER_DELAY } from './constants';
import {
  buildEmbedUrl,
  extractChannelLoginFromLink,
  findAnchorFromTarget,
  isSidebarChannelLink,
} from './utils';
import { useDrag } from './useDrag';
import { useTimers } from './useTimers';

export function usePreviewPanel() {
  const [getChannel, setChannel] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [isVisible, setIsVisible] = createSignal(false);
  const [isPinned, setIsPinned] = createSignal(false);

  let iframeEl: HTMLIFrameElement | null = null;
  let panelRef: HTMLDivElement | undefined;

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

  const showPanel = (login: string, linkRect: DOMRect) => {
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

  const onMouseOver = (ev: MouseEvent) => {
    const a = findAnchorFromTarget(ev.target);
    if (!a || !isSidebarChannelLink(a)) return;

    const login = extractChannelLoginFromLink(a);
    if (!login) return;

    timers.cancelHide();

    if (getChannel() === login) return;

    timers.setHoverTimer(() => {
      const rect = a.getBoundingClientRect();
      showPanel(login, rect);
    }, HOVER_DELAY);
  };

  const onMouseOut = (ev: MouseEvent) => {
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

  const handlePanelMouseEnter = () => {
    timers.cancelHide();
  };

  const handlePanelMouseLeave = () => {
    requestHide();
  };

  const handleDragStart = (e: MouseEvent) => {
    if (!panelRef) return;
    timers.cancelHide();
    drag.onDragStart(e, panelRef);
  };

  // Register global listeners
  window.addEventListener('mouseover', onMouseOver, true);
  window.addEventListener('mouseout', onMouseOut, true);

  onCleanup(() => {
    window.removeEventListener('mouseover', onMouseOver, true);
    window.removeEventListener('mouseout', onMouseOut, true);
    drag.cleanupDrag();
    timers.clearAllTimers();
    if (panelRef?.parentNode) {
      panelRef.parentNode.removeChild(panelRef);
    }
  });

  return {
    // Signals
    getChannel,
    isLoading,
    isVisible,
    isPinned,
    isDragging: drag.isDragging,

    // Refs
    setIframeRef: (el: HTMLIFrameElement) => {
      iframeEl = el;
    },
    setPanelRef: (el: HTMLDivElement) => {
      panelRef = el;
    },

    // Actions
    hidePanel,
    openInTwitch,
    togglePin,
    handlePanelMouseEnter,
    handlePanelMouseLeave,
    handleDragStart,
  };
}
