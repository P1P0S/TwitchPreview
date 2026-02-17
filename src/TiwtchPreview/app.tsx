import { Show } from 'solid-js';
import { render } from 'solid-js/web';
import { usePreviewPanel } from './usePreviewPanel';
import { HeaderBar } from './HeaderBar';
import { SettingsPanel } from './SettingsPanel';
import {
  panelStyle,
  loaderOverlayStyle,
  spinnerStyle,
  loaderTextStyle,
  iframeStyle,
} from './styles';

function App() {
  const panel = usePreviewPanel();

  return (
    <>
      <div
        ref={panel.setPanelRef}
        style={panelStyle(
          panel.isVisible(),
          panel.isDragging(),
          !!panel.getChannel(),
        )}
        onMouseEnter={panel.handlePanelMouseEnter}
        onMouseLeave={panel.handlePanelMouseLeave}
      >
        <HeaderBar
          channel={panel.getChannel}
          isPinned={panel.isPinned}
          onDragStart={panel.handleDragStart}
          onTogglePin={panel.togglePin}
          onOpenSettings={panel.toggleSettings}
          onOpenInTwitch={panel.openInTwitch}
          onClose={panel.hidePanel}
        />

        <Show when={panel.isLoading()}>
          <div style={loaderOverlayStyle}>
            <div style={spinnerStyle} />
            <span style={loaderTextStyle}>Loading...</span>
          </div>
        </Show>

        <iframe
          ref={panel.setIframeRef}
          allow="autoplay; fullscreen"
          allowfullscreen
          loading="eager"
          style={iframeStyle}
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

      <Show when={panel.showSettings()}>
        <SettingsPanel onClose={panel.toggleSettings} />
      </Show>
    </>
  );
}

const root = document.createElement('div');
document.body.appendChild(root);
render(() => <App />, root);
