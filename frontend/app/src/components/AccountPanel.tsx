import { LogIn, RotateCcw, Shield, UserPlus } from 'lucide-react';
import { formatMoney } from '@/lib/format';

interface AccountPanelProps {
  access: string;
  accessFlags: string;
  accessSummary: string;
  apiBase: string;
  clubId: number;
  email: string;
  hint: string;
  isDevelopment: boolean;
  mrtp: string;
  name: string;
  pending: { any: boolean; refresh: boolean; secret: boolean; signIn: boolean; signUp: boolean };
  profileRows: Array<{ label: string; value: string }>;
  secret: string;
  secretNew: string;
  secretOld: string;
  uid: number | null;
  wallet: number;
  onApiBaseChange: (value: string) => void;
  onClubIdChange: (value: number) => void;
  onEmailChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onRefresh: () => void;
  onSecretChange: (value: string) => void;
  onSecretNewChange: (value: string) => void;
  onSecretOldChange: (value: string) => void;
  onSignIn: () => void;
  onSignUp: () => void;
  onUpdateSecret: () => void;
}

export function AccountPanel(props: AccountPanelProps) {
  const { access, accessFlags, accessSummary, apiBase, clubId, email, hint, isDevelopment, mrtp, name, pending,
    profileRows, secret, secretNew, secretOld, uid, wallet, onApiBaseChange, onClubIdChange, onEmailChange,
    onNameChange, onRefresh, onSecretChange, onSecretNewChange, onSecretOldChange, onSignIn, onSignUp, onUpdateSecret } = props;

  return (
    <section className="panel panel--auth" id="profile" aria-busy={pending.any}>
      <div className="panel__head">
        <h2>Account</h2>
        <span className="panel__hint">{hint}</span>
      </div>
      {isDevelopment && (
        <label className="field">
          <span>API base</span>
          <input value={apiBase} onChange={(event) => onApiBaseChange(event.target.value)} type="text" spellCheck={false} />
        </label>
      )}
      <div className="split">
        <label className="field">
          <span>Email</span>
          <input value={email} onChange={(event) => onEmailChange(event.target.value)} type="email" spellCheck={false} autoComplete="username" />
        </label>
        <label className="field">
          <span>Password</span>
          <input value={secret} onChange={(event) => onSecretChange(event.target.value)} type="password" autoComplete="current-password" />
        </label>
      </div>
      <div className="split">
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(event) => onNameChange(event.target.value)} type="text" spellCheck={false} autoComplete="nickname" />
        </label>
        <label className="field">
          <span>Club</span>
          <input value={clubId} onChange={(event) => onClubIdChange(Math.max(1, Number(event.target.value || 1)))} type="number" min={1} step={1} />
        </label>
      </div>
      <div className="actions">
        <button className="btn btn--primary" type="button" onClick={onSignIn} disabled={pending.any}>
          <LogIn size={16} /><span>{pending.signIn ? 'Signing in…' : 'Sign in'}</span>
        </button>
        <button className="btn" type="button" onClick={onSignUp} disabled={pending.any}>
          <UserPlus size={16} /><span>{pending.signUp ? 'Signing up…' : 'Sign up'}</span>
        </button>
        <button className="btn" type="button" onClick={onRefresh} disabled={pending.any}>
          <RotateCcw size={16} /><span>{pending.refresh ? 'Refreshing…' : 'Refresh'}</span>
        </button>
      </div>
      <div className="account-card">
        <div className="account-card__title">Profile</div>
        <div className="account-card__grid">
          <div><div className="label">UID</div><div className="value">{uid ?? '-'}</div></div>
          <div><div className="label">Wallet</div><div className="value">{formatMoney(wallet)}</div></div>
          <div><div className="label">Access</div><div className="value">{access}</div></div>
          <div><div className="label">mRTP</div><div className="value">{mrtp}</div></div>
          <div><div className="label">Access flags</div><div className="value">{accessFlags}</div></div>
        </div>
      </div>
      <div className="status-strip">
        <div className="status-strip__label">Eligibility</div>
        <div className="status-strip__value">{accessSummary}</div>
      </div>
      <div className="secret-box">
        <div className="secret-box__title">Recovery / change secret</div>
        <div className="split">
          <label className="field"><span>Old secret</span><input value={secretOld} onChange={(event) => onSecretOldChange(event.target.value)} type="password" autoComplete="current-password" /></label>
          <label className="field"><span>New secret</span><input value={secretNew} onChange={(event) => onSecretNewChange(event.target.value)} type="password" autoComplete="new-password" /></label>
        </div>
        <div className="actions">
          <button className="btn btn--primary" type="button" onClick={onUpdateSecret} disabled={pending.any}>
            <Shield size={16} /><span>{pending.secret ? 'Updating…' : 'Update secret'}</span>
          </button>
          <div className="mini-note">The backend enforces the current secret unless the account has admin access.</div>
        </div>
      </div>
      <div className="mini-list">
        {profileRows.map((row) => (
          <div className="mini-item" key={row.label}>
            <div className="mini-item__top"><div className="mini-item__name">{row.label}</div></div>
            <div className="mini-item__meta">{row.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
