import { BLOCKED_ROUTES } from './constants';

export function getTwitchParent(): string {
  return window.location.hostname;
}

export function buildEmbedUrl(channelLogin: string): string {
  const parent = encodeURIComponent(getTwitchParent());
  const ch = encodeURIComponent(channelLogin);
  return `https://player.twitch.tv/?channel=${ch}&parent=${parent}&muted=true&autoplay=true`;
}

export function extractChannelLoginFromLink(
  a: HTMLAnchorElement,
): string | null {
  const href = a.getAttribute('href');
  if (!href) return null;

  const clean = href.split('?')[0].split('#')[0];
  const parts = clean.split('/').filter(Boolean);
  if (!parts.length) return null;

  const login = parts[0];
  if (BLOCKED_ROUTES.has(login)) return null;
  if (!/^[a-z0-9_]{2,25}$/i.test(login)) return null;

  return login;
}

export function findAnchorFromTarget(
  target: EventTarget | null,
): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest('a[href^="/"]');
}

export function isSidebarChannelLink(a: HTMLAnchorElement): boolean {
  const nav = a.closest('nav');
  if (!nav) return false;
  const rect = nav.getBoundingClientRect();
  return rect.left < 80 && rect.width < 500;
}
