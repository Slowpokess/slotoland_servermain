const DEFAULT_API = "http://localhost:8080";
const DEFAULT_CLUB = 1;
const QUICK_FILTERS = ["all", "slot", "keno", "novomatic", "netent", "playngo", "playtech", "ct", "megajack"];
const SYMBOLS = {
  1: "A",
  2: "K",
  3: "Q",
  4: "J",
  5: "10",
  6: "9",
  7: "7",
  8: "★",
  9: "♦",
  10: "♣",
  11: "♥",
  12: "✦",
};

const state = {
  apiBase: localStorage.getItem("slotopol.apiBase") || DEFAULT_API,
  email: localStorage.getItem("slotopol.email") || "player@example.org",
  secret: localStorage.getItem("slotopol.secret") || "iVI05M",
  name: localStorage.getItem("slotopol.name") || "Player",
  uid: Number(localStorage.getItem("slotopol.uid") || 0) || null,
  clubId: Number(localStorage.getItem("slotopol.clubId") || DEFAULT_CLUB) || DEFAULT_CLUB,
  accessToken: localStorage.getItem("slotopol.access") || "",
  refreshToken: localStorage.getItem("slotopol.refresh") || "",
  selectedAlias: localStorage.getItem("slotopol.selectedAlias") || "",
  selectedGame: null,
  currentSession: null,
  games: [],
  providerFilter: "all",
  search: "",
  activity: JSON.parse(localStorage.getItem("slotopol.activity") || "[]"),
  wallet: 0,
  access: "-",
  mrtp: "-",
  serverStatus: "unknown",
};

const el = {};

document.addEventListener("DOMContentLoaded", bootstrap);

async function bootstrap() {
  bindElements();
  bindEvents();
  hydrateInputs();
  renderQuickFilters();
  renderActivity();
  renderBoard([]);
  renderEmptyLobby("Loading game catalog...");

  await Promise.allSettled([
    pingServer(),
    loadGames(),
  ]);

  if (state.accessToken && state.uid) {
    await hydrateAccount();
  } else {
    updateAuthBadge("Signed out");
  }
}

function bindElements() {
  const ids = [
    "serverBadge", "authBadge", "pingBtn", "apiBase", "email", "secret", "name", "clubId",
    "signinBtn", "signupBtn", "refreshBtn", "uidValue", "walletValue", "accessValue", "mrtpValue",
    "profileList", "search", "providerFilter", "quickFilters", "gameCount", "algCount", "provCount",
    "selectedGameLabel", "gameGrid", "sessionState", "gameTitle", "gameMeta", "board", "bet", "sel",
    "mult", "openGameBtn", "spinBtn", "doubleBtn", "collectBtn", "activityLog", "clearLogBtn",
    "accountHint",
  ];
  for (const id of ids) {
    el[id] = document.getElementById(id);
  }
}

function bindEvents() {
  el.pingBtn.addEventListener("click", pingServer);
  el.apiBase.addEventListener("change", () => {
    state.apiBase = normalizeBase(el.apiBase.value);
    persist("apiBase", state.apiBase);
    pingServer();
    loadGames();
  });
  el.email.addEventListener("change", () => persist("email", el.email.value.trim()));
  el.secret.addEventListener("change", () => persist("secret", el.secret.value));
  el.name.addEventListener("change", () => persist("name", el.name.value.trim()));
  el.clubId.addEventListener("change", () => {
    state.clubId = Math.max(1, Number(el.clubId.value || DEFAULT_CLUB));
    localStorage.setItem("slotopol.clubId", String(state.clubId));
    renderSelectedGameMeta();
    if (state.uid && state.accessToken) {
      hydrateAccount();
    }
  });
  el.signinBtn.addEventListener("click", signIn);
  el.signupBtn.addEventListener("click", signUp);
  el.refreshBtn.addEventListener("click", refreshTokens);
  el.search.addEventListener("input", () => {
    state.search = el.search.value.trim().toLowerCase();
    renderGames();
  });
  el.providerFilter.addEventListener("change", () => {
    state.providerFilter = el.providerFilter.value;
    renderGames();
  });
  el.openGameBtn.addEventListener("click", openSelectedGame);
  el.spinBtn.addEventListener("click", spin);
  el.doubleBtn.addEventListener("click", doubleUp);
  el.collectBtn.addEventListener("click", collect);
  el.clearLogBtn.addEventListener("click", () => {
    state.activity = [];
    persistActivity();
    renderActivity();
  });
}

function hydrateInputs() {
  el.apiBase.value = state.apiBase;
  el.email.value = state.email;
  el.secret.value = state.secret;
  el.name.value = state.name;
  el.clubId.value = String(state.clubId);
  el.search.value = "";
  el.providerFilter.value = "all";
}

function persist(key, value) {
  localStorage.setItem(`slotopol.${key}`, value);
  state[key] = value;
}

function persistActivity() {
  localStorage.setItem("slotopol.activity", JSON.stringify(state.activity.slice(0, 50)));
}

function normalizeBase(value) {
  return String(value || DEFAULT_API).replace(/\/+$/, "");
}

function apiUrl(path) {
  return `${normalizeBase(state.apiBase)}${path.startsWith("/") ? path : `/${path}`}`;
}

function addActivity(kind, title, detail = "", tone = "info") {
  state.activity.unshift({
    kind,
    title,
    detail,
    tone,
    at: new Date().toISOString(),
  });
  state.activity = state.activity.slice(0, 40);
  persistActivity();
  renderActivity();
}

function setServerStatus(text, tone = "info") {
  state.serverStatus = text;
  el.serverBadge.textContent = `Server: ${text}`;
  el.serverBadge.style.borderColor =
    tone === "ok" ? "rgba(69, 179, 107, 0.35)" :
    tone === "warn" ? "rgba(215, 168, 76, 0.45)" :
    tone === "bad" ? "rgba(212, 106, 95, 0.45)" : "var(--line)";
}

function updateAuthBadge(text) {
  el.authBadge.textContent = text;
}

async function request(path, options = {}, retry = true) {
  const method = options.method || "GET";
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (options.auth !== false) {
    const token = options.tokenType === "refresh" ? state.refreshToken : state.accessToken;
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const res = await fetch(apiUrl(path), {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401 && retry && options.auth !== false && state.refreshToken && options.tokenType !== "refresh") {
    const refreshed = await refreshTokens(true);
    if (refreshed) {
      return request(path, options, false);
    }
  }

  const text = await res.text();
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (_) {
      payload = { raw: text };
    }
  }

  if (!res.ok) {
    const err = new Error(payload.what || `Request failed with status ${res.status}`);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }

  return payload;
}

async function pingServer() {
  try {
    const payload = await request("/healthz", { auth: false });
    setServerStatus(payload.status || "ok", "ok");
    addActivity("system", "Server ready", `Build ${payload.buildvers || "unknown"}`, "success");
    return payload;
  } catch (err) {
    setServerStatus("offline", "bad");
    addActivity("system", "Server offline", err.message, "error");
    return null;
  }
}

async function loadGames() {
  try {
    const payload = await request("/game/list?inc=all&sort=1", { auth: false });
    state.games = Array.isArray(payload.list) ? payload.list : [];
    el.algCount.textContent = String(payload.algnum ?? "-");
    el.provCount.textContent = String(payload.prvnum ?? "-");
    el.gameCount.textContent = `${state.games.length} games`;
    populateProviderFilter();
    renderGames();
    if (state.selectedAlias) {
      const found = state.games.find((game) => gameAlias(game) === state.selectedAlias);
      if (found) {
        selectGame(found);
      }
    }
  } catch (err) {
    el.gameCount.textContent = "0 games";
    renderEmptyLobby(err.message);
    addActivity("error", "Game catalog failed", err.message, "error");
  }
}

function populateProviderFilter() {
  const providers = [...new Set(state.games.map((game) => normalizeText(game.Prov || game.prov || "")))].filter(Boolean);
  const current = state.providerFilter;
  el.providerFilter.innerHTML = ["<option value=\"all\">All</option>"]
    .concat(providers.map((provider) => `<option value="${escapeHtml(provider)}">${escapeHtml(provider)}</option>`))
    .join("");
  if ([...el.providerFilter.options].some((option) => option.value === current)) {
    el.providerFilter.value = current;
  } else {
    el.providerFilter.value = "all";
    state.providerFilter = "all";
  }
  renderQuickFilters();
}

function renderQuickFilters() {
  el.quickFilters.innerHTML = QUICK_FILTERS.map((filter) => {
    const active = state.providerFilter === filter;
    return `<button class="chip ${active ? "is-active" : ""}" type="button" data-filter="${filter}">${filter}</button>`;
  }).join("");
  el.quickFilters.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.providerFilter = button.dataset.filter;
      el.providerFilter.value = button.dataset.filter;
      renderQuickFilters();
      renderGames();
    });
  });
}

function renderGames() {
  const filtered = state.games.filter((game) => {
    const provider = normalizeText(game.Prov || game.prov || "");
    const name = normalizeText(game.Name || game.name || "");
    const alias = normalizeText(gameAlias(game));
    const matchProvider = state.providerFilter === "all" || provider === state.providerFilter || (state.providerFilter === "ct" && provider.includes("ct"));
    const query = state.search;
    const matchSearch = !query || provider.includes(query) || name.includes(query) || alias.includes(query);
    return matchProvider && matchSearch;
  });

  if (!filtered.length) {
    renderEmptyLobby("No games match the current filter.");
    return;
  }

  el.gameGrid.innerHTML = filtered.map((game) => {
    const alias = gameAlias(game);
    const selected = alias === state.selectedAlias;
    const meta = [
      gameShape(game),
      gameTypeLabel(game),
      renderRtpLabel(game),
    ].filter(Boolean).join(" · ");
    return `
      <article class="game-card ${selected ? "is-selected" : ""}" data-alias="${escapeHtml(alias)}">
        <div class="game-card__title">${escapeHtml(game.Name || game.name || alias)}</div>
        <div class="game-card__meta">${escapeHtml(game.Prov || game.prov || "Unknown provider")}</div>
        <div class="game-card__meta">${escapeHtml(meta)}</div>
        <div class="game-card__chips">
          <span class="chip chip--soft">${escapeHtml(gameTypeLabel(game))}</span>
          <span class="chip chip--soft">${escapeHtml(gameShape(game))}</span>
          ${renderMiniRtpChips(game)}
        </div>
      </article>
    `;
  }).join("");

  el.gameGrid.querySelectorAll("[data-alias]").forEach((card) => {
    card.addEventListener("click", () => {
      const game = state.games.find((item) => gameAlias(item) === card.dataset.alias);
      if (game) {
        selectGame(game);
      }
    });
  });
}

function renderEmptyLobby(message) {
  el.gameGrid.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function selectGame(game) {
  state.selectedGame = game;
  state.selectedAlias = gameAlias(game);
  persist("selectedAlias", state.selectedAlias);
  el.selectedGameLabel.textContent = `${game.Prov || "?"} / ${game.Name || "?"}`;
  el.gameTitle.textContent = `${game.Prov || "?"} / ${game.Name || "?"}`;
  el.gameMeta.textContent = `${gameShape(game)} · ${gameTypeLabel(game)} · ${renderRtpLabel(game)}`;
  renderSelectedGameMeta();
  renderGames();
  addActivity("lobby", "Game selected", `${game.Prov || "?"} / ${game.Name || "?"}`, "success");
}

function renderSelectedGameMeta() {
  if (!state.selectedGame) {
    el.gameTitle.textContent = "Pick a game";
    el.gameMeta.textContent = "Open a session from the lobby.";
    return;
  }
  const game = state.selectedGame;
  const lines = [
    `Club ${state.clubId}`,
    state.currentSession ? `GID ${state.currentSession.gid}` : "No session",
    `Wallet ${formatMoney(state.wallet)}`,
  ];
  el.gameMeta.textContent = `${gameShape(game)} · ${gameTypeLabel(game)} · ${renderRtpLabel(game)} · ${lines.join(" · ")}`;
}

async function signIn() {
  try {
    state.email = el.email.value.trim();
    state.secret = el.secret.value;
    state.name = el.name.value.trim() || state.name;
    persist("email", state.email);
    persist("secret", state.secret);
    persist("name", state.name);

    const payload = await request("/signin", {
      method: "POST",
      auth: false,
      body: {
        email: state.email,
        secret: state.secret,
      },
    });

    applyAuth(payload);
    addActivity("auth", "Signed in", payload.email || state.email, "success");
    await hydrateAccount();
  } catch (err) {
    addActivity("error", "Sign in failed", err.message, "error");
  }
}

async function signUp() {
  try {
    state.email = el.email.value.trim();
    state.secret = el.secret.value;
    state.name = el.name.value.trim() || state.name;
    persist("email", state.email);
    persist("secret", state.secret);
    persist("name", state.name);

    const payload = await request("/signup", {
      method: "POST",
      auth: false,
      body: {
        email: state.email,
        secret: state.secret,
        name: state.name,
      },
    });
    addActivity("auth", "Signed up", payload.email || state.email, "success");
    await signIn();
  } catch (err) {
    addActivity("error", "Sign up failed", err.message, "error");
  }
}

async function refreshTokens(silent = false) {
  if (!state.refreshToken) {
    if (!silent) addActivity("auth", "Refresh skipped", "No refresh token stored", "warn");
    return false;
  }

  try {
    const payload = await request("/refresh", {
      method: "GET",
      tokenType: "refresh",
    });
    applyAuth(payload);
    if (!silent) addActivity("auth", "Session refreshed", payload.email || state.email, "success");
    return true;
  } catch (err) {
    if (!silent) addActivity("error", "Refresh failed", err.message, "error");
    return false;
  }
}

function applyAuth(payload) {
  state.uid = Number(payload.uid || state.uid || 0) || null;
  state.email = payload.email || state.email;
  state.accessToken = payload.access || "";
  state.refreshToken = payload.refresh || payload.refrsh || "";
  localStorage.setItem("slotopol.uid", String(state.uid || ""));
  persist("email", state.email);
  persist("access", state.accessToken);
  persist("refresh", state.refreshToken);
  updateAuthBadge(`UID ${state.uid || "-"} · ${state.email || "-"}`);
  el.uidValue.textContent = String(state.uid || "-");
}

async function hydrateAccount() {
  if (!state.uid || !state.accessToken) {
    updateAuthBadge("Signed out");
    return;
  }

  try {
    const [userInfo, propInfo, walletInfo] = await Promise.all([
      request("/user/is", {
        method: "POST",
        body: {
          list: [{ uid: state.uid }],
        },
      }),
      request("/prop/get", {
        method: "POST",
        body: {
          cid: state.clubId,
          uid: state.uid,
        },
      }),
      request("/prop/wallet/get", {
        method: "POST",
        body: {
          cid: state.clubId,
          uid: state.uid,
        },
      }),
    ]);

    const user = userInfo.list?.[0] || {};
    state.wallet = Number(walletInfo.wallet ?? propInfo.wallet ?? 0);
    state.access = String(propInfo.access ?? "-");
    state.mrtp = String(propInfo.mrtp ?? "-");
    el.uidValue.textContent = String(user.uid || state.uid || "-");
    el.walletValue.textContent = formatMoney(state.wallet);
    el.accessValue.textContent = state.access;
    el.mrtpValue.textContent = state.mrtp;
    el.accountHint.textContent = user.name || state.name || state.email;
    renderProfileList(user, propInfo);
    renderSelectedGameMeta();
    updateAuthBadge(`UID ${state.uid} · ${user.name || state.email}`);
  } catch (err) {
    addActivity("error", "Account hydrate failed", err.message, "error");
    if (err.status === 401) {
      updateAuthBadge("Token expired");
    }
  }
}

function renderProfileList(user, propInfo) {
  const rows = [
    { label: "User", value: user.name || state.name || state.email },
    { label: "Email", value: user.email || state.email },
    { label: "Club", value: String(state.clubId) },
    { label: "Wallet", value: formatMoney(state.wallet) },
    { label: "Access", value: String(propInfo.access ?? state.access) },
    { label: "mRTP", value: String(propInfo.mrtp ?? state.mrtp) },
  ];

  el.profileList.innerHTML = rows.map((row) => `
    <div class="mini-item">
      <div class="mini-item__top">
        <div class="mini-item__name">${escapeHtml(row.label)}</div>
      </div>
      <div class="mini-item__meta">${escapeHtml(row.value)}</div>
    </div>
  `).join("");
}

async function openSelectedGame() {
  if (!requireSession()) return;
  if (!state.selectedGame) {
    addActivity("warn", "No game selected", "Choose a lobby card first.", "warn");
    return;
  }

  try {
    const payload = await request("/game/new", {
      method: "POST",
      body: {
        cid: state.clubId,
        uid: state.uid,
        alias: state.selectedAlias,
      },
    });
    state.currentSession = {
      gid: Number(payload.gid),
      state: payload.state,
      game: payload.game,
      wallet: Number(payload.wallet ?? state.wallet),
    };
    state.wallet = Number(payload.wallet ?? state.wallet);
    el.walletValue.textContent = formatMoney(state.wallet);
    el.sessionState.textContent = payload.state || "opened";
    renderBoard(extractScreen(payload));
    addActivity("game", "Session opened", `${state.selectedAlias} · GID ${state.currentSession.gid}`, "success");
  } catch (err) {
    addActivity("error", "Open game failed", err.message, "error");
  }
}

async function spin() {
  if (!requireSession()) return;
  if (!state.currentSession?.gid) {
    addActivity("warn", "Open a session first", "Use the lobby selection.", "warn");
    return;
  }

  const payloadBody = {
    gid: state.currentSession.gid,
    bet: Number(el.bet.value || 0),
    sel: Number(el.sel.value || 0),
  };

  try {
    const payload = await request(isKenoGame() ? "/keno/spin" : "/slot/spin", {
      method: "POST",
      body: payloadBody,
    });
    applySpinResult(payload);
    addActivity("spin", `Spin #${payload.sid || "?"}`, `${formatMoney(payload.wallet ?? state.wallet)} · ${payload.state || ""}`, "success");
  } catch (err) {
    addActivity("error", "Spin failed", err.message, "error");
  }
}

async function doubleUp() {
  if (!requireSession()) return;
  if (!state.currentSession?.gid || isKenoGame()) {
    addActivity("warn", "Double up unavailable", "Use a slot session with gain.", "warn");
    return;
  }

  try {
    const payload = await request("/slot/doubleup", {
      method: "POST",
      body: {
        gid: state.currentSession.gid,
        mult: Number(el.mult.value || 2),
      },
    });
    applySpinResult(payload);
    addActivity("game", "Double up", `${formatMoney(payload.wallet ?? state.wallet)} · ${payload.state || ""}`, "success");
  } catch (err) {
    addActivity("error", "Double up failed", err.message, "error");
  }
}

async function collect() {
  if (!requireSession()) return;
  if (!state.currentSession?.gid || isKenoGame()) {
    addActivity("warn", "Collect unavailable", "Use a slot session.", "warn");
    return;
  }

  try {
    const payload = await request("/slot/collect", {
      method: "POST",
      body: {
        gid: state.currentSession.gid,
      },
    });
    applySpinResult(payload);
    addActivity("game", "Collect", `${formatMoney(payload.wallet ?? state.wallet)} · ${payload.state || ""}`, "success");
  } catch (err) {
    addActivity("error", "Collect failed", err.message, "error");
  }
}

function applySpinResult(payload) {
  state.currentSession = {
    ...(state.currentSession || {}),
    gid: Number(payload.gid || state.currentSession?.gid || 0),
    state: payload.state || state.currentSession?.state,
    game: payload.game || state.currentSession?.game,
    wallet: Number(payload.wallet ?? state.wallet),
  };
  state.wallet = Number(payload.wallet ?? state.wallet);
  el.walletValue.textContent = formatMoney(state.wallet);
  el.sessionState.textContent = payload.state || state.currentSession.state || "active";
  renderBoard(extractScreen(payload));
  renderSelectedGameMeta();
}

function renderBoard(screen) {
  const cells = normalizeScreen(screen);
  if (!cells.length) {
    el.board.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;">Open a game to render the board.</div>';
    return;
  }

  el.board.style.gridTemplateColumns = `repeat(${cells[0].length}, minmax(0, 1fr))`;
  el.board.innerHTML = cells.flat().map((cell) => {
    const value = SYMBOLS[cell] || cell || "•";
    return `<div class="cell">${escapeHtml(String(value))}</div>`;
  }).join("");
}

function normalizeScreen(screen) {
  if (!screen) return [];
  if (Array.isArray(screen) && Array.isArray(screen[0])) return screen;
  if (Array.isArray(screen)) return [screen];
  if (screen.rows && Array.isArray(screen.rows)) return screen.rows;
  if (screen.screen && Array.isArray(screen.screen)) return normalizeScreen(screen.screen);
  return [];
}

function extractScreen(payload) {
  return payload?.game?.screen || payload?.screen || payload?.game?.rows || payload?.game?.screen?.rows || [];
}

function gameAlias(game) {
  return `${normalizeText(game.Prov || game.prov || "")}/${normalizeText(game.Name || game.name || "")}`;
}

function gameTypeLabel(game) {
  const gt = Number(game.GT || game.gt || 0);
  if (gt === 2) return "keno";
  if (gt === 1) return "slot";
  return "game";
}

function gameShape(game) {
  const sx = Number(game.SX || game.sx || 0);
  const sy = Number(game.SY || game.sy || 0);
  if (sx && sy) return `${sx}x${sy}`;
  return "shape n/a";
}

function renderRtpLabel(game) {
  const rtp = game.RTP || game.rtp || [];
  if (!Array.isArray(rtp) || !rtp.length) return "";
  const first = Number(rtp[0]).toFixed(2);
  const last = Number(rtp[rtp.length - 1]).toFixed(2);
  return first === last ? `${first}% RTP` : `${first}%-${last}% RTP`;
}

function renderMiniRtpChips(game) {
  const rtp = game.RTP || game.rtp || [];
  if (!Array.isArray(rtp) || !rtp.length) return "";
  return rtp.slice(0, 2).map((value) => `<span class="chip chip--soft">${Number(value).toFixed(2)}%</span>`).join("");
}

function formatMoney(value) {
  const num = Number(value || 0);
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function requireSession() {
  if (!state.uid || !state.accessToken) {
    addActivity("warn", "Sign in required", "Use the account panel first.", "warn");
    return false;
  }
  return true;
}

function isKenoGame() {
  return Number(state.selectedGame?.GT || state.selectedGame?.gt || 0) === 2;
}

function renderActivity() {
  if (!state.activity.length) {
    el.activityLog.innerHTML = '<div class="empty-state">No activity yet.</div>';
    return;
  }
  el.activityLog.innerHTML = state.activity.map((item) => `
    <div class="ledger-item ${item.tone === "error" ? "is-error" : item.tone === "success" ? "is-success" : ""}">
      <div class="ledger-item__top">
        <div class="mini-item__name">${escapeHtml(item.title)}</div>
        <div class="label">${escapeHtml(timeAgo(item.at))}</div>
      </div>
      <div class="ledger-item__meta">${escapeHtml(item.detail || item.kind)}</div>
    </div>
  `).join("");
}

function timeAgo(iso) {
  const seconds = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
