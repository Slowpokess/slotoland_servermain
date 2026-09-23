import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCcw, ServerCog, Shield } from 'lucide-react';
import { AccountPanel } from '@/components/AccountPanel';
import { BackofficePanel } from '@/components/BackofficePanel';
import { GamePanel } from '@/components/GamePanel';
import { LobbyPanel } from '@/components/LobbyPanel';
import { requestJson, HttpError, normalizeBase } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { gameAlias, gameShape, gameTypeLabel, normalizeText, renderRtpLabel } from '@/lib/gameCatalog';
import { loadJson, loadNumber, loadSessionString, loadString, removeString, saveJson, saveSessionString, saveString } from '@/lib/storage';
import { resolveAppRoute } from '@/lib/routing';
import { usePendingActions } from '@/lib/usePendingActions';
import { changeAccountSecret, loadAccountSnapshot, refreshSession, signInAccount, signUpAccount } from '@/services/authApi';
import {
  loadBackofficeRole as fetchBackofficeRole,
  loadBackofficeUserSnapshot,
  runBackofficeOperation as mutateBackoffice,
  searchBackofficeUsers as findBackofficeUsers,
} from '@/services/backofficeApi';
import { loadGameCatalog } from '@/services/catalogApi';
import { collectGame, doubleGame, openGame, spinGame } from '@/services/gameplayApi';
import type { ApiRequestOptions } from '@/lib/api';
import type { AuthResponse, BackofficeAuditEntry, BackofficeLedgerEntry, BackofficeRole, BackofficeSession, BackofficeUser, GameInfo, GameSession, SessionResponse } from '@/lib/types';
import type { ActivityItem } from '@/lib/types';

const DEFAULT_API = import.meta.env.DEV ? 'http://localhost:8080' : window.location.origin;
const DEFAULT_CLUB = 1;
const QUICK_FILTERS = ['all', 'slot', 'keno', 'novomatic', 'netent', 'playngo', 'playtech', 'ct', 'megajack'];
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
  const { isPending, runPending } = usePendingActions();
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
      const payload = await refreshSession(requestRaw);
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
      setBackofficeRole(await fetchBackofficeRole(requestApi));
    } catch (error) {
      if (isHttpError(error) && (error.status === 401 || error.status === 403)) {
        setBackofficeRole('none');
        return;
      }
      addActivity('error', 'Backoffice check failed', errorMessage(error), 'error');
    }
  }, [addActivity, requestApi]);

  const loadBackofficeUser = useCallback(async (targetUid: number) => {
    const snapshot = await loadBackofficeUserSnapshot(requestApi, targetUid, {
      cid: clubId,
      alias: backofficeAlias,
      from: backofficeFrom,
      to: backofficeTo,
    });
    setBackofficeUser(snapshot.user);
    setBackofficeLedger(snapshot.ledger);
    setBackofficeSessions(snapshot.sessions);
    setBackofficeAudit(snapshot.audit);
  }, [backofficeAlias, backofficeFrom, backofficeTo, clubId, requestApi]);

  const searchBackofficeUsers = useCallback(async () => {
    try {
      const list = await findBackofficeUsers(requestApi, backofficeQuery);
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
      await mutateBackoffice(requestApi, path, body, backofficeReason.trim());
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
      const snapshot = await loadAccountSnapshot(requestApi, targetUid, clubId);

      setWallet(snapshot.wallet);
      setAccess(String(snapshot.access));
      setMrtp(String(snapshot.mrtp));
      setAccessFlags(String(snapshot.accessFlags));
      setAccountHint(snapshot.user.name || name || email);
      setAuthLabel(`UID ${targetUid} · ${snapshot.user.name || email}`);
    } catch (error) {
      addActivity('error', 'Account hydrate failed', errorMessage(error), 'error');
      if (isHttpError(error) && error.status === 401) {
        setAuthLabel('Token expired');
      }
    }
  }, [accessToken, addActivity, clubId, email, name, requestApi, uid]);

  const loadGames = useCallback(async () => {
    try {
      const payload = await loadGameCatalog(requestApi);
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
      const payload = await openGame(requestApi, { cid: clubId, uid, alias: selectedAlias });

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
      const payload = await spinGame(requestApi, {
        gid: currentSession.gid,
        bet,
        selection: kenoSession ? picks : sel,
        gameType: kenoSession ? 'keno' : 'slot',
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
      const payload = await doubleGame(requestApi, currentSession.gid, mult);
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
      const payload = await collectGame(requestApi, currentSession.gid);
      applySpinResult(payload);
      addActivity('game', 'Collect', `${formatMoney(payload.wallet ?? wallet)} · ${payload.state || ''}`, 'success');
    } catch (error) {
      addActivity('error', 'Collect failed', errorMessage(error), 'error');
    }
  }, [accessToken, addActivity, applySpinResult, currentSession, requestApi, uid, wallet]);

  const signIn = useCallback(async () => {
    try {
      const payload = await signInAccount(requestApi, email, secret);
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
      const payload = await signUpAccount(requestApi, email, secret, name);
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
      await changeAccountSecret(requestApi, uid, secretOld, secretNew);
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
  const authBusy = isPending('auth.signin', 'auth.signup', 'auth.refresh', 'auth.secret');
  const gameBusy = isPending('game.open', 'game.spin', 'game.double', 'game.collect');
  const backofficeBusy = isPending('backoffice.search', 'backoffice.user', 'backoffice.mutate');
  const appRoute = resolveAppRoute(window.location.pathname);

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
          <button
            className="icon-btn"
            type="button"
            onClick={() => void runPending('auth.refresh', refreshClick)}
            title="Refresh server and session state"
            disabled={authBusy}
            aria-busy={isPending('auth.refresh')}
          >
            <RefreshCcw size={16} />
          </button>
        </div>

        <nav className="section-nav" aria-label="Product sections">
          {appRoute === 'player' ? (
            <>
              <a href="#welcome" className="nav-pill">Welcome</a>
              <a href="#profile" className="nav-pill">Profile</a>
              <a href="#lobby" className="nav-pill">Lobby</a>
              <a href="#game" className="nav-pill">Game</a>
              <a href="#rewards" className="nav-pill">Rewards</a>
              <a href="#activity" className="nav-pill">History</a>
              {backofficeRole !== 'none' && <a href="/backoffice" className="nav-pill nav-pill--accent">Backoffice</a>}
            </>
          ) : (
            <>
              <a href="/" className="nav-pill">Player product</a>
              <span className="nav-pill nav-pill--accent" aria-current="page">Backoffice</span>
            </>
          )}
        </nav>
      </header>

      {appRoute === 'player' && <section className="hero" id="welcome">
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
      </section>}

      <main className={`workspace ${appRoute === 'backoffice' ? 'workspace--backoffice' : ''}`}>
        {appRoute === 'player' ? <>
        <AccountPanel
          access={access}
          accessFlags={accessFlags}
          accessSummary={accessSummary}
          apiBase={apiBase}
          clubId={clubId}
          email={email}
          hint={accountHint}
          isDevelopment={import.meta.env.DEV}
          mrtp={mrtp}
          name={name}
          pending={{ any: authBusy, refresh: isPending('auth.refresh'), secret: isPending('auth.secret'), signIn: isPending('auth.signin'), signUp: isPending('auth.signup') }}
          profileRows={profileRows}
          secret={secret}
          secretNew={secretNew}
          secretOld={secretOld}
          uid={uid}
          wallet={wallet}
          onApiBaseChange={setApiBase}
          onClubIdChange={setClubId}
          onEmailChange={setEmail}
          onNameChange={setName}
          onRefresh={() => void runPending('auth.refresh', refreshClick)}
          onSecretChange={setSecret}
          onSecretNewChange={setSecretNew}
          onSecretOldChange={setSecretOld}
          onSignIn={() => void runPending('auth.signin', signIn)}
          onSignUp={() => void runPending('auth.signup', signUp)}
          onUpdateSecret={() => void runPending('auth.secret', changeSecret)}
        />

        <LobbyPanel
          algorithmCount={algCount}
          filteredGames={filteredGames}
          gameCount={gameCount}
          providerFilter={providerFilter}
          providerOptions={providerOptions}
          providerCount={provCount}
          quickFilters={QUICK_FILTERS}
          search={search}
          selectedAlias={selectedAlias}
          selectedGame={selectedGame}
          onProviderFilterChange={setProviderFilter}
          onSearchChange={setSearch}
          onSelectGame={selectGame}
        />

        <GamePanel
          activity={activity}
          bet={bet}
          boardCells={boardCells}
          boardWidth={boardWidth}
          gameType={currentSession?.gameType}
          kenoPicks={kenoPicks}
          meta={selectedGameMeta}
          mult={mult}
          pending={{ any: gameBusy, collect: isPending('game.collect'), double: isPending('game.double'), open: isPending('game.open'), spin: isPending('game.spin') }}
          sel={sel}
          state={sessionState}
          title={selectedGame ? `${selectedGame.Prov || '?'} / ${selectedGame.Name || '?'}` : 'Pick a game'}
          onBetChange={setBet}
          onClearActivity={clearActivity}
          onCollect={() => void runPending('game.collect', collect)}
          onDouble={() => void runPending('game.double', doubleUp)}
          onKenoPicksChange={setKenoPicks}
          onMultChange={setMult}
          onOpen={() => void runPending('game.open', openSelectedGame)}
          onSelChange={setSel}
          onSpin={() => void runPending('game.spin', spin)}
        />
        </> : backofficeRole !== 'none' ? (
          <BackofficePanel
            alias={backofficeAlias}
            amount={backofficeAmount}
            audit={backofficeAudit}
            busy={backofficeBusy}
            clubId={clubId}
            from={backofficeFrom}
            ledger={backofficeLedger}
            loadingUser={isPending('backoffice.user')}
            mutating={isPending('backoffice.mutate')}
            query={backofficeQuery}
            reason={backofficeReason}
            role={backofficeRole}
            searching={isPending('backoffice.search')}
            selectedUser={backofficeUser}
            sessions={backofficeSessions}
            to={backofficeTo}
            users={backofficeUsers}
            onAliasChange={setBackofficeAlias}
            onAmountChange={setBackofficeAmount}
            onFromChange={setBackofficeFrom}
            onLoadUser={(user) => void runPending('backoffice.user', () => selectBackofficeUser(user))}
            onMutate={(path, body, title) => void runPending('backoffice.mutate', () => runBackofficeOperation(path, body, title))}
            onQueryChange={setBackofficeQuery}
            onReasonChange={setBackofficeReason}
            onSearch={() => void runPending('backoffice.search', searchBackofficeUsers)}
            onToChange={setBackofficeTo}
          />
        ) : (
          <section className="panel route-denied" role="alert">
            <div className="panel__head"><h2>Backoffice access required</h2></div>
            <p>Sign in from the player product with a support, operator, or admin account, then return to this route.</p>
            <a className="nav-pill nav-pill--accent" href="/#profile">Open account sign-in</a>
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
