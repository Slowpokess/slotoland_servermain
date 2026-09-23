import type { ApiRequester } from '@/lib/api';
import type {
  BackofficeAuditEntry,
  BackofficeLedgerEntry,
  BackofficeRole,
  BackofficeSession,
  BackofficeUser,
} from '@/lib/types';

export interface BackofficeUserFilters {
  cid: number;
  alias: string;
  from: string;
  to: string;
}

export interface BackofficeUserSnapshot {
  user: BackofficeUser;
  ledger: BackofficeLedgerEntry[];
  sessions: BackofficeSession[];
  audit: BackofficeAuditEntry[];
}

export async function loadBackofficeRole(request: ApiRequester): Promise<BackofficeRole> {
  const payload = await request<{ role?: BackofficeRole }>('/backoffice/me');
  return payload.role || 'none';
}

export async function loadBackofficeUserSnapshot(
  request: ApiRequester,
  uid: number,
  filters: BackofficeUserFilters,
): Promise<BackofficeUserSnapshot> {
  const common = { uid, cid: filters.cid };
  const [user, ledger, sessions, audit] = await Promise.all([
    request<BackofficeUser>('/backoffice/users/get', { method: 'POST', body: common }),
    request<{ list?: BackofficeLedgerEntry[] }>('/backoffice/wallet/ledger', { method: 'POST', body: common }),
    request<{ list?: BackofficeSession[] }>('/backoffice/sessions/list', {
      method: 'POST',
      body: { ...common, alias: filters.alias, from: filters.from, to: filters.to },
    }),
    request<{ list?: BackofficeAuditEntry[] }>('/backoffice/audit/list', {
      method: 'POST',
      body: { uid },
    }),
  ]);

  return {
    user,
    ledger: ledger.list || [],
    sessions: sessions.list || [],
    audit: audit.list || [],
  };
}

export async function searchBackofficeUsers(
  request: ApiRequester,
  query: string,
  limit = 20,
): Promise<BackofficeUser[]> {
  const payload = await request<{ list?: BackofficeUser[] }>('/backoffice/users/search', {
    method: 'POST',
    body: { query, limit },
  });
  return payload.list || [];
}

export function runBackofficeOperation(
  request: ApiRequester,
  path: string,
  body: Record<string, unknown>,
  reason: string,
): Promise<unknown> {
  return request(path, {
    method: 'POST',
    body: { ...body, reason },
  });
}
