import type { ApiRequester } from '@/lib/api';
import type { GameCatalogResponse } from '@/lib/types';

export function loadGameCatalog(request: ApiRequester): Promise<GameCatalogResponse> {
  return request<GameCatalogResponse>('/game/list?inc=all&sort=1', { auth: false });
}
