import type { ApiRequester } from '@/lib/api';
import type { SessionResponse } from '@/lib/types';

export interface OpenGameInput {
  cid: number;
  uid: number;
  alias: string;
}

export interface SpinGameInput {
  gid: number;
  bet: number;
  selection: number | number[];
  gameType: 'slot' | 'keno';
}

export function openGame(request: ApiRequester, input: OpenGameInput): Promise<SessionResponse> {
  return request<SessionResponse>('/game/new', {
    method: 'POST',
    body: input,
  });
}

export function spinGame(request: ApiRequester, input: SpinGameInput): Promise<SessionResponse> {
  return request<SessionResponse>(input.gameType === 'keno' ? '/keno/spin' : '/slot/spin', {
    method: 'POST',
    body: {
      gid: input.gid,
      bet: input.bet,
      sel: input.selection,
    },
  });
}

export function doubleGame(request: ApiRequester, gid: number, mult: number): Promise<SessionResponse> {
  return request<SessionResponse>('/slot/doubleup', {
    method: 'POST',
    body: { gid, mult },
  });
}

export function collectGame(request: ApiRequester, gid: number): Promise<SessionResponse> {
  return request<SessionResponse>('/slot/collect', {
    method: 'POST',
    body: { gid },
  });
}
