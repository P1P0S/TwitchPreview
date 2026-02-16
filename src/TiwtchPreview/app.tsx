import { createSignal, onCleanup, Show } from 'solid-js';
import { render } from 'solid-js/web';

const PANEL_WIDTH = 460;
const PANEL_HEIGHT = 290;
const HOVER_DELAY = 120;
const HIDE_DELAY = 300;

function getTwitchParent(): string {
  return window.location.hostname;
}

function buildEmbedUrl(channelLogin: string) {
  const parent = encodeURIComponent(getTwitchParent());
  const ch = encodeURIComponent(channelLogin);
  return `https://player.twitch.tv/?channel=${ch}&parent=${parent}&muted=true&autoplay=true`;
}

function extractChannelLoginFromLink(a: HTMLAnchorElement): string | null {
  const href = a.getAttribute('href');
  if (!href) return null;
  const clean = href.split('?')[0].split('#')[0];
  const parts = clean.split('/').filter(Boolean);
  if (!parts.length) return null;
  const login = parts[0];
  const blocked = new Set([
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
  ]);
  if (blocked.has(login)) return null;
  if (!/^[a-z0-9_]{2,25}$/i.test(login)) return null;
  return login;
}

function findAnchorFromTarget(
  target: EventTarget | null,
): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest('a[href^="/"]');
}

function isSidebarChannelLink(a: HTMLAnchorElement): boolean {
  const nav = a.closest('nav');
  if (!nav) return false;
  const rect = nav.getBoundingClientRect();
  return rect.left < 80 && rect.width < 500;
}

function App() {
  const [getChannel, setChannel] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [isVisible, setIsVisible] = createSignal(false);
  const [isPinned, setIsPinned] = createSignal(false);
  const [isDragging, setIsDragging] = createSignal(false);

  let iframeEl: HTMLIFrameElement | null = null;
  let hoverTimer: number | null = null;
  let hideTimer: number | null = null;
  let panelRef: HTMLDivElement | undefined;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

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

  const onMouseOver = (ev: MouseEvent) => {
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

  const onMouseOut = (ev: MouseEvent) => {
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

  const onDragStart = (e: MouseEvent) => {
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

  const onDragMove = (e: MouseEvent) => {
    if (!isDragging() || !panelRef) return;
    e.preventDefault();
    let left = e.clientX - dragOffsetX;
    let top = e.clientY - dragOffsetY;

    left = Math.max(0, Math.min(window.innerWidth - PANEL_WIDTH, left));
    top = Math.max(0, Math.min(window.innerHeight - PANEL_HEIGHT, top));

    panelRef.style.left = `${left}px`;
    panelRef.style.top = `${top}px`;
  };

  const onDragEnd = (e: MouseEvent) => {
    if (!isDragging()) return;
    setIsDragging(false);
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);

    if (!isPinned() && panelRef) {
      const rect = panelRef.getBoundingClientRect();
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
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
    if (panelRef?.parentNode) {
      panelRef.parentNode.removeChild(panelRef);
    }
  });

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        'z-index': 999999,
        display: getChannel() ? 'block' : 'none',
        width: `${PANEL_WIDTH}px`,
        height: `${PANEL_HEIGHT}px`,
        background: '#18181b',
        border: '1px solid #323237',
        'border-radius': '12px',
        'box-shadow':
          '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        padding: 0,
        'pointer-events': 'auto',
        overflow: 'hidden',
        opacity: isVisible() ? '1' : '0',
        transform: isVisible() ? 'scale(1)' : 'scale(0.95)',
        transition: isDragging()
          ? 'none'
          : 'opacity 0.2s ease, transform 0.2s ease',
      }}
      onMouseEnter={() => {
        if (hideTimer) {
          window.clearTimeout(hideTimer);
          hideTimer = null;
        }
      }}
      onMouseLeave={() => {
        scheduleHide();
      }}
    >
      <div
        style={{
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'space-between',
          padding: '10px 12px',
          background: 'linear-gradient(to bottom, #1f1f23, #18181b)',
          'border-bottom': '1px solid #323237',
        }}
      >
        <div
          style={{
            display: 'flex',
            'align-items': 'center',
            gap: '8px',
            flex: 1,
            'min-width': 0,
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              'border-radius': '50%',
              background: '#ff4655',
              'box-shadow': '0 0 8px rgba(255, 70, 85, 0.6)',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          />
          <span
            style={{
              color: '#efeff1',
              'font-size': '14px',
              'font-weight': '600',
              'font-family':
                'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              'white-space': 'nowrap',
              overflow: 'hidden',
              'text-overflow': 'ellipsis',
            }}
          >
            {getChannel()}
          </span>
          <span
            style={{
              color: '#fff',
              'font-size': '10px',
              'font-weight': '700',
              'font-family':
                'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              'text-transform': 'uppercase',
              background: '#e91916',
              padding: '2px 6px',
              'border-radius': '4px',
              'letter-spacing': '0.5px',
            }}
          >
            LIVE
          </span>
        </div>

        {/* Drag handle button */}
        <button
          onMouseDown={onDragStart}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#efeff1',
            cursor: 'grab',
            padding: '4px 8px',
            'border-radius': '6px',
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'center',
            transition: 'background 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
          title="Drag to move"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="12" cy="5" r="1" />
            <circle cx="19" cy="5" r="1" />
            <circle cx="5" cy="5" r="1" />
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
            <circle cx="12" cy="19" r="1" />
            <circle cx="19" cy="19" r="1" />
            <circle cx="5" cy="19" r="1" />
          </svg>
        </button>

        <div
          style={{
            display: 'flex',
            gap: '6px',
          }}
        >
          <button
            onClick={togglePin}
            style={{
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
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            title={isPinned() ? 'Unpin' : 'Pin'}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill={isPinned() ? 'currentColor' : 'none'}
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M12 17v5" />
              <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
            </svg>
          </button>
          <button
            onClick={openInTwitch}
            style={{
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
              'font-size': '12px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            title="Open in new tab"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M15 3h6v6" />
              <path d="M10 14 21 3" />
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            </svg>
          </button>
          <button
            onClick={hidePanel}
            style={{
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
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            title="Close"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="m15 9-6 6" />
              <path d="m9 9 6 6" />
            </svg>
          </button>
        </div>
      </div>

      <Show when={isLoading()}>
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            'z-index': 10,
            display: 'flex',
            'flex-direction': 'column',
            'align-items': 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              border: '3px solid rgba(145, 71, 255, 0.2)',
              'border-top-color': '#9147ff',
              'border-radius': '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span
            style={{
              color: '#efeff1',
              'font-size': '12px',
              'font-family':
                'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            Carregando...
          </span>
        </div>
      </Show>

      <iframe
        ref={(el) => (iframeEl = el)}
        allow="autoplay; fullscreen"
        allowfullscreen
        loading="eager"
        style={{
          width: '100%',
          height: 'calc(100% - 40px)',
          border: 0,
          display: 'block',
          background: '#0e0e10',
        }}
      />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const root = document.createElement('div');
document.body.appendChild(root);
render(() => <App />, root);
