export interface GameAlias {
  Prov?: string;
  Name?: string;
  Date?: string;
  prov?: string;
  name?: string;
  date?: string;
}

export interface AlgDescr {
  GT?: number;
  GP?: number;
  SX?: number;
  SY?: number;
  SN?: number;
  LN?: number;
  WN?: number;
  BN?: number;
  RTP?: number[];
}

export interface GameInfo extends GameAlias, AlgDescr {}

export interface AuthResponse {
  uid?: number;
  email?: string;
  access?: string;
  refresh?: string;
  refrsh?: string;
  expire?: number;
  living?: boolean;
}

export interface UserItem {
  uid?: number;
  email?: string;
  name?: string;
}

export interface UserListResponse {
  list?: UserItem[];
}

export interface PropResponse {
  wallet?: number;
  access?: string | number;
  mrtp?: string | number;
}

export interface WalletResponse {
  wallet?: number;
}

export interface GameCatalogResponse {
  list?: GameInfo[];
  algnum?: number;
  prvnum?: number;
}

export interface SessionResponse {
  gid?: number;
  sid?: number;
  state?: string;
  wallet?: number;
  game?: unknown;
  jpfund?: number;
  wins?: number;
}

export interface ActivityItem {
  kind: string;
  title: string;
  detail: string;
  tone: 'info' | 'success' | 'warn' | 'error';
  at: string;
}

export interface GameSession {
  gid: number;
  gameType?: 'slot' | 'keno';
  state?: string;
  game?: unknown;
  wallet: number;
}

export type BackofficeRole = 'none' | 'support' | 'operator' | 'admin';

export interface BackofficeUser {
  uid: number;
  email: string;
  name?: string;
  status: number;
  cid?: number;
  wallet?: number;
  access?: number;
  mrtp?: number;
}

export interface BackofficeLedgerEntry {
  id: number;
  ctime: string;
  actor_uid: number;
  op: string;
  amount: number;
  balance_before: number;
  balance_after: number;
}

export interface BackofficeSession {
  gid: number;
  alias: string;
  ctime: string;
  closed: boolean;
  xtime?: string;
}

export interface BackofficeAuditEntry {
  id: number;
  ctime: string;
  actor_uid: number;
  action: string;
  reason: string;
  ledger_id?: number;
}
