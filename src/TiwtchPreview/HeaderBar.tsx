import type { Accessor } from 'solid-js';
import {
  headerStyle,
  headerLeftStyle,
  liveDotStyle,
  channelNameStyle,
  liveBadgeStyle,
  buttonGroupStyle,
  iconButtonStyle,
  dragButtonStyle,
  applyHover,
  removeHover,
} from './styles';

interface HeaderBarProps {
  channel: Accessor<string | null>;
  isPinned: Accessor<boolean>;
  onDragStart: (e: MouseEvent) => void;
  onTogglePin: () => void;
  onOpenInTwitch: () => void;
  onClose: () => void;
}

function DragIcon() {
  return (
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
  );
}

function PinIcon(props: { filled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={props.filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      stroke-width="2"
    >
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
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
  );
}

function CloseIcon() {
  return (
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
  );
}

export function HeaderBar(props: HeaderBarProps) {
  return (
    <div style={headerStyle}>
      <div style={headerLeftStyle}>
        <div style={liveDotStyle} />
        <span style={channelNameStyle}>{props.channel()}</span>
        <span style={liveBadgeStyle}>LIVE</span>
      </div>

      <button
        onMouseDown={props.onDragStart}
        style={dragButtonStyle}
        onMouseEnter={applyHover}
        onMouseLeave={removeHover}
        title="Drag to move"
      >
        <DragIcon />
      </button>

      <div style={buttonGroupStyle}>
        <button
          onClick={props.onTogglePin}
          style={iconButtonStyle}
          onMouseEnter={applyHover}
          onMouseLeave={removeHover}
          title={props.isPinned() ? 'Unpin' : 'Pin'}
        >
          <PinIcon filled={props.isPinned()} />
        </button>

        <button
          onClick={props.onOpenInTwitch}
          style={iconButtonStyle}
          onMouseEnter={applyHover}
          onMouseLeave={removeHover}
          title="Open in new tab"
        >
          <ExternalLinkIcon />
        </button>

        <button
          onClick={props.onClose}
          style={iconButtonStyle}
          onMouseEnter={applyHover}
          onMouseLeave={removeHover}
          title="Close"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}
