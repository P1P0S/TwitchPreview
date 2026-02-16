import { createSignal } from 'solid-js';
import { PANEL_WIDTH, PANEL_HEIGHT } from './constants';

export interface DragActions {
  isDragging: () => boolean;
  onDragStart: (e: MouseEvent, panelRef: HTMLDivElement) => void;
  cleanupDrag: () => void;
}

export function useDrag(onDragEndOutside: () => void): DragActions {
  const [isDragging, setIsDragging] = createSignal(false);

  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let currentPanelRef: HTMLDivElement | null = null;

  const onDragMove = (e: MouseEvent) => {
    if (!isDragging() || !currentPanelRef) return;
    e.preventDefault();

    let left = e.clientX - dragOffsetX;
    let top = e.clientY - dragOffsetY;

    left = Math.max(0, Math.min(window.innerWidth - PANEL_WIDTH, left));
    top = Math.max(0, Math.min(window.innerHeight - PANEL_HEIGHT, top));

    currentPanelRef.style.left = `${left}px`;
    currentPanelRef.style.top = `${top}px`;
  };

  const onDragEnd = (e: MouseEvent) => {
    if (!isDragging()) return;
    setIsDragging(false);

    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);

    if (currentPanelRef) {
      const rect = currentPanelRef.getBoundingClientRect();
      const isOutside =
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom;

      if (isOutside) {
        onDragEndOutside();
      }
    }
  };

  const onDragStart = (e: MouseEvent, panelRef: HTMLDivElement) => {
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

  return { isDragging, onDragStart, cleanupDrag };
}
