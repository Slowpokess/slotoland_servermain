import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Filter, Gamepad2, LogIn, Play, RefreshCcw, RotateCcw, Search, ServerCog, Shield, Sparkles, Trash2, UserPlus, WalletCards } from 'lucide-react';
import { requestJson, HttpError, normalizeBase } from '@/lib/api';
import { loadJson, loadNumber, loadSessionString, loadString, removeString, saveJson, saveSessionString, saveString } from '@/lib/storage';
import type { ApiRequestOptions } from '@/lib/api';
import type { AuthResponse, BackofficeAuditEntry, BackofficeLedgerEntry, BackofficeRole, BackofficeSession, BackofficeUser, GameCatalogResponse, GameInfo, GameSession, PropResponse, SessionResponse, UserListResponse, WalletResponse } from '@/lib/types';
import type { ActivityItem } from '@/lib/types';

const DEFAULT_API = import.meta.env.DEV ? 'http://localhost:8080' : window.location.origin;
const DEFAULT_CLUB = 1;
const QUICK_FILTERS = ['all', 'slot', 'keno', 'novomatic', 'netent', 'playngo', 'playtech', 'ct', 'megajack'];
const SYMBOLS: Record<number, string> = {
  1: 'A',
  2: 'K',
  3: 'Q',
  4: 'J',
  5: '10',
  6: '9',
  7: '7',
  8: '★',
  9: '♦',
  10: '♣',
  11: '♥',
  12: '✦',
};

const STORAGE = {
  apiBase: 'slotopol.apiBase',
  email: 'slotopol.email',
  name: 'slotopol.name',
  uid: 'slotopol.uid',
  clubId: 'slotopol.clubId',
  access: 'slotopol.access',
  refresh: 'slotopol.refresh',
  selectedAlias: 'slotopol.selectedAlias',
  activity: 'slotopol.activity',
} as const;

const LEGACY_SECRET_STORAGE_KEY = 'slotopol.secret';

function gameAlias(game: GameInfo): string {
  return `${normalizeText(game.Prov || game.prov || '')}/${normalizeText(game.Name || game.name || '')}`;
}

function gameTypeLabel(game: GameInfo): string {
  const gt = Number(game.GT || game.GP || 0);
  if (gt === 2) return 'keno';
  if (gt === 1) return 'slot';
  return 'game';
}

function gameShape(game: GameInfo): string {
  const sx = Number(game.SX || 0);
  const sy = Number(game.SY || 0);
  return sx && sy ? `${sx}x${sy}` : 'shape n/a';
}

function renderRtpLabel(game: GameInfo): string {
  const rtp = game.RTP || [];
  if (!Array.isArray(rtp) || !rtp.length) return '';
  const first = Number(rtp[0]).toFixed(2);
  const last = Number(rtp[rtp.length - 1]).toFixed(2);
  return first === last ? `${first}% RTP` : `${first}%-${last}% RTP`;
}

function formatMoney(value: number): string {
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeText(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function timeAgo(iso: string): string {
  const seconds = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

function normalizeScreen(screen: unknown): unknown[][] {
  if (!screen) return [];
  if (Array.isArray(screen) && Array.isArray(screen[0])) return screen as unknown[][];
  if (Array.isArray(screen)) return [screen as unknown[]];
  if (typeof screen === 'object' && screen !== null) {
    const value = screen as { rows?: unknown; screen?: unknown };
    if (Array.isArray(value.rows)) return value.rows as unknown[][];
    if (Array.isArray(value.screen)) return normalizeScreen(value.screen);
  }
  return [];
}

function extractScreen(payload: SessionResponse): unknown {
  const game = payload.game as { screen?: unknown; rows?: unknown } | undefined;
  return game?.screen || payload.game || game?.rows || [];
}

function isKenoGame(game: GameInfo | null): boolean {
  return Number(game?.GT || game?.GP || 0) === 2;
}

function gameMeta(game: GameInfo | null, clubId: number, wallet: number, gid?: number): string {
  if (!game) return 'Open a session from the lobby.';
  const bits = [gameShape(game), gameTypeLabel(game), renderRtpLabel(game), `Club ${clubId}`];
  if (gid) bits.push(`GID ${gid}`);
  bits.push(`Wallet ${formatMoney(wallet)}`);
  return bits.filter(Boolean).join(' · ');
}

function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

function parseKenoSelections(value: string): number[] {
  const picks = value
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map(Number);

  if (picks.some((pick) => !Number.isInteger(pick) || pick < 1 || pick > 80)) {
    return [];
  }
  return [...new Set(picks)];
}

export function App() {
  const [apiBase, setApiBase] = useState(loadString(STORAGE.apiBase, DEFAULT_API));
  const [email, setEmail] = useState(loadString(STORAGE.email, 'player@example.org'));
  const [secret, setSecret] = useState('');
  const [name, setName] = useState(loadString(STORAGE.name, 'Player'));
  const [uid, setUid] = useState<number | null>(loadNumber(STORAGE.uid, 0) || null);
  const [clubId, setClubId] = useState(loadNumber(STORAGE.clubId, DEFAULT_CLUB) || DEFAULT_CLUB);
  const [accessToken, setAccessToken] = useState(loadSessionString(STORAGE.access, ''));
  const [refreshToken, setRefreshToken] = useState(loadSessionString(STORAGE.refresh, ''));
  const [selectedAlias, setSelectedAlias] = useState(loadString(STORAGE.selectedAlias, ''));
  const [selectedGame, setSelectedGame] = useState<GameInfo | null>(null);
  const [currentSession, setCurrentSession] = useState<GameSession | null>(null);
  const [games, setGames] = useState<GameInfo[]>([]);
  const [providerFilter, setProviderFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [activity, setActivity] = useState<ActivityItem[]>(loadJson<ActivityItem[]>(STORAGE.activity, []));
  const [wallet, setWallet] = useState(0);
  const [access, setAccess] = useState<string>('-');
  const [mrtp, setMrtp] = useState<string>('-');
  const [serverStatus, setServerStatus] = useState('unknown');
  const [serverTone, setServerTone] = useState<'info' | 'ok' | 'warn' | 'bad'>('info');
  const [authLabel, setAuthLabel] = useState('Signed out');
  const [accountHint, setAccountHint] = useState('Local first');
  const [gameCount, setGameCount] = useState('0 games');
  const [algCount, setAlgCount] = useState('-');
  const [provCount, setProvCount] = useState('-');
  const [sessionState, setSessionState] = useState('No session');
  const [accessFlags, setAccessFlags] = useState('-');
  const [secretOld, setSecretOld] = useState('');
  const [secretNew, setSecretNew] = useState('');
  const [bet, setBet] = useState(1);
  const [sel, setSel] = useState(1);
  const [kenoPicks, setKenoPicks] = useState('');
  const [mult, setMult] = useState(2);
  const [welcomeClaimedAt, setWelcomeClaimedAt] = useState(loadString('slotopol.welcomeClaimedAt', ''));
  const [dailyClaimedAt, setDailyClaimedAt] = useState(loadString('slotopol.dailyClaimedAt', ''));
  const [backofficeRole, setBackofficeRole] = useState<BackofficeRole>('none');
  const [backofficeQuery, setBackofficeQuery] = useState('');
  const [backofficeUsers, setBackofficeUsers] = useState<BackofficeUser[]>([]);
  const [backofficeUser, setBackofficeUser] = useState<BackofficeUser | null>(null);
  const [backofficeLedger, setBackofficeLedger] = useState<BackofficeLedgerEntry[]>([]);
  const [backofficeSessions, setBackofficeSessions] = useState<BackofficeSession[]>([]);
  const [backofficeAudit, setBackofficeAudit] = useState<BackofficeAuditEntry[]>([]);
  const [backofficeReason, setBackofficeReason] = useState('');
  const [backofficeAmount, setBackofficeAmount] = useState(0);
  const [backofficeAlias, setBackofficeAlias] = useState('');
  const [backofficeFrom, setBackofficeFrom] = useState('');
  const [backofficeTo, setBackofficeTo] = useState('');
  const apiStateRef = useRef({
    baseUrl: normalizeBase(apiBase),
    accessToken,
    refreshToken,
  });

  useEffect(() => { saveString(STORAGE.apiBase, apiBase); }, [apiBase]);
  useEffect(() => { saveString(STORAGE.email, email); }, [email]);
  useEffect(() => { saveString(STORAGE.name, name); }, [name]);
  useEffect(() => { saveString(STORAGE.uid, String(uid || '')); }, [uid]);
  useEffect(() => { saveString(STORAGE.clubId, String(clubId)); }, [clubId]);
  useEffect(() => { saveSessionString(STORAGE.access, accessToken); }, [accessToken]);
  useEffect(() => { saveSessionString(STORAGE.refresh, refreshToken); }, [refreshToken]);
  useEffect(() => { saveString(STORAGE.selectedAlias, selectedAlias); }, [selectedAlias]);
  useEffect(() => { saveJson(STORAGE.activity, activity.slice(0, 50)); }, [activity]);
  useEffect(() => { saveString('slotopol.welcomeClaimedAt', welcomeClaimedAt); }, [welcomeClaimedAt]);
  useEffect(() => { saveString('slotopol.dailyClaimedAt', dailyClaimedAt); }, [dailyClaimedAt]);
  useEffect(() => {
    // Remove credentials persisted by earlier frontend builds. Passwords are
    // intentionally kept only in component memory for the current page.
    removeString(LEGACY_SECRET_STORAGE_KEY);
    removeString(STORAGE.access);
    removeString(STORAGE.refresh);
  }, []);
  useEffect(() => {
    apiStateRef.current = {
      baseUrl: normalizeBase(apiBase),
      accessToken,
      refreshToken,
    };
  }, [apiBase, accessToken, refreshToken]);

  const providerOptions = useMemo(() => {
    const providers = [...new Set(games.map((game) => normalizeText(game.Prov || game.prov || '')))].filter(Boolean);
    return ['all', ...providers];
  }, [games]);

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      const provider = normalizeText(game.Prov || game.prov || '');
      const nameValue = normalizeText(game.Name || game.name || '');
      const alias = normalizeText(gameAlias(game));
      const matchProvider =
        providerFilter === 'all' ||
        provider === providerFilter ||
        (providerFilter === 'ct' && provider.includes('ct'));
      const query = search.trim().toLowerCase();
      const matchSearch = !query || provider.includes(query) || nameValue.includes(query) || alias.includes(query);
      return matchProvider && matchSearch;
    });
  }, [games, providerFilter, search]);

  const addActivity = useCallback((kind: string, title: string, detail = '', tone: ActivityItem['tone'] = 'info') => {
    setActivity((current) => [
      { kind, title, detail, tone, at: new Date().toISOString() },
      ...current,
    ].slice(0, 40));
  }, []);

  const claimWelcomeBonus = useCallback(() => {
    if (!welcomeClaimedAt) {
      const stamp = new Date().toISOString();
      setWelcomeClaimedAt(stamp);
      addActivity('retention', 'Welcome bonus surfaced', 'Local onboarding marker saved.', 'success');
    }
  }, [addActivity, welcomeClaimedAt]);

  const claimDailyReward = useCallback(() => {
    const stamp = new Date().toISOString();
    const today = stamp.slice(0, 10);
    if (dailyClaimedAt.slice(0, 10) !== today) {
      setDailyClaimedAt(stamp);
      addActivity('retention', 'Daily reward checked in', `Local stamp saved for ${today}.`, 'success');
    }
  }, [addActivity, dailyClaimedAt]);

  const applyAuth = useCallback((payload: AuthResponse) => {
    const nextUid = Number(payload.uid || uid || 0) || null;
    const nextEmail = payload.email || email;
    const nextAccess = payload.access || '';
    const nextRefresh = payload.refresh || payload.refrsh || '';

    apiStateRef.current = {
      baseUrl: normalizeBase(apiBase),
      accessToken: nextAccess,
      refreshToken: nextRefresh,
    };
    setUid(nextUid);
    setEmail(nextEmail || '');
    setAccessToken(nextAccess);
    setRefreshToken(nextRefresh);
    setAuthLabel(`UID ${nextUid || '-'} · ${nextEmail || '-'}`);
  }, [apiBase, email, uid]);

  const requestRaw = useCallback(async <T,>(
    path: string,
    options: ApiRequestOptions = {},
  ): Promise<T> => {
    const { baseUrl, accessToken: nextAccessToken, refreshToken: nextRefreshToken } = apiStateRef.current;
    return requestJson<T>(baseUrl, path, {
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
    }, options);
  }, []);

  const refreshTokens = useCallback(async (silent = false) => {
    const { refreshToken: nextRefreshToken } = apiStateRef.current;
    if (!nextRefreshToken) {
      if (!silent) addActivity('auth', 'Refresh skipped', 'No refresh token stored', 'warn');
      return false;
    }

    try {
      const payload = await requestRaw<AuthResponse>('/refresh', {
        method: 'GET',
        tokenType: 'refresh',
      });
      applyAuth(payload);
      if (!silent) addActivity('auth', 'Session refreshed', payload.email || email, 'success');
      return true;
    } catch (error) {
      if (!silent) addActivity('error', 'Refresh failed', errorMessage(error), 'error');
      return false;
    }
  }, [addActivity, applyAuth, email, requestRaw]);

  const requestApi = useCallback(async <T,>(
    path: string,
    options: ApiRequestOptions = {},
  ): Promise<T> => {
    try {
      return await requestRaw<T>(path, options);
    } catch (error) {
      if (
        isHttpError(error) &&
        error.status === 401 &&
        options.auth !== false &&
        options.tokenType !== 'refresh' &&
        apiStateRef.current.refreshToken
      ) {
        const refreshed = await refreshTokens(true);
        if (refreshed) {
          return requestRaw<T>(path, options);
        }
      }
      throw error;
    }
  }, [refreshTokens, requestRaw]);

  const loadBackofficeRole = useCallback(async () => {
    if (!apiStateRef.current.accessToken) {
      setBackofficeRole('none');
      return;
    }
    try {
      const payload = await requestApi<{ role?: BackofficeRole }>('/backoffice/me');
      setBackofficeRole(payload.role || 'none');
    } catch (error) {
      if (isHttpError(error) && (error.status === 401 || error.status === 403)) {
        setBackofficeRole('none');
        return;
      }
      addActivity('error', 'Backoffice check failed', errorMessage(error), 'error');
    }
  }, [addActivity, requestApi]);

  const loadBackofficeUser = useCallback(async (targetUid: number) => {
    const [detail, ledger, sessions, audit] = await Promise.all([
      requestApi<BackofficeUser>('/backoffice/users/get', { method: 'POST', body: { uid: targetUid, cid: clubId } }),
      requestApi<{ list?: BackofficeLedgerEntry[] }>('/backoffice/wallet/ledger', { method: 'POST', body: { uid: targetUid, cid: clubId } }),
      requestApi<{ list?: BackofficeSession[] }>('/backoffice/sessions/list', {
        method: 'POST', body: { uid: targetUid, cid: clubId, alias: backofficeAlias, from: backofficeFrom, to: backofficeTo },
      }),
      requestApi<{ list?: BackofficeAuditEntry[] }>('/backoffice/audit/list', { method: 'POST', body: { uid: targetUid } }),
    ]);
    setBackofficeUser(detail);
    setBackofficeLedger(ledger.list || []);
    setBackofficeSessions(sessions.list || []);
    setBackofficeAudit(audit.list || []);
  }, [backofficeAlias, backofficeFrom, backofficeTo, clubId, requestApi]);

  const searchBackofficeUsers = useCallback(async () => {
    try {
      const payload = await requestApi<{ list?: BackofficeUser[] }>('/backoffice/users/search', {
        method: 'POST', body: { query: backofficeQuery, limit: 20 },
      });
      const list = payload.list || [];
      setBackofficeUsers(list);
      if (list.length === 1) await loadBackofficeUser(list[0].uid);
    } catch (error) {
      addActivity('error', 'Backoffice search failed', errorMessage(error), 'error');
    }
  }, [addActivity, backofficeQuery, loadBackofficeUser, requestApi]);

  const selectBackofficeUser = useCallback(async (target: BackofficeUser) => {
    try {
      await loadBackofficeUser(target.uid);
    } catch (error) {
      addActivity('error', 'Backoffice user load failed', errorMessage(error), 'error');
    }
  }, [addActivity, loadBackofficeUser]);

  const runBackofficeOperation = useCallback(async (path: string, body: Record<string, unknown>, title: string) => {
    if (!backofficeUser) return;
    if (!backofficeReason.trim()) {
      addActivity('warn', 'Reason required', 'Describe why this operator action is needed.', 'warn');
      return;
    }
    try {
      await requestApi(path, { method: 'POST', body: { ...body, reason: backofficeReason.trim() } });
      await loadBackofficeUser(backofficeUser.uid);
      setBackofficeReason('');
      addActivity('backoffice', title, `User ${backofficeUser.uid}`, 'success');
    } catch (error) {
      addActivity('error', `${title} failed`, errorMessage(error), 'error');
    }
  }, [addActivity, backofficeReason, backofficeUser, loadBackofficeUser, requestApi]);

  const setActivityTone = useCallback((message: string, tone: 'ok' | 'warn' | 'bad' = 'ok') => {
    setServerStatus(message);
    setServerTone(tone);
  }, []);

  const pingServer = useCallback(async () => {
    try {
      const payload = await requestApi<{ status?: string; buildvers?: string }>('/healthz', { auth: false });
      setActivityTone(payload.status || 'ok', 'ok');
      addActivity('system', 'Server ready', `Build ${payload.buildvers || 'unknown'}`, 'success');
      return payload;
    } catch (error) {
      setActivityTone('offline', 'bad');
      addActivity('system', 'Server offline', errorMessage(error), 'error');
      return null;
    }
  }, [addActivity, requestApi, setActivityTone]);

  const renderSelectedGameMeta = useCallback((game: GameInfo | null, gid?: number) => {
    return gameMeta(game, clubId, wallet, gid);
  }, [clubId, wallet]);

  const hydrateAccount = useCallback(async (targetUid: number | null = uid, targetAccessToken: string = accessToken) => {
    if (!targetUid || !targetAccessToken) {
      setAuthLabel('Signed out');
      return;
    }

    try {
      const [userInfo, propInfo, walletInfo, alInfo] = await Promise.all([
        requestApi<UserListResponse>('/user/is', {
          method: 'POST',
          body: { list: [{ uid: targetUid }] },
        }),
        requestApi<PropResponse>('/prop/get', {
          method: 'POST',
          body: { cid: clubId, uid: targetUid },
        }),
        requestApi<WalletResponse>('/prop/wallet/get', {
          method: 'POST',
          body: { cid: clubId, uid: targetUid },
        }),
        requestApi<{ access?: string | number }>('/prop/al/get', {
          method: 'POST',
          body: { cid: clubId, uid: targetUid, all: true },
        }),
      ]);

      const user = userInfo.list?.[0] || {};
      const nextWallet = Number(walletInfo.wallet ?? propInfo.wallet ?? 0);
      const nextFlags = alInfo.access ?? propInfo.access ?? '-';

      setWallet(nextWallet);
      setAccess(String(propInfo.access ?? '-'));
      setMrtp(String(propInfo.mrtp ?? '-'));
      setAccessFlags(String(nextFlags));
      setAccountHint(user.name || name || email);
      setAuthLabel(`UID ${targetUid} · ${user.name || email}`);
    } catch (error) {
      addActivity('error', 'Account hydrate failed', errorMessage(error), 'error');
      if (isHttpError(error) && error.status === 401) {
        setAuthLabel('Token expired');
      }
    }
  }, [accessToken, addActivity, clubId, email, name, requestApi, uid]);

  const loadGames = useCallback(async () => {
    try {
      const payload = await requestApi<GameCatalogResponse>('/game/list?inc=all&sort=1', { auth: false });
      const list: GameInfo[] = Array.isArray(payload.list) ? payload.list : [];
      setGames(list);
      setAlgCount(String(payload.algnum ?? '-'));
      setProvCount(String(payload.prvnum ?? '-'));
      setGameCount(`${list.length} games`);

      if (selectedAlias) {
        const found = list.find((game: GameInfo) => gameAlias(game) === selectedAlias);
        if (found) {
          setSelectedGame(found);
        }
      }
    } catch (error) {
      setGameCount('0 games');
      addActivity('error', 'Game catalog failed', errorMessage(error), 'error');
    }
  }, [addActivity, requestApi, selectedAlias]);

  useEffect(() => {
    void Promise.allSettled([pingServer(), loadGames()]).then(() => {
      if (accessToken && uid) {
        void hydrateAccount();
        void loadBackofficeRole();
      } else {
        setAuthLabel('Signed out');
      }
    });
  }, []); // bootstrap once

  const selectGame = useCallback((game: GameInfo) => {
    const alias = gameAlias(game);
    setSelectedGame(game);
    setSelectedAlias(alias);
    addActivity('lobby', 'Game selected', `${game.Prov || '?'} / ${game.Name || '?'}`, 'success');
  }, [addActivity]);

  const openSelectedGame = useCallback(async () => {
    if (!uid || !accessToken) {
      addActivity('warn', 'Sign in required', 'Use the account panel first.', 'warn');
      return;
    }
    if (!selectedGame) {
      addActivity('warn', 'No game selected', 'Choose a lobby card first.', 'warn');
      return;
    }

    try {
      const payload = await requestApi<SessionResponse>('/game/new', {
        method: 'POST',
        body: { cid: clubId, uid, alias: selectedAlias },
      });

      const nextSession: GameSession = {
        gid: Number(payload.gid || payload.sid || 0),
        gameType: isKenoGame(selectedGame) ? 'keno' : 'slot',
        state: payload.state,
        game: payload.game,
        wallet: Number(payload.wallet ?? wallet),
      };
      setCurrentSession(nextSession);
      setWallet(nextSession.wallet);
      setSessionState(payload.state || 'opened');
      addActivity('game', 'Session opened', `${selectedAlias} · GID ${nextSession.gid}`, 'success');
    } catch (error) {
      addActivity('error', 'Open game failed', errorMessage(error), 'error');
    }
  }, [accessToken, addActivity, clubId, requestApi, selectedAlias, selectedGame, uid, wallet]);

  const applySpinResult = useCallback((payload: SessionResponse) => {
    const nextSession: GameSession = {
      gid: Number(payload.gid || currentSession?.gid || 0),
      gameType: currentSession?.gameType,
      state: payload.state || currentSession?.state,
      game: payload.game || currentSession?.game,
      wallet: Number(payload.wallet ?? wallet),
    };
    setCurrentSession(nextSession);
    setWallet(nextSession.wallet);
    setSessionState(payload.state || nextSession.state || 'active');
  }, [currentSession?.game, currentSession?.gid, currentSession?.state, wallet]);

  const spin = useCallback(async () => {
    if (!uid || !accessToken) {
      addActivity('warn', 'Sign in required', 'Use the account panel first.', 'warn');
      return;
    }
    if (!currentSession?.gid) {
      addActivity('warn', 'Open a session first', 'Use the lobby selection.', 'warn');
      return;
    }

    const kenoSession = currentSession.gameType === 'keno';
    const picks = kenoSession ? parseKenoSelections(kenoPicks) : [];
    if (kenoSession && picks.length === 0) {
      addActivity('warn', 'Keno numbers required', 'Enter unique numbers from 1 to 80, separated by spaces or commas.', 'warn');
      return;
    }

    try {
      const payload = await requestApi<SessionResponse>(kenoSession ? '/keno/spin' : '/slot/spin', {
        method: 'POST',
        body: kenoSession
          ? { gid: currentSession.gid, bet, sel: picks }
          : { gid: currentSession.gid, bet, sel },
      });
      applySpinResult(payload);
      addActivity('spin', `Spin #${payload.sid || '?'}`, `${formatMoney(payload.wallet ?? wallet)} · ${payload.state || ''}`, 'success');
    } catch (error) {
      addActivity('error', 'Spin failed', errorMessage(error), 'error');
    }
  }, [accessToken, addActivity, applySpinResult, bet, currentSession, kenoPicks, requestApi, sel, uid, wallet]);

  const doubleUp = useCallback(async () => {
    if (!uid || !accessToken) {
      addActivity('warn', 'Sign in required', 'Use the account panel first.', 'warn');
      return;
    }
    if (!currentSession?.gid || currentSession.gameType === 'keno') {
      addActivity('warn', 'Double up unavailable', 'Use a slot session with gain.', 'warn');
      return;
    }

    try {
      const payload = await requestApi<SessionResponse>('/slot/doubleup', {
        method: 'POST',
        body: {
          gid: currentSession.gid,
          mult,
        },
      });
      applySpinResult(payload);
      addActivity('game', 'Double up', `${formatMoney(payload.wallet ?? wallet)} · ${payload.state || ''}`, 'success');
    } catch (error) {
      addActivity('error', 'Double up failed', errorMessage(error), 'error');
    }
  }, [accessToken, addActivity, applySpinResult, currentSession, mult, requestApi, uid, wallet]);

  const collect = useCallback(async () => {
    if (!uid || !accessToken) {
      addActivity('warn', 'Sign in required', 'Use the account panel first.', 'warn');
      return;
    }
    if (!currentSession?.gid || currentSession.gameType === 'keno') {
      addActivity('warn', 'Collect unavailable', 'Use a slot session.', 'warn');
      return;
    }

    try {
      const payload = await requestApi<SessionResponse>('/slot/collect', {
        method: 'POST',
        body: { gid: currentSession.gid },
      });
      applySpinResult(payload);
      addActivity('game', 'Collect', `${formatMoney(payload.wallet ?? wallet)} · ${payload.state || ''}`, 'success');
    } catch (error) {
      addActivity('error', 'Collect failed', errorMessage(error), 'error');
    }
  }, [accessToken, addActivity, applySpinResult, currentSession, requestApi, uid, wallet]);

  const signIn = useCallback(async () => {
    try {
      const payload = await requestApi<AuthResponse>('/signin', {
        method: 'POST',
        auth: false,
        body: {
          email,
          secret,
        },
      });
      applyAuth(payload);
      addActivity('auth', 'Signed in', payload.email || email, 'success');
      await hydrateAccount(Number(payload.uid || uid || 0) || null, payload.access || accessToken);
      await loadBackofficeRole();
    } catch (error) {
      addActivity('error', 'Sign in failed', errorMessage(error), 'error');
    }
  }, [addActivity, applyAuth, email, hydrateAccount, loadBackofficeRole, requestApi, secret]);

  const signUp = useCallback(async () => {
    try {
      const payload = await requestApi<{ email?: string }>('/signup', {
        method: 'POST',
        auth: false,
        body: {
          email,
          secret,
          name,
        },
      });
      addActivity('auth', 'Signed up', payload.email || email, 'success');
      await signIn();
    } catch (error) {
      addActivity('error', 'Sign up failed', errorMessage(error), 'error');
    }
  }, [addActivity, email, name, requestApi, secret, signIn]);

  const refreshClick = useCallback(async () => {
    await refreshTokens(false);
  }, [refreshTokens]);

  const changeSecret = useCallback(async () => {
    if (!uid || !accessToken) {
      addActivity('warn', 'Sign in required', 'Use the account panel first.', 'warn');
      return;
    }
    if (!secretOld || !secretNew) {
      addActivity('warn', 'Secret update incomplete', 'Provide old and new secret.', 'warn');
      return;
    }

    try {
      await requestApi('/user/secret', {
        method: 'POST',
        body: {
          uid,
          oldsecret: secretOld,
          newsecret: secretNew,
        },
      });
      setSecret(secretNew);
      setSecretOld('');
      setSecretNew('');
      addActivity('auth', 'Secret updated', 'Account secret changed successfully.', 'success');
    } catch (error) {
      addActivity('error', 'Secret update failed', errorMessage(error), 'error');
    }
  }, [accessToken, addActivity, requestApi, secretNew, secretOld, uid]);

  const clearActivity = useCallback(() => {
    setActivity([]);
  }, []);

  const selectedGameMeta = renderSelectedGameMeta(selectedGame, currentSession?.gid);
  const boardSource: SessionResponse = currentSession
    ? { gid: currentSession.gid, game: currentSession.game, wallet: currentSession.wallet, state: currentSession.state }
    : {};
  const boardCells = normalizeScreen(extractScreen(boardSource));
  const boardWidth = boardCells[0]?.length || 0;
  const todayKey = new Date().toISOString().slice(0, 10);
  const onboardingSteps = [
    { label: 'Sign in', done: Boolean(uid && accessToken) },
    { label: 'Pick a game', done: Boolean(selectedGame) },
    { label: 'Open session', done: Boolean(currentSession?.gid) },
    { label: 'Spin once', done: activity.some((item) => item.kind === 'spin') },
  ];
  const onboardingDone = onboardingSteps.filter((step) => step.done).length;
  const welcomeDone = Boolean(welcomeClaimedAt);
  const dailyDone = dailyClaimedAt.slice(0, 10) === todayKey;
  const accessSummary = accessFlags === '-' ? 'Access flags unavailable yet' : `Access flags: ${accessFlags}`;
  const serverBorderColor =
    serverTone === 'ok' ? 'rgba(69, 179, 107, 0.35)' :
    serverTone === 'warn' ? 'rgba(215, 168, 76, 0.45)' :
    serverTone === 'bad' ? 'rgba(212, 106, 95, 0.45)' :
    'var(--line)';
  const profileRows = [
    { label: 'User', value: accountHint || name || email },
    { label: 'Email', value: email },
    { label: 'Club', value: String(clubId) },
    { label: 'Wallet', value: formatMoney(wallet) },
    { label: 'Access', value: String(access) },
    { label: 'mRTP', value: String(mrtp) },
  ];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand__logo" aria-hidden="true">S</div>
          <div className="brand__copy">
            <div className="brand__name">Slotopol</div>
            <div className="brand__sub">Client Scaffold</div>
          </div>
        </div>

        <div className="topbar__meta">
          <div className="badge" id="serverBadge" data-tone={serverTone} style={{ borderColor: serverBorderColor }}>
            <ServerCog size={14} />
            <span>Server: {serverStatus}</span>
          </div>
          <div className="badge badge--accent">
            <Shield size={14} />
            <span>{authLabel}</span>
          </div>
          <button className="icon-btn" type="button" onClick={refreshClick} title="Refresh server and session state">
            <RefreshCcw size={16} />
          </button>
        </div>

        <nav className="section-nav" aria-label="Product sections">
          <a href="#welcome" className="nav-pill">Welcome</a>
          <a href="#profile" className="nav-pill">Profile</a>
          <a href="#lobby" className="nav-pill">Lobby</a>
          <a href="#game" className="nav-pill">Game</a>
          <a href="#rewards" className="nav-pill">Rewards</a>
          {backofficeRole !== 'none' && <a href="#backoffice" className="nav-pill nav-pill--accent">Backoffice</a>}
          <a href="#activity" className="nav-pill">History</a>
        </nav>
      </header>

      <section className="hero" id="welcome">
        <div className="hero__copy">
          <div className="hero__eyebrow">Client product</div>
          <h1>Slotopol</h1>
          <p>
            One web surface for account access, lobby browsing, session control and play flow.
          </p>
          <div className="hero__actions">
            <a className="nav-pill nav-pill--accent" href="#lobby">Open lobby</a>
            <a className="nav-pill" href="#profile">Account</a>
            <a className="nav-pill" href="#game">Game</a>
          </div>
        </div>

        <div className="hero__grid">
          <article className="hero-card">
            <div className="hero-card__title">Onboarding</div>
            <div className="hero-card__meta">{onboardingDone}/{onboardingSteps.length} steps complete</div>
            <ul className="checklist">
              {onboardingSteps.map((step) => (
                <li key={step.label} className={step.done ? 'is-done' : ''}>
                  <span>{step.done ? '✓' : '•'}</span>
                  <span>{step.label}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="hero-card" id="rewards">
            <div className="hero-card__title">Rewards</div>
            <div className="hero-card__meta">Retention surfaces for onboarding and daily return visits.</div>
            <div className="reward-stack">
              <div className="reward-item">
                <div className="reward-item__title">Welcome bonus</div>
                <div className="reward-item__meta">{welcomeDone ? `Saved locally at ${welcomeClaimedAt}` : 'Ready for first-session onboarding.'}</div>
                <button className="btn" type="button" onClick={claimWelcomeBonus} disabled={welcomeDone}>Mark seen</button>
              </div>
              <div className="reward-item">
                <div className="reward-item__title">Daily reward</div>
                <div className="reward-item__meta">{dailyDone ? `Checked in for ${todayKey}` : 'Local daily check-in surface.'}</div>
                <button className="btn" type="button" onClick={claimDailyReward} disabled={dailyDone}>Check in</button>
              </div>
            </div>
          </article>
        </div>
      </section>

      <main className="workspace">
        <section className="panel panel--auth" id="profile">
          <div className="panel__head">
            <h2>Account</h2>
            <span className="panel__hint">{accountHint}</span>
          </div>

          {import.meta.env.DEV && (
            <label className="field">
              <span>API base</span>
              <input value={apiBase} onChange={(event) => setApiBase(event.target.value)} type="text" spellCheck={false} />
            </label>
          )}

          <div className="split">
            <label className="field">
              <span>Email</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" spellCheck={false} autoComplete="username" />
            </label>
            <label className="field">
              <span>Password</span>
              <input value={secret} onChange={(event) => setSecret(event.target.value)} type="password" autoComplete="current-password" />
            </label>
          </div>

          <div className="split">
            <label className="field">
              <span>Name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} type="text" spellCheck={false} autoComplete="nickname" />
            </label>
            <label className="field">
              <span>Club</span>
              <input value={clubId} onChange={(event) => setClubId(Math.max(1, Number(event.target.value || DEFAULT_CLUB)))} type="number" min={1} step={1} />
            </label>
          </div>

          <div className="actions">
            <button className="btn btn--primary" type="button" onClick={signIn}>
              <LogIn size={16} />
              <span>Sign in</span>
            </button>
            <button className="btn" type="button" onClick={signUp}>
              <UserPlus size={16} />
              <span>Sign up</span>
            </button>
            <button className="btn" type="button" onClick={refreshClick}>
              <RotateCcw size={16} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="account-card">
            <div className="account-card__title">Profile</div>
            <div className="account-card__grid">
              <div>
                <div className="label">UID</div>
                <div className="value">{uid ?? '-'}</div>
              </div>
              <div>
                <div className="label">Wallet</div>
                <div className="value">{formatMoney(wallet)}</div>
              </div>
              <div>
                <div className="label">Access</div>
                <div className="value">{access}</div>
              </div>
              <div>
                <div className="label">mRTP</div>
                <div className="value">{mrtp}</div>
              </div>
              <div>
                <div className="label">Access flags</div>
                <div className="value">{accessFlags}</div>
              </div>
            </div>
          </div>

          <div className="status-strip">
            <div className="status-strip__label">Eligibility</div>
            <div className="status-strip__value">{accessSummary}</div>
          </div>

          <div className="secret-box">
            <div className="secret-box__title">Recovery / change secret</div>
            <div className="split">
              <label className="field">
                <span>Old secret</span>
                <input value={secretOld} onChange={(event) => setSecretOld(event.target.value)} type="password" autoComplete="current-password" />
              </label>
              <label className="field">
                <span>New secret</span>
                <input value={secretNew} onChange={(event) => setSecretNew(event.target.value)} type="password" autoComplete="new-password" />
              </label>
            </div>
            <div className="actions">
              <button className="btn btn--primary" type="button" onClick={changeSecret}>
                <Shield size={16} />
                <span>Update secret</span>
              </button>
              <div className="mini-note">
                The backend enforces the current secret unless the account has admin access.
              </div>
            </div>
          </div>

          <div className="mini-list">
            {profileRows.map((row) => (
              <div className="mini-item" key={row.label}>
                <div className="mini-item__top">
                  <div className="mini-item__name">{row.label}</div>
                </div>
                <div className="mini-item__meta">{row.value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel panel--lobby" id="lobby">
          <div className="panel__head">
            <h2>Lobby</h2>
            <span className="panel__hint">{gameCount}</span>
          </div>

          <div className="search-row">
            <label className="field field--inline">
              <span>Search</span>
              <div className="search-input">
                <Search size={15} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  type="search"
                  placeholder="Provider, game, alias"
                />
              </div>
            </label>

            <label className="field field--inline">
              <span>Filter</span>
              <div className="search-input">
                <Filter size={15} />
                <select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)}>
                  {providerOptions.map((provider) => (
                    <option key={provider} value={provider}>{provider}</option>
                  ))}
                </select>
              </div>
            </label>
          </div>

          <div className="chips">
            {QUICK_FILTERS.map((filter) => (
              <button
                key={filter}
                className={`chip ${providerFilter === filter ? 'is-active' : ''}`}
                type="button"
                onClick={() => setProviderFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="stats">
            <div className="stat">
              <div className="label">Algorithms</div>
              <div className="value">{algCount}</div>
            </div>
            <div className="stat">
              <div className="label">Providers</div>
              <div className="value">{provCount}</div>
            </div>
            <div className="stat">
              <div className="label">Selected</div>
              <div className="value">{selectedGame ? `${selectedGame.Prov || '?'} / ${selectedGame.Name || '?'}` : 'None'}</div>
            </div>
          </div>

          <div className="game-grid">
            {filteredGames.length ? filteredGames.map((game) => {
              const alias = gameAlias(game);
              const selected = alias === selectedAlias;
              return (
                <button
                  key={alias}
                  className={`game-card ${selected ? 'is-selected' : ''}`}
                  type="button"
                  onClick={() => selectGame(game)}
                >
                  <div className="game-card__title">{game.Name || game.name || alias}</div>
                  <div className="game-card__meta">{game.Prov || game.prov || 'Unknown provider'}</div>
                  <div className="game-card__meta">{gameShape(game)} · {gameTypeLabel(game)} · {renderRtpLabel(game)}</div>
                  <div className="game-card__chips">
                    <span className="chip chip--soft">{gameTypeLabel(game)}</span>
                    <span className="chip chip--soft">{gameShape(game)}</span>
                    {(game.RTP || []).slice(0, 2).map((value: number) => (
                      <span key={`${alias}-${value}`} className="chip chip--soft">{Number(value).toFixed(2)}%</span>
                    ))}
                  </div>
                </button>
              );
            }) : (
              <div className="empty-state">No games match the current filter.</div>
            )}
          </div>
        </section>

        <section className="panel panel--game" id="game">
          <div className="panel__head">
            <h2>Game</h2>
            <span className="panel__hint">{sessionState}</span>
          </div>

          <div className="featured">
            <div className="featured__art" aria-hidden="true">
              <span>S</span>
            </div>
            <div className="featured__copy">
              <div className="featured__title">{selectedGame ? `${selectedGame.Prov || '?'} / ${selectedGame.Name || '?'}` : 'Pick a game'}</div>
              <div className="featured__meta">{selectedGameMeta}</div>
            </div>
          </div>

          <div className="board-wrap">
            <div className="board" style={{ gridTemplateColumns: boardWidth ? `repeat(${boardWidth}, minmax(0, 1fr))` : undefined }}>
              {boardCells.length ? boardCells.flat().map((cell, index) => {
                const numeric = typeof cell === 'number' ? cell : Number(cell);
                const value = Number.isFinite(numeric) && SYMBOLS[numeric] ? SYMBOLS[numeric] : String(cell || '•');
                return (
                  <div className="cell" key={`${index}-${value}`}>{value}</div>
                );
              }) : (
                <div className="empty-state" style={{ gridColumn: '1 / -1' }}>Open a game to render the board.</div>
              )}
            </div>
          </div>

          <div className="controls">
            <label className="field">
              <span>Bet</span>
              <input value={bet} onChange={(event) => setBet(Number(event.target.value || 0))} type="number" min={0} step="0.01" />
            </label>
            {currentSession?.gameType === 'keno' ? (
              <label className="field controls__wide-field">
                <span>Keno numbers</span>
                <input
                  value={kenoPicks}
                  onChange={(event) => setKenoPicks(event.target.value)}
                  type="text"
                  inputMode="numeric"
                  placeholder="1, 7, 14, 23"
                />
              </label>
            ) : (
              <>
                <label className="field">
                  <span>Lines / Sel</span>
                  <input value={sel} onChange={(event) => setSel(Number(event.target.value || 0))} type="number" min={0} step={1} />
                </label>
                <label className="field">
                  <span>Multiplier</span>
                  <input value={mult} onChange={(event) => setMult(Number(event.target.value || 2))} type="number" min={2} step={1} />
                </label>
              </>
            )}
          </div>

          <div className="actions actions--wide">
            <button className="btn btn--primary" type="button" onClick={openSelectedGame}>
              <Gamepad2 size={16} />
              <span>Open selected</span>
            </button>
            <button className="btn" type="button" onClick={spin}>
              <Play size={16} />
              <span>Spin</span>
            </button>
            <button className="btn" type="button" onClick={doubleUp}>
              <Sparkles size={16} />
              <span>Double</span>
            </button>
            <button className="btn" type="button" onClick={collect}>
              <WalletCards size={16} />
              <span>Collect</span>
            </button>
          </div>

          <div className="ledger" id="activity">
            <div className="ledger__head">
              <h3>Activity</h3>
              <button className="icon-btn" type="button" onClick={clearActivity} title="Clear activity">
                <Trash2 size={16} />
              </button>
            </div>
            <div className="ledger__body">
              {activity.length ? activity.map((item) => (
                <div key={`${item.at}-${item.title}`} className={`ledger-item ${item.tone === 'error' ? 'is-error' : item.tone === 'success' ? 'is-success' : ''}`}>
                  <div className="ledger-item__top">
                    <div className="mini-item__name">{item.title}</div>
                    <div className="label">{timeAgo(item.at)}</div>
                  </div>
                  <div className="ledger-item__meta">{item.detail || item.kind}</div>
                </div>
              )) : (
                <div className="empty-state">No activity yet.</div>
              )}
            </div>
          </div>
        </section>

        {backofficeRole !== 'none' && (
          <section className="panel panel--backoffice" id="backoffice">
            <div className="panel__head">
              <h2>Backoffice</h2>
              <span className="panel__hint">{backofficeRole}</span>
            </div>

            <div className="search-row">
              <label className="field field--inline">
                <span>User search</span>
                <div className="search-input">
                  <Search size={15} />
                  <input value={backofficeQuery} onChange={(event) => setBackofficeQuery(event.target.value)} placeholder="UID, email, name" />
                </div>
              </label>
              <button className="btn btn--primary" type="button" onClick={searchBackofficeUsers}>Search</button>
            </div>

            {backofficeUsers.length > 0 && (
              <div className="backoffice-users">
                {backofficeUsers.map((item) => (
                  <button className={`backoffice-user ${backofficeUser?.uid === item.uid ? 'is-selected' : ''}`} type="button" key={item.uid} onClick={() => void selectBackofficeUser(item)}>
                    <span>{item.name || item.email}</span>
                    <span className="label">UID {item.uid} · {item.email}</span>
                  </button>
                ))}
              </div>
            )}

            {backofficeUser ? (
              <div className="backoffice-detail">
                <div className="stats">
                  <div className="stat"><div className="label">User</div><div className="value">{backofficeUser.name || backofficeUser.email}</div></div>
                  <div className="stat"><div className="label">Wallet</div><div className="value">{formatMoney(backofficeUser.wallet || 0)}</div></div>
                  <div className="stat"><div className="label">Status</div><div className="value">{backofficeUser.status & 4 ? 'Blocked' : 'Active'}</div></div>
                </div>

                {(backofficeRole === 'operator' || backofficeRole === 'admin') && (
                  <div className="backoffice-actions">
                    <label className="field">
                      <span>Operator reason</span>
                      <input value={backofficeReason} onChange={(event) => setBackofficeReason(event.target.value)} placeholder="Required for every action" />
                    </label>
                    <div className="split">
                      <label className="field">
                        <span>Amount</span>
                        <input value={backofficeAmount} onChange={(event) => setBackofficeAmount(Number(event.target.value || 0))} type="number" step="0.01" />
                      </label>
                      <div className="actions actions--operator">
                        <button className="btn" type="button" onClick={() => void runBackofficeOperation('/backoffice/wallet/bonus', { uid: backofficeUser.uid, cid: clubId, amount: backofficeAmount }, 'Bonus granted')}>Bonus</button>
                        <button className="btn" type="button" onClick={() => void runBackofficeOperation('/backoffice/wallet/adjust', { uid: backofficeUser.uid, cid: clubId, amount: backofficeAmount }, 'Balance adjusted')}>Adjust</button>
                        <button className="btn" type="button" onClick={() => void runBackofficeOperation('/backoffice/users/status', { uid: backofficeUser.uid, blocked: !(backofficeUser.status & 4) }, backofficeUser.status & 4 ? 'User unblocked' : 'User blocked')}>
                          {backofficeUser.status & 4 ? 'Unblock' : 'Block'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="backoffice-session-filter">
                  <label className="field"><span>Game alias</span><input value={backofficeAlias} onChange={(event) => setBackofficeAlias(event.target.value)} placeholder="provider/game" /></label>
                  <label className="field"><span>From (UTC)</span><input value={backofficeFrom} onChange={(event) => setBackofficeFrom(event.target.value)} placeholder="2026-07-14T00:00:00Z" /></label>
                  <label className="field"><span>To (UTC)</span><input value={backofficeTo} onChange={(event) => setBackofficeTo(event.target.value)} placeholder="2026-07-14T23:59:59Z" /></label>
                  <button className="btn" type="button" onClick={() => void selectBackofficeUser(backofficeUser)}>Filter sessions</button>
                </div>

                <div className="backoffice-columns">
                  <div className="backoffice-list">
                    <h3>Wallet ledger</h3>
                    {backofficeLedger.length ? backofficeLedger.map((entry) => <div className="ledger-item" key={entry.id}><div className="ledger-item__top"><span>{entry.op}</span><span>{formatMoney(entry.amount)}</span></div><div className="ledger-item__meta">{entry.balance_before} → {entry.balance_after} · actor {entry.actor_uid}</div></div>) : <div className="empty-state">No ledger entries.</div>}
                  </div>
                  <div className="backoffice-list">
                    <h3>Sessions</h3>
                    {backofficeSessions.length ? backofficeSessions.map((entry) => <div className="ledger-item" key={entry.gid}><div className="ledger-item__top"><span>{entry.alias}</span><span>GID {entry.gid}</span></div><div className="ledger-item__meta">{entry.closed ? 'Closed' : 'Open'} · {entry.ctime}</div></div>) : <div className="empty-state">No sessions.</div>}
                  </div>
                  <div className="backoffice-list">
                    <h3>Operator audit</h3>
                    {backofficeAudit.length ? backofficeAudit.map((entry) => <div className="ledger-item" key={entry.id}><div className="ledger-item__top"><span>{entry.action}</span><span>actor {entry.actor_uid}</span></div><div className="ledger-item__meta">{entry.reason}</div></div>) : <div className="empty-state">No operator actions.</div>}
                  </div>
                </div>
              </div>
            ) : <div className="empty-state">Search for a user to open their support case.</div>}
          </section>
        )}
      </main>
    </div>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
