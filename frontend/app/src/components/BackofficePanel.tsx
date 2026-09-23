import { Search } from 'lucide-react';
import { formatMoney } from '@/lib/format';
import type { BackofficeAuditEntry, BackofficeLedgerEntry, BackofficeRole, BackofficeSession, BackofficeUser } from '@/lib/types';

interface BackofficePanelProps {
  alias: string;
  amount: number;
  audit: BackofficeAuditEntry[];
  busy: boolean;
  clubId: number;
  from: string;
  ledger: BackofficeLedgerEntry[];
  loadingUser: boolean;
  mutating: boolean;
  query: string;
  reason: string;
  role: BackofficeRole;
  searching: boolean;
  selectedUser: BackofficeUser | null;
  sessions: BackofficeSession[];
  to: string;
  users: BackofficeUser[];
  onAliasChange: (value: string) => void;
  onAmountChange: (value: number) => void;
  onFromChange: (value: string) => void;
  onLoadUser: (user: BackofficeUser) => void;
  onMutate: (path: string, body: Record<string, unknown>, title: string) => void;
  onQueryChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  onSearch: () => void;
  onToChange: (value: string) => void;
}

export function BackofficePanel(props: BackofficePanelProps) {
  const { alias, amount, audit, busy, clubId, from, ledger, loadingUser, mutating, query, reason, role, searching,
    selectedUser, sessions, to, users, onAliasChange, onAmountChange, onFromChange, onLoadUser, onMutate,
    onQueryChange, onReasonChange, onSearch, onToChange } = props;

  return (
    <section className="panel panel--backoffice" id="backoffice" aria-busy={busy}>
      <div className="panel__head"><h2>Backoffice</h2><span className="panel__hint">{role}</span></div>
      <div className="search-row">
        <label className="field field--inline">
          <span>User search</span>
          <div className="search-input"><Search size={15} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="UID, email, name" /></div>
        </label>
        <button className="btn btn--primary" type="button" onClick={onSearch} disabled={busy}>{searching ? 'Searching…' : 'Search'}</button>
      </div>
      {users.length > 0 && (
        <div className="backoffice-users">
          {users.map((user) => (
            <button className={`backoffice-user ${selectedUser?.uid === user.uid ? 'is-selected' : ''}`} type="button" key={user.uid} onClick={() => onLoadUser(user)} disabled={busy}>
              <span>{user.name || user.email}</span><span className="label">UID {user.uid} · {user.email}</span>
            </button>
          ))}
        </div>
      )}
      {selectedUser ? (
        <div className="backoffice-detail">
          <div className="stats">
            <div className="stat"><div className="label">User</div><div className="value">{selectedUser.name || selectedUser.email}</div></div>
            <div className="stat"><div className="label">Wallet</div><div className="value">{formatMoney(selectedUser.wallet || 0)}</div></div>
            <div className="stat"><div className="label">Status</div><div className="value">{selectedUser.status & 4 ? 'Blocked' : 'Active'}</div></div>
          </div>
          {(role === 'operator' || role === 'admin') && (
            <div className="backoffice-actions">
              <label className="field"><span>Operator reason</span><input value={reason} onChange={(event) => onReasonChange(event.target.value)} placeholder="Required for every action" /></label>
              <div className="split">
                <label className="field"><span>Amount</span><input value={amount} onChange={(event) => onAmountChange(Number(event.target.value || 0))} type="number" step="0.01" /></label>
                <div className="actions actions--operator">
                  <button className="btn" type="button" disabled={busy} onClick={() => onMutate('/backoffice/wallet/bonus', { uid: selectedUser.uid, cid: clubId, amount }, 'Bonus granted')}>Bonus</button>
                  <button className="btn" type="button" disabled={busy} onClick={() => onMutate('/backoffice/wallet/adjust', { uid: selectedUser.uid, cid: clubId, amount }, 'Balance adjusted')}>Adjust</button>
                  <button className="btn" type="button" disabled={busy} onClick={() => onMutate('/backoffice/users/status', { uid: selectedUser.uid, blocked: !(selectedUser.status & 4) }, selectedUser.status & 4 ? 'User unblocked' : 'User blocked')}>
                    {mutating ? 'Working…' : selectedUser.status & 4 ? 'Unblock' : 'Block'}
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="backoffice-session-filter">
            <label className="field"><span>Game alias</span><input value={alias} onChange={(event) => onAliasChange(event.target.value)} placeholder="provider/game" /></label>
            <label className="field"><span>From (UTC)</span><input value={from} onChange={(event) => onFromChange(event.target.value)} placeholder="2026-07-14T00:00:00Z" /></label>
            <label className="field"><span>To (UTC)</span><input value={to} onChange={(event) => onToChange(event.target.value)} placeholder="2026-07-14T23:59:59Z" /></label>
            <button className="btn" type="button" onClick={() => onLoadUser(selectedUser)} disabled={busy}>{loadingUser ? 'Loading…' : 'Filter sessions'}</button>
          </div>
          <div className="backoffice-columns">
            <div className="backoffice-list">
              <h3>Wallet ledger</h3>
              {ledger.length ? ledger.map((entry) => <div className="ledger-item" key={entry.id}><div className="ledger-item__top"><span>{entry.op}</span><span>{formatMoney(entry.amount)}</span></div><div className="ledger-item__meta">{entry.balance_before} → {entry.balance_after} · actor {entry.actor_uid}</div></div>) : <div className="empty-state">No ledger entries.</div>}
            </div>
            <div className="backoffice-list">
              <h3>Sessions</h3>
              {sessions.length ? sessions.map((entry) => <div className="ledger-item" key={entry.gid}><div className="ledger-item__top"><span>{entry.alias}</span><span>GID {entry.gid}</span></div><div className="ledger-item__meta">{entry.closed ? 'Closed' : 'Open'} · {entry.ctime}</div></div>) : <div className="empty-state">No sessions.</div>}
            </div>
            <div className="backoffice-list">
              <h3>Operator audit</h3>
              {audit.length ? audit.map((entry) => <div className="ledger-item" key={entry.id}><div className="ledger-item__top"><span>{entry.action}</span><span>actor {entry.actor_uid}</span></div><div className="ledger-item__meta">{entry.reason}</div></div>) : <div className="empty-state">No operator actions.</div>}
            </div>
          </div>
        </div>
      ) : <div className="empty-state">Search for a user to open their support case.</div>}
    </section>
  );
}
