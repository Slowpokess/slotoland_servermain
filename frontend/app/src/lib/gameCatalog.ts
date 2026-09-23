import type { GameInfo } from '@/lib/types';

export function normalizeText(value: string): string {
  return String(value || '').trim().toLowerCase();
}

export function gameAlias(game: GameInfo): string {
  return `${normalizeText(game.Prov || game.prov || '')}/${normalizeText(game.Name || game.name || '')}`;
}

export function gameTypeLabel(game: GameInfo): string {
  const gt = Number(game.GT || game.GP || 0);
  if (gt === 2) return 'keno';
  if (gt === 1) return 'slot';
  return 'game';
}

export function gameShape(game: GameInfo): string {
  const sx = Number(game.SX || 0);
  const sy = Number(game.SY || 0);
  return sx && sy ? `${sx}x${sy}` : 'shape n/a';
}

export function renderRtpLabel(game: GameInfo): string {
  const rtp = game.RTP || [];
  if (!Array.isArray(rtp) || !rtp.length) return '';
  const first = Number(rtp[0]).toFixed(2);
  const last = Number(rtp[rtp.length - 1]).toFixed(2);
  return first === last ? `${first}% RTP` : `${first}%-${last}% RTP`;
}
