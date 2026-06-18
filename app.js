/* ============================================================
   RECOOORD — app logic (v2)
   local state + localStorage · session rooms · no backend
   ============================================================ */
(function () {
  "use strict";

  /* ---------- scoring (clean & easy to edit) ---------- */
  const POINTS = { sucarra: 1, beer: 3, shot: 3, cocktail: 5 };
  const CATEGORIES = ["sucarra", "beer", "shot", "cocktail"];

  const APP = "recooord";
  const DEFAULT_SESSION = "00666";
  const NIGHT_START_HOUR = 6;
  const MAP_STEP = 6;

  // cross-device sync (zero-setup public relay)
  const SEED_TS = 1700000000000;                  // fixed past ts → demo never clobbers real play
  const CLIENT_ID = "rec_" + Math.random().toString(36).slice(2, 10);
  const BROKER = "wss://broker.emqx.io:8084/mqtt"; // public MQTT-over-WSS broker, no signup
  const MQTT_LIB = "https://unpkg.com/mqtt@5/dist/mqtt.min.js";
  const topicFor = (code) => "recooord/room/" + code;

  /* ============================================================
     SVG ICONS — everything is drawn, no emoji
     ============================================================ */
  const S = (inner) =>
    `<svg class="ic" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

  // category / drink icons
  const CAT = {
    sucarra: S(`<rect x="8" y="34" width="36" height="11" rx="1.5"/><line x1="36" y1="34" x2="36" y2="45"/><rect x="46" y="34" width="9" height="11" rx="1.5" fill="currentColor" stroke="none"/><path d="M16 28c-3-3 2-5 0-9"/><path d="M25 28c-3-3 2-5 0-9"/>`),
    beer: S(`<path d="M17 24h22v28a4 4 0 0 1-4 4H21a4 4 0 0 1-4-4z"/><path d="M39 30h6a6 6 0 0 1 6 6v4a6 6 0 0 1-6 6h-6"/><path d="M17 24c0-5 4-7 7-5 2-4 9-4 10 1 4-1 5 2 5 4"/><line x1="24" y1="36" x2="24" y2="46"/><line x1="32" y1="38" x2="32" y2="48"/>`),
    shot: S(`<path d="M21 18h22l-2.5 33a3 3 0 0 1-3 2.8H26.5a3 3 0 0 1-3-2.8z"/><path d="M22.5 34h19"/>`),
    cocktail: S(`<path d="M13 16h38L32 39z"/><line x1="32" y1="39" x2="32" y2="52"/><line x1="22" y1="53" x2="42" y2="53"/><line x1="42" y1="16" x2="30" y2="29"/><circle class="a-ac" cx="29" cy="30" r="3.2" fill="currentColor" stroke="none"/>`),
  };

  // map tile icons
  const TILEIC = {
    start: S(`<line x1="18" y1="11" x2="18" y2="55"/><rect x="18" y="14" width="30" height="21"/><g fill="currentColor" stroke="none"><rect x="18" y="14" width="7.5" height="5.25"/><rect x="33" y="14" width="7.5" height="5.25"/><rect x="25.5" y="19.25" width="7.5" height="5.25"/><rect x="40.5" y="19.25" width="7.5" height="5.25"/><rect x="18" y="24.5" width="7.5" height="5.25"/><rect x="33" y="24.5" width="7.5" height="5.25"/><rect x="25.5" y="29.75" width="7.5" height="5.25"/><rect x="40.5" y="29.75" width="7.5" height="5.25"/></g>`),
    wrong: S(`<circle cx="32" cy="32" r="20"/><line x1="22" y1="27" x2="29" y2="27"/><line x1="35" y1="27" x2="42" y2="27"/><path d="M23 42c3-5 5 4 9 0s5-5 9 0"/>`),
    party: S(`<path d="M14 51l11-27 16 16z"/><path d="M41 36l13-6"/><path d="M37 26l11-11"/><path d="M44 42l12 1"/><g fill="currentColor" stroke="none"><circle cx="51" cy="20" r="2.4"/><circle cx="44" cy="13" r="2.4"/><circle cx="55" cy="31" r="2.4"/></g>`),
    drop: S(`<path d="M32 11c9 13 15 19 15 27a15 15 0 0 1-30 0c0-8 6-14 15-27z"/><path d="M25 40a7 7 0 0 0 7 7"/>`),
    trophy: S(`<path d="M21 15h22v9a11 11 0 0 1-22 0z"/><path d="M21 18h-7v4a7 7 0 0 0 7 7"/><path d="M43 18h7v4a7 7 0 0 1-7 7"/><line x1="32" y1="35" x2="32" y2="43"/><path d="M23 51h18l-3-8H26z"/>`),
    spiral: S(`<path d="M32 32a3 3 0 1 1 3 3 7 7 0 1 1-7-7 11 11 0 1 1 11 11 15 15 0 1 1-15-15 19 19 0 1 1 19 19"/>`),
    skull: S(`<path d="M15 31a17 17 0 0 1 34 0v5c0 4-3 7-6 8v6a3 3 0 0 1-3 3H24a3 3 0 0 1-3-3v-6c-3-1-6-4-6-8z"/><circle class="a-ac" cx="25" cy="32" r="4.5" fill="currentColor" stroke="none"/><circle class="a-ac" cx="39" cy="32" r="4.5" fill="currentColor" stroke="none"/><path d="M30 41l2-4 2 4"/><path d="M27 53v-5M32 53v-5M37 53v-5"/>`),
  };

  // ui icons
  const UI = {
    gear: S(`<line x1="13" y1="20" x2="51" y2="20"/><circle cx="39" cy="20" r="4.6" fill="var(--bg-2)"/><line x1="13" y1="32" x2="51" y2="32"/><circle cx="25" cy="32" r="4.6" fill="var(--bg-2)"/><line x1="13" y1="44" x2="51" y2="44"/><circle cx="43" cy="44" r="4.6" fill="var(--bg-2)"/>`),
    close: S(`<line x1="18" y1="18" x2="46" y2="46"/><line x1="46" y1="18" x2="18" y2="46"/>`),
    plus: S(`<line x1="32" y1="15" x2="32" y2="49"/><line x1="15" y1="32" x2="49" y2="32"/>`),
    chevron: S(`<path d="M17 25l15 15 15-15"/>`),
    copy: S(`<rect x="24" y="24" width="24" height="28" rx="3"/><path d="M18 40V14a2 2 0 0 1 2-2h22"/>`),
    live: S(`<circle cx="32" cy="32" r="4.5" fill="currentColor" stroke="none"/><path d="M22 22a14 14 0 0 0 0 20M42 22a14 14 0 0 1 0 20M15 15a23 23 0 0 0 0 34M49 15a23 23 0 0 1 0 34"/>`),
    shuffle: S(`<path d="M13 21h9l20 22h9"/><path d="M13 43h9l7-7.5"/><path d="M37 35.5l5 7.5"/><path d="M46 13l6 8-6 8M46 35l6 8-6 8"/>`),
    trash: S(`<path d="M16 20h32"/><path d="M22 20l2-7h16l2 7"/><path d="M20 20l2.5 32h19L44 20"/><line x1="28" y1="28" x2="29" y2="44"/><line x1="36" y1="28" x2="35" y2="44"/>`),
  };

  // weird creatures (drawn) — accents (.a-ac) become purple / red
  const CREA = {
    jelly: S(`<path d="M13 31a19 15 0 0 1 38 0z"/><path d="M19 33c-1 7 2 10-1 17"/><path d="M27 35c-1 8 1 12 0 19"/><path d="M37 35c1 8-1 12 0 19"/><path d="M45 33c1 7-2 10 1 17"/><circle class="a-ac" cx="26" cy="25" r="2.7" fill="currentColor" stroke="none"/><circle class="a-ac" cx="38" cy="25" r="2.7" fill="currentColor" stroke="none"/>`),
    worm: S(`<path d="M22 53c-8-3 6-9-2-15s8-10 0-16"/><path d="M20 42l6-1"/><path d="M25 31l6-1"/><circle class="a-ac" cx="21" cy="17" r="2.7" fill="currentColor" stroke="none"/>`),
    beetle: S(`<ellipse cx="32" cy="37" rx="13" ry="17"/><line x1="32" y1="21" x2="32" y2="53"/><path d="M19 31l-8-4"/><path d="M19 39h-9"/><path d="M19 47l-8 4"/><path d="M45 31l8-4"/><path d="M45 39h9"/><path d="M45 47l8 4"/><path d="M27 20l-4-6"/><path d="M37 20l4-6"/><circle class="a-ac" cx="28" cy="28" r="2.3" fill="currentColor" stroke="none"/><circle class="a-ac" cx="36" cy="28" r="2.3" fill="currentColor" stroke="none"/>`),
    blob: S(`<path d="M13 39c0-15 38-15 38 0 0 9-9 13-19 13S13 48 13 39z"/><path d="M25 49c4-3 10-3 14 0"/><circle class="a-ac" cx="25" cy="36" r="2.7" fill="currentColor" stroke="none"/><circle class="a-ac" cx="39" cy="36" r="2.7" fill="currentColor" stroke="none"/>`),
    tardigrade: S(`<path d="M13 30h31a8 8 0 0 1 8 8v2a8 8 0 0 1-8 8H13z"/><path d="M16 48l-3 7"/><path d="M24 50l-2 7"/><path d="M32 50v7"/><path d="M40 49l3 7"/><path d="M50 37c4-1 5 2 4 5"/><circle class="a-ac" cx="21" cy="36" r="2.4" fill="currentColor" stroke="none"/><circle class="a-ac" cx="29" cy="36" r="2.4" fill="currentColor" stroke="none"/>`),
    squid: S(`<path d="M32 10c10 0 14 9 14 19v7H18v-7c0-10 4-19 14-19z"/><path d="M20 36c-2 8-2 12-5 18"/><path d="M27 36c-1 9-1 13-2 20"/><path d="M37 36c1 9 1 13 2 20"/><path d="M44 36c2 8 2 12 5 18"/><circle class="a-ac" cx="26" cy="30" r="3" fill="currentColor" stroke="none"/><circle class="a-ac" cx="38" cy="30" r="3" fill="currentColor" stroke="none"/>`),
    octopus: S(`<path d="M18 33a14 14 0 0 1 28 0v5H18z"/><path d="M18 38c-4 3-6 8-11 8"/><path d="M25 39c-2 6-6 10-9 14"/><path d="M32 40c0 6-1 11-1 16"/><path d="M39 39c2 6 6 10 9 14"/><path d="M46 38c4 3 6 8 11 8"/><circle class="a-ac" cx="26" cy="31" r="3" fill="currentColor" stroke="none"/><circle class="a-ac" cx="38" cy="31" r="3" fill="currentColor" stroke="none"/>`),
    crab: S(`<path d="M18 31a14 11 0 0 1 28 0v5a14 9 0 0 1-28 0z"/><path d="M32 40v13"/><path d="M23 41l-6 8"/><path d="M41 41l6 8"/><path d="M19 29l-7-5"/><path d="M45 29l7-5"/><circle class="a-ac" cx="27" cy="29" r="2.4" fill="currentColor" stroke="none"/><circle class="a-ac" cx="37" cy="29" r="2.4" fill="currentColor" stroke="none"/>`),
    shark: S(`<path d="M9 35c11-7 28-9 47-4-6 4-9 7-11 13-9-2-18-3-27-5-4-1-7-2-9-4z"/><path d="M31 31l7-13 3 15"/><path d="M14 34l-6-10 1 13"/><path d="M40 44c2 5 6 7 11 8"/><circle class="a-ac" cx="20" cy="34" r="2.5" fill="currentColor" stroke="none"/>`),
    angler: S(`<path d="M15 36a17 12 0 0 1 34 0 17 12 0 0 1-34 0z"/><path d="M49 30l8-4-6 11"/><path d="M21 30c4 4 4 8 0 12"/><path d="M19 40l3-3 3 3 3-3 3 3"/><path d="M41 23c0-7 6-6 6-11"/><circle class="a-ac" cx="46" cy="11" r="3.2" fill="currentColor" stroke="none"/><circle class="a-ac" cx="27" cy="33" r="3.4" fill="currentColor" stroke="none"/>`),
    axolotl: S(`<path d="M20 38a14 10 0 0 1 28 0c0 8-7 13-14 13s-14-5-14-13z"/><path d="M20 33l-9-4"/><path d="M20 40h-9"/><path d="M48 33l9-4"/><path d="M48 40h9"/><path d="M30 47c3 2 7 2 10 0"/><circle class="a-ac" cx="29" cy="38" r="2.7" fill="currentColor" stroke="none"/><circle class="a-ac" cx="39" cy="38" r="2.7" fill="currentColor" stroke="none"/>`),
    snail: S(`<path d="M14 49h27"/><path d="M40 47a13 13 0 1 0-13-13c0 5 4 8 8 8s7-3 7-7-3-6-6-6"/><path d="M15 49c-2-5 1-9 5-10l6-1"/><path d="M21 39l-2-8"/><path d="M26 38v-9"/><circle class="a-ac" cx="18" cy="29" r="2.3" fill="currentColor" stroke="none"/>`),
    moth: S(`<path d="M32 23c-8-9-23-7-23 6 0 11 15 13 23 6"/><path d="M32 23c8-9 23-7 23 6 0 11-15 13-23 6"/><line x1="32" y1="21" x2="32" y2="47"/><path d="M30 21c-2-7-6-7-8-10"/><path d="M34 21c2-7 6-7 8-10"/><circle class="a-ac" cx="21" cy="31" r="3" fill="currentColor" stroke="none"/><circle class="a-ac" cx="43" cy="31" r="3" fill="currentColor" stroke="none"/>`),
    spider: S(`<circle cx="32" cy="34" r="11"/><path d="M21 30l-12-6"/><path d="M20 34H7"/><path d="M21 39l-12 6"/><path d="M23 43l-9 10"/><path d="M43 30l12-6"/><path d="M44 34h13"/><path d="M43 39l12 6"/><path d="M41 43l9 10"/><circle class="a-ac" cx="28" cy="32" r="2.2" fill="currentColor" stroke="none"/><circle class="a-ac" cx="36" cy="32" r="2.2" fill="currentColor" stroke="none"/>`),
    scorpion: S(`<path d="M21 45c-2-7 3-11 9-11s9 3 13 3"/><path d="M17 45l-6-2"/><path d="M19 39l-7-4"/><path d="M43 37c9 0 11-7 8-13-1-3-5-3-5 1"/><path d="M28 41l-6-8"/><path d="M31 43l-2-10"/><circle class="a-ac" cx="46" cy="20" r="3.2" fill="currentColor" stroke="none"/>`),
    snake: S(`<path d="M13 50c12 2 10-10 2-13-9-3-7-13 4-13 8 0 12 5 18 5"/><path d="M50 30l7-3M50 33l7 3"/><circle class="a-ac" cx="46" cy="30" r="2.5" fill="currentColor" stroke="none"/>`),
  };

  const CREATURE_KEYS = Object.keys(CREA);

  function catIcon(k) { return CAT[k] || ""; }
  function avatarSvg(key) { return CREA[key] || CREA.jelly; }
  function uiIcon(k) { return UI[k] || ""; }

  /* ---------- avatars (creature + name) ---------- */
  const AVATARS = [
    { key: "jelly", it: "Medusa", en: "Jellyfish" },
    { key: "worm", it: "Verme", en: "Worm" },
    { key: "beetle", it: "Scarabeo", en: "Beetle" },
    { key: "blob", it: "Blobfish", en: "Blobfish" },
    { key: "tardigrade", it: "Tardigrado", en: "Tardigrade" },
    { key: "squid", it: "Calamaro", en: "Squid" },
    { key: "octopus", it: "Polpo", en: "Octopus" },
    { key: "crab", it: "Limulo", en: "Horseshoe Crab" },
    { key: "shark", it: "Squalo Goblin", en: "Goblin Shark" },
    { key: "angler", it: "Pesce Abissale", en: "Deep Sea Fish" },
    { key: "axolotl", it: "Axolotl", en: "Axolotl" },
    { key: "snail", it: "Lumaca", en: "Snail" },
    { key: "moth", it: "Falena", en: "Moth" },
    { key: "spider", it: "Ragno", en: "Spider" },
    { key: "scorpion", it: "Scorpione", en: "Scorpion" },
    { key: "snake", it: "Serpe", en: "Snake" },
  ];
  const avatarByKey = (k) => AVATARS.find((a) => a.key === k) || AVATARS[0];

  /* ---------- detail types ---------- */
  const DETAILS = {
    sucarra: [
      { it: "Sucarra normale", en: "Normal sucarra" },
      { it: "Sucarra rollata", en: "Rolled sucarra" },
      { it: "Tabacco", en: "Tobacco" },
      { it: "Custom", en: "Custom" },
    ],
    beer: [
      { it: "Beer 33", en: "Beer 33" },
      { it: "Beer 66", en: "Beer 66" },
      { it: "Pinta", en: "Pint" },
      { it: "Custom", en: "Custom" },
    ],
    shot: [
      { it: "Shot Vodka", en: "Vodka shot" },
      { it: "Shot Tequila", en: "Tequila shot" },
      { it: "Shot Whiskey", en: "Whiskey shot" },
      { it: "Shot Rum", en: "Rum shot" },
      { it: "Custom", en: "Custom" },
    ],
    cocktail: [
      { it: "Gin Tonic", en: "Gin Tonic" },
      { it: "Negroni", en: "Negroni" },
      { it: "Spritz", en: "Spritz" },
      { it: "Mojito", en: "Mojito" },
      { it: "Margarita", en: "Margarita" },
      { it: "Moscow Mule", en: "Moscow Mule" },
      { it: "Vodka Lemon", en: "Vodka Lemon" },
      { it: "Whiskey Sour", en: "Whiskey Sour" },
      { it: "Custom", en: "Custom" },
    ],
  };

  /* ---------- map tiles: la fattoria degli animaletti ---------- */
  const TILES = [
    { it: "Partenza", en: "Start", ic: "start", cls: "tile--start" },
    { it: "Angolo Sucarra", en: "Sucarra Corner", cat: "sucarra", cls: "" },
    { it: "Prima Birra", en: "First Beer", cat: "beer", cls: "" },
    { it: "Stazione Shot", en: "Shot Station", cat: "shot", cls: "" },
    { it: "Cocktail Bar", en: "Cocktail Bar", cat: "cocktail", cls: "" },
    { it: "Scelta Sbagliata", en: "Wrong Decision", ic: "wrong", cls: "" },
    { it: "Afterparty", en: "Afterparty", ic: "party", cls: "" },
    { it: "Penalità Idratazione", en: "Hydration Penalty", ic: "drop", cls: "" },
    { it: "Record Leggendario", en: "Legendary Record", ic: "trophy", cls: "tile--legend" },
    { it: "Casella Blackout", en: "Blackout Square", ic: "spiral", cls: "" },
    { it: "Muro della Vergogna", en: "Hall of Shame", ic: "skull", cls: "tile--shame" },
  ];
  function tileIcon(tile) {
    return tile.cat ? catIcon(tile.cat) : TILEIC[tile.ic] || "";
  }

  /* ---------- i18n ---------- */
  const I18N = {
    it: {
      heroKicker: "SCOREBOARD UFFICIALE", players: "Giocatori", ranking: "Classifica",
      records: "Record", map: "Mappa", stats: "Statistiche", overall: "Overall",
      sucarra: "Sucarra", beer: "Beer", shot: "Shot", cocktail: "Cocktail",
      tonight: "Stasera", week: "Settimana", alltime: "Sempre", add: "Aggiungi",
      newPlayer: "Nuovo Giocatore", namePh: "Nome", score: "Punteggio", rank: "Rank",
      cheating: "Cheating", uncheat: "Annulla Cheating", delete: "Elimina",
      lastActions: "Ultime azioni", settings: "Impostazioni", language: "Lingua",
      resetDemo: "Reset dati demo", wipeAll: "Cancella tutto", scoringTitle: "Punteggi",
      mapHint: "Più punti = più avanti. I cheater finiscono al Muro della Vergogna.",
      emptyPlayers: "Nessun giocatore. Premi + per iniziare.",
      footer: "RECOOORD — libertà è partecipazione",
      stTotalScore: "Punti totali", stSucarra: "Sucarre", stBeer: "Birre",
      stShot: "Shot", stCocktail: "Cocktail", stTop: "Top player",
      stDanger: "Categoria + pericolosa", stPlayers: "Giocatori",
      flagged: "Squalificati", confirmWipe: "Cancellare TUTTI i dati di questa sessione?",
      confirmReset: "Ripristinare i dati demo? I dati attuali andranno persi.",
      noActions: "Ancora niente. Tocca +1.", customPh: "Scrivi qui...",
      session: "Sessione", sessionCode: "Codice sessione", copy: "Copia", copied: "Copiato!",
      join: "Entra", joinOther: "Entra in un'altra sessione",
      sessionHint: "Stesso codice = stessa sessione. Condividilo per giocare insieme su qualsiasi dispositivo.",
      sessionTab: "Sessione attiva",
      online: "● Online · multi-dispositivo", localOnly: "○ Solo locale",
    },
    en: {
      heroKicker: "OFFICIAL SCOREBOARD", players: "Players", ranking: "Ranking",
      records: "Records", map: "Map", stats: "Statistics", overall: "Overall",
      sucarra: "Sucarra", beer: "Beer", shot: "Shot", cocktail: "Cocktail",
      tonight: "Tonight", week: "This Week", alltime: "All Time", add: "Add",
      newPlayer: "New Player", namePh: "Name", score: "Score", rank: "Rank",
      cheating: "Cheating", uncheat: "Undo Cheating", delete: "Delete",
      lastActions: "Last actions", settings: "Settings", language: "Language",
      resetDemo: "Reset demo data", wipeAll: "Wipe all", scoringTitle: "Scoring",
      mapHint: "More points = further ahead. Cheaters land in the Hall of Shame.",
      emptyPlayers: "No players yet. Hit + to start.",
      footer: "RECOOORD — freedom is participation",
      stTotalScore: "Total score", stSucarra: "Sucarras", stBeer: "Beers",
      stShot: "Shots", stCocktail: "Cocktails", stTop: "Top player",
      stDanger: "Most dangerous", stPlayers: "Players",
      flagged: "Flagged", confirmWipe: "Wipe ALL data in this session?",
      confirmReset: "Restore demo data? Current data will be lost.",
      noActions: "Nothing yet. Tap +1.", customPh: "Type here...",
      session: "Session", sessionCode: "Session code", copy: "Copy", copied: "Copied!",
      join: "Join", joinOther: "Join another session",
      sessionHint: "Same code = same session. Share it to play together on any device.",
      sessionTab: "Active session",
      online: "● Online · cross-device", localOnly: "○ Local only",
    },
  };

  /* ============================================================
     STATE
     ============================================================ */
  let state = { players: [], lang: "it", session: DEFAULT_SESSION, collapsedStats: true, clearedAt: 0, tombstones: {} };
  let ui = { cat: "overall", time: "all", detailId: null };
  let pendingAvatar = null;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const t = (k) => (I18N[state.lang] && I18N[state.lang][k]) || I18N.it[k] || k;
  const uid = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now = () => Date.now();
  const avatarName = (a) => (state.lang === "en" ? a.en : a.it);

  /* ============================================================
     PERSISTENCE + SESSIONS
     ============================================================ */
  const roomKey = () => APP + ":s:" + state.session;
  let bc = null;
  try {
    bc = new BroadcastChannel(APP);
    bc.onmessage = (e) => { if (e.data && e.data.session === state.session) reloadRoom(); };
  } catch (_) {}

  function savePrefs() {
    try {
      localStorage.setItem(APP + ":lang", state.lang);
      localStorage.setItem(APP + ":current", state.session);
      localStorage.setItem(APP + ":ui", JSON.stringify({ collapsedStats: state.collapsedStats }));
    } catch (_) {}
  }
  function roomData() {
    return { players: state.players, clearedAt: state.clearedAt || 0, tombstones: state.tombstones || {}, updatedAt: now() };
  }
  function saveRoom(opts) {
    opts = opts || {};
    try {
      localStorage.setItem(roomKey(), JSON.stringify(roomData()));
      if (opts.broadcast !== false && bc) bc.postMessage({ session: state.session, t: now() });
    } catch (_) {}
    if (opts.publish !== false) publishState();
  }
  function save() { saveRoom(); }

  function loadPrefs() {
    try {
      state.lang = localStorage.getItem(APP + ":lang") || "it";
      state.session = localStorage.getItem(APP + ":current") || DEFAULT_SESSION;
      const u = JSON.parse(localStorage.getItem(APP + ":ui") || "{}");
      state.collapsedStats = u.collapsedStats !== undefined ? !!u.collapsedStats : true; // closed by default
    } catch (_) {}
    if (!I18N[state.lang]) state.lang = "it";
  }
  function applyRoom(d) {
    state.players = d.players || [];
    state.clearedAt = d.clearedAt || 0;
    state.tombstones = d.tombstones || {};
  }
  function loadRoom() {
    try {
      const raw = localStorage.getItem(roomKey());
      if (raw) { applyRoom(JSON.parse(raw)); return true; }
    } catch (_) {}
    applyRoom({});
    return false;
  }
  function reloadRoom() {
    try {
      const raw = localStorage.getItem(roomKey());
      if (raw) { applyRoom(JSON.parse(raw)); render(); }
    } catch (_) {}
  }
  window.addEventListener("storage", (e) => { if (e.key === roomKey()) reloadRoom(); });

  function normalizeCode(c) {
    return String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  }
  function joinSession(code) {
    code = normalizeCode(code);
    if (!code) return;
    state.session = code;
    savePrefs();
    const had = loadRoom();
    if (!had) { if (code === DEFAULT_SESSION) seedDemo(false); else saveRoom(); }
    closeSession();
    syncSessionUI();
    cloudResubscribe();
    render();
  }

  /* ============================================================
     CLOUD SYNC — public MQTT relay + CRDT-ish merge
     ============================================================ */
  let mqttClient = null, currentTopic = null, mqttTried = false, cloudOn = false;

  // union players by id (newer updatedAt wins); honor tombstones + wipe (clearedAt)
  function mergeRooms(local, remote) {
    const clearedAt = Math.max(local.clearedAt || 0, remote.clearedAt || 0);
    const tomb = Object.assign({}, local.tombstones || {});
    const rt = remote.tombstones || {};
    for (const id in rt) tomb[id] = Math.max(tomb[id] || 0, rt[id]);
    const byId = {};
    (local.players || []).forEach((p) => { byId[p.id] = p; });
    (remote.players || []).forEach((rp) => {
      const lp = byId[rp.id];
      if (!lp || (rp.updatedAt || 0) > (lp.updatedAt || 0)) byId[rp.id] = rp;
    });
    const players = Object.values(byId).filter((p) =>
      (tomb[p.id] || 0) < (p.updatedAt || 0) && (p.createdAt || 0) >= clearedAt);
    return { players, clearedAt, tombstones: tomb };
  }
  function roomSig() {
    return JSON.stringify({
      p: [...state.players].sort((a, b) => (a.id < b.id ? -1 : 1)),
      c: state.clearedAt || 0, t: state.tombstones || {},
    });
  }
  function roomPayload() {
    return {
      players: state.players.map((p) => ({ ...p, logs: (p.logs || []).slice(-250) })),
      clearedAt: state.clearedAt || 0, tombstones: state.tombstones || {}, src: CLIENT_ID,
    };
  }
  function onCloudMessage(payload) {
    let remote;
    try { remote = JSON.parse(typeof payload === "string" ? payload : payload.toString()); } catch (_) { return; }
    if (!remote || remote.src === CLIENT_ID) return;
    const before = roomSig();
    const merged = mergeRooms({ players: state.players, clearedAt: state.clearedAt, tombstones: state.tombstones }, remote);
    state.players = merged.players; state.clearedAt = merged.clearedAt; state.tombstones = merged.tombstones;
    if (roomSig() !== before) { saveRoom(); render(); }      // changed → persist, publish, repaint
    else saveRoom({ publish: false, broadcast: false });     // converged → just cache locally
  }
  function ensureMqtt(cb) {
    if (window.mqtt) return cb(window.mqtt);
    if (mqttTried) return cb(null);
    mqttTried = true;
    const s = document.createElement("script");
    s.src = MQTT_LIB;
    s.onload = () => cb(window.mqtt || null);
    s.onerror = () => cb(null);
    document.head.appendChild(s);
  }
  function cloudConnect() {
    ensureMqtt((M) => {
      if (!M) { updateConn(false); return; }
      try {
        mqttClient = M.connect(BROKER, { clientId: CLIENT_ID, reconnectPeriod: 5000, connectTimeout: 8000, clean: true, keepalive: 30 });
        mqttClient.on("connect", () => { currentTopic = topicFor(state.session); mqttClient.subscribe(currentTopic); updateConn(true); publishState(); });
        mqttClient.on("close", () => updateConn(false));
        mqttClient.on("offline", () => updateConn(false));
        mqttClient.on("error", () => {});
        mqttClient.on("message", (tp, pl) => onCloudMessage(pl));
      } catch (_) { updateConn(false); }
    });
  }
  function cloudResubscribe() {
    if (mqttClient && mqttClient.connected) {
      if (currentTopic) { try { mqttClient.unsubscribe(currentTopic); } catch (_) {} }
      currentTopic = topicFor(state.session);
      mqttClient.subscribe(currentTopic);
      publishState();
    } else cloudConnect();
  }
  function publishState() {
    if (!mqttClient || !mqttClient.connected) return;
    try { mqttClient.publish(topicFor(state.session), JSON.stringify(roomPayload()), { retain: true, qos: 0 }); } catch (_) {}
  }
  function updateConn(on) {
    cloudOn = on;
    document.documentElement.classList.toggle("cloud-on", on);
    const st = $("#sessionStatus");
    if (st) st.textContent = on ? t("online") : t("localOnly");
  }

  /* ============================================================
     TIME WINDOWS
     ============================================================ */
  function tonightStart() {
    const d = new Date();
    if (d.getHours() < NIGHT_START_HOUR) d.setDate(d.getDate() - 1);
    d.setHours(NIGHT_START_HOUR, 0, 0, 0);
    return d.getTime();
  }
  function windowStart() {
    if (ui.time === "tonight") return tonightStart();
    if (ui.time === "week") return now() - 7 * 24 * 3600 * 1000;
    return 0;
  }

  /* ============================================================
     SCORING / DERIVED
     ============================================================ */
  function scoreFromCounts(c) { return CATEGORIES.reduce((s, k) => s + (c[k] || 0) * POINTS[k], 0); }
  function totalScore(p) { return scoreFromCounts(p.counts); }
  function countsInWindow(p, since) {
    if (!since) return { ...p.counts };
    const c = { sucarra: 0, beer: 0, shot: 0, cocktail: 0 };
    for (const log of p.logs) if (log.ts >= since && c[log.category] != null) c[log.category]++;
    return c;
  }
  function rankValue(p, since) {
    const c = countsInWindow(p, since);
    return ui.cat === "overall" ? scoreFromCounts(c) : c[ui.cat] || 0;
  }
  // dense ranking (ties share a rank, no gaps)
  function denseRank(arr) {
    let r = 0, prev = null;
    arr.forEach((e) => { if (prev === null || e.v !== prev) { r += 1; prev = e.v; } e.rank = r; });
    return arr;
  }
  function officialRanking() {
    const clean = state.players.filter((p) => !p.cheating);
    const arr = clean.map((p) => ({ p, v: totalScore(p) }))
      .sort((a, b) => b.v - a.v || a.p.createdAt - b.p.createdAt);
    return denseRank(arr);
  }
  function rankOf(playerId) {
    const e = officialRanking().find((x) => x.p.id === playerId);
    return e ? e.rank : null;
  }

  /* ============================================================
     MUTATIONS
     ============================================================ */
  function createPlayer(name) {
    name = (name || "").trim();
    if (!name) return null;
    const p = {
      id: uid(), name: name.slice(0, 20),
      avatar: pendingAvatar || randomAvatar(), cheating: false,
      counts: { sucarra: 0, beer: 0, shot: 0, cocktail: 0 },
      logs: [], createdAt: now(), updatedAt: now(),
    };
    state.players.push(p);
    pendingAvatar = null;
    save();
    return p;
  }
  function deletePlayer(id) {
    state.tombstones[id] = now();
    state.players = state.players.filter((p) => p.id !== id);
    save();
  }
  function addAction(id, category, detail) {
    const p = state.players.find((x) => x.id === id);
    if (!p || !CATEGORIES.includes(category)) return;
    p.counts[category] = (p.counts[category] || 0) + 1;
    p.logs.push({ category, detail: detail || null, ts: now() });
    p.updatedAt = now();
    save();
  }
  function toggleCheating(id) {
    const p = state.players.find((x) => x.id === id);
    if (!p) return;
    p.cheating = !p.cheating; p.updatedAt = now(); save();
  }
  function randomAvatar() { return avatarByKey(CREATURE_KEYS[Math.floor(Math.random() * CREATURE_KEYS.length)]); }

  /* ============================================================
     DEMO SEED — names + standings requested
     ============================================================ */
  function seedDemo(authoritative) {
    const T = tonightStart();
    const H = 3600 * 1000;
    // weak (first-run) seed uses a fixed past ts so real cross-device play always wins;
    // authoritative (manual "reset demo") wipes the room and seeds fresh/newest.
    const base = authoritative ? now() : SEED_TS;
    if (authoritative) { state.clearedAt = now() - 1; state.tombstones = {}; }
    const mk = (name, key, cheat, spec, order) => {
      const stamp = base + order;
      const p = {
        id: "seed_" + name, name, avatar: avatarByKey(key), cheating: !!cheat,
        counts: { sucarra: 0, beer: 0, shot: 0, cocktail: 0 },
        logs: [], createdAt: stamp, updatedAt: stamp,
      };
      spec.forEach(([cat, n, off]) => {
        for (let i = 0; i < n; i++) {
          p.counts[cat]++;
          p.logs.push({ category: cat, detail: null, ts: T + off + i * (H / 4) - Math.random() * H });
        }
      });
      return p;
    };
    // scores (beer=3): lens58 gems50 ninja43 serpe34 fred26 gaber26 donnie15 ; faustiere95 (flagged)
    state.players = [
      mk("lens", "axolotl", false, [["cocktail", 6, H], ["shot", 4, 2 * H], ["beer", 4, H], ["sucarra", 4, H]], 1),
      mk("gems", "jelly", false, [["cocktail", 5, H], ["shot", 3, 2 * H], ["beer", 4, -20 * H], ["sucarra", 4, H]], 2),
      mk("ninja", "squid", false, [["cocktail", 4, H], ["shot", 4, H], ["beer", 2, -40 * H], ["sucarra", 5, -38 * H]], 3),
      mk("serpe", "snake", false, [["cocktail", 3, H], ["shot", 2, 2 * H], ["beer", 3, H], ["sucarra", 4, -10 * H]], 4),
      mk("fred", "beetle", false, [["cocktail", 2, -60 * H], ["shot", 2, H], ["beer", 2, H], ["sucarra", 4, H]], 5),
      mk("gaber", "moth", false, [["cocktail", 3, H], ["shot", 1, H], ["beer", 1, -58 * H], ["sucarra", 5, H]], 6),
      mk("donnie", "snail", false, [["cocktail", 1, H], ["shot", 1, H], ["beer", 1, H], ["sucarra", 4, -12 * H]], 7),
      mk("faustiere", "shark", true, [["cocktail", 9, H], ["shot", 6, H], ["beer", 7, 2 * H], ["sucarra", 11, H]], 8),
    ];
    saveRoom();
  }

  /* ============================================================
     DRUNK TEXT — per-letter double vision + size disproportion
     ============================================================ */
  const DZ = [1.2, 0.8, 1.06, 1.3, 0.88, 1.16, 0.76, 1.24, 0.96, 1.12, 0.84, 1.28];
  const DY = [-0.05, 0.06, -0.02, 0.07, 0.01, -0.06, 0.04, -0.03, 0.05, -0.04, 0.02, -0.05];
  const DR = [-3, 2, -1, 3, -2, 1, -3, 2, -1, 3, -2, 1];
  function escAttr(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function drunkify(text) {
    let i = 0;
    // group letters per word so line breaks only happen at spaces (never mid-word)
    return String(text).split(/\s+/).filter(Boolean).map((word) => {
      let inner = "";
      for (const ch of word) {
        const e = escAttr(ch);
        inner += `<span class="dl" data-ch="${e}" style="font-size:${DZ[i % DZ.length]}em;transform:translateY(${DY[i % DY.length]}em) rotate(${DR[i % DR.length]}deg)">${e}</span>`;
        i++;
      }
      return `<span class="dword">${inner}</span>`;
    }).join(" ");
  }
  function renderDrunk(el) {
    const txt = el.getAttribute("data-text") != null ? el.getAttribute("data-text") : el.textContent;
    el.innerHTML = drunkify(txt);
  }
  function setDrunk(el, text) { el.setAttribute("data-text", text); el.innerHTML = drunkify(text); }
  function refreshDrunk(root = document) { $$(".drunk", root).forEach(renderDrunk); }

  /* ============================================================
     RENDER
     ============================================================ */
  function render() {
    renderPodium(); renderStats(); renderLeaderboard();
    renderPlayers(); renderMap(); renderLbCount();
    if (ui.detailId) renderDetail();
  }

  function avatarBox(p, cls) {
    return `<span class="ava ${cls || ""} ${p.cheating ? "is-cheating" : ""}">${avatarSvg(p.avatar.key)}</span>`;
  }

  function renderPodium() {
    const el = $("#podium");
    const top = officialRanking().slice(0, 3);
    if (!top.length) { el.innerHTML = ""; return; }
    const slot = (entry, pos) => {
      if (!entry) return "";
      const { p, v } = entry;
      return `<div class="pod pod--${pos}" data-player="${p.id}">
        <div class="pod__rank">#${entry.rank}</div>
        <span class="pod__ava">${avatarSvg(p.avatar.key)}</span>
        <div class="pod__name">${esc(p.name)}</div>
        <div class="pod__score drunk drunk--soft" data-text="${v}">${v}</div>
      </div>`;
    };
    el.innerHTML = slot(top[1], 2) + slot(top[0], 1) + slot(top[2], 3);
    refreshDrunk(el);
  }

  function renderStats() {
    const clean = state.players.filter((p) => !p.cheating);
    const sum = (k) => clean.reduce((s, p) => s + p.counts[k], 0);
    const totSucarra = sum("sucarra"), totBeer = sum("beer"), totShot = sum("shot"), totCocktail = sum("cocktail");
    const totScore = clean.reduce((s, p) => s + totalScore(p), 0);
    const top = officialRanking()[0];
    const contrib = CATEGORIES.map((k) => ({ k, v: sum(k) * POINTS[k] })).sort((a, b) => b.v - a.v);
    const danger = totScore > 0 ? contrib[0].k : null;

    const card = (idx, num, label, opts = {}) => `
      <div class="stat ${opts.cls || ""}" data-idx="${idx}">
        <div class="stat__num ${opts.purple ? "stat__num--p" : ""} ${opts.drunk ? "drunk drunk--soft" : "trace"}" data-text="${num}">${num}</div>
        <div class="stat__label">${label}</div>
      </div>`;

    $("#stats").innerHTML =
      card("01", totScore, t("stTotalScore"), { purple: true, drunk: true }) +
      card("02", totSucarra, t("stSucarra")) +
      card("03", totBeer, t("stBeer")) +
      card("04", totShot, t("stShot")) +
      card("05", totCocktail, t("stCocktail")) +
      card("06", state.players.length, t("stPlayers")) +
      `<div class="stat stat--wide stat--accent" data-idx="07">
        <div class="stat__num stat__num--row">${top ? `<span class="stat__ava">${avatarSvg(top.p.avatar.key)}</span> ${esc(top.p.name)}` : "—"}</div>
        <div class="stat__label">${t("stTop")}${top ? ` · ${top.v} pts` : ""}</div>
      </div>` +
      `<div class="stat stat--wide stat--accent" data-idx="08">
        <div class="stat__num stat__num--row">${danger ? `<span class="stat__ava">${catIcon(danger)}</span> ${t(danger)}` : "—"}</div>
        <div class="stat__label">${t("stDanger")}</div>
      </div>`;
    refreshDrunk($("#stats"));
  }

  function renderLeaderboard() {
    const since = windowStart();
    const flagged = state.players.filter((p) => p.cheating);
    const active = state.players.filter((p) => !p.cheating);
    const ranked = denseRank(active.map((p) => ({ p, v: rankValue(p, since) }))
      .sort((a, b) => b.v - a.v || a.p.createdAt - b.p.createdAt));
    const max = Math.max(1, ranked.length ? ranked[0].v : 1);
    const unit = ui.cat === "overall" ? "pts" : "×";

    const row = (entry) => {
      const { p, v, rank } = entry;
      const pct = Math.round((v / max) * 100);
      const cls = rank <= 3 ? `lbrow--${rank}` : "";
      return `<li class="lbrow ${cls}" data-player="${p.id}">
        <div class="lbrow__rank">${rank}</div>
        ${avatarBox(p, "ava--lb")}
        <div class="lbrow__main">
          <div class="lbrow__name trace" data-text="${esc(p.name)}">${esc(p.name)}</div>
          <div class="lbrow__bar"><span class="lbrow__fill" style="inset:0 ${100 - pct}% 0 0"></span></div>
        </div>
        <div class="lbrow__val">${v}<small>${unit}</small></div>
      </li>`;
    };
    const flagRow = (p) => {
      const v = rankValue(p, since);
      return `<li class="lbrow is-cheating" data-player="${p.id}">
        <div class="lbrow__rank lbrow__rank--x">${uiIcon("close")}</div>
        ${avatarBox(p, "ava--lb")}
        <div class="lbrow__main">
          <div class="lbrow__name">${esc(p.name)} <span class="badge-cheat">CHEATING</span></div>
          <div class="lbrow__flagtag">${t("flagged").toUpperCase()}</div>
        </div>
        <div class="lbrow__val">${v}<small>${unit}</small></div>
      </li>`;
    };

    let html = ranked.map(row).join("");
    if (flagged.length) html += flagged.map(flagRow).join("");
    $("#leaderboard").innerHTML = html ||
      `<li class="feed__empty" style="padding:18px;text-align:center">${esc(t("emptyPlayers"))}</li>`;
  }

  function renderLbCount() {
    const n = state.players.length, f = state.players.filter((p) => p.cheating).length;
    $("#lbCountTag").textContent = `${n} PL · ${f} DQ`;
    $("#playersCountTag").textContent = String(n);
  }

  function renderPlayers() {
    const wrap = $("#players"), empty = $("#playersEmpty");
    if (!state.players.length) { wrap.innerHTML = ""; empty.hidden = false; return; }
    empty.hidden = true;
    const order = [...state.players].sort((a, b) => {
      if (a.cheating !== b.cheating) return a.cheating ? 1 : -1;
      return totalScore(b) - totalScore(a);
    });
    wrap.innerHTML = order.map((p) => {
      const sc = totalScore(p);
      const rank = p.cheating ? "DQ" : `#${rankOf(p.id)}`;
      const counts = CATEGORIES.map((k) => `
        <div class="pcount">
          <span class="pcount__ico">${catIcon(k)}</span>
          <span class="pcount__n">${p.counts[k]}</span>
          <span class="pcount__lbl">${t(k)}</span>
        </div>`).join("");
      return `<article class="pcard ${p.cheating ? "is-cheating" : ""}" data-player="${p.id}">
        ${p.cheating ? `<span class="pcard__badge"><span class="badge-cheat">CHEATING</span></span>` : ""}
        <div class="pcard__score">
          <div class="pcard__scorenum drunk drunk--soft" data-text="${sc}">${sc}</div>
          <div class="pcard__scorelbl">${t("score").toUpperCase()}</div>
        </div>
        <div class="pcard__top">
          ${avatarBox(p, "ava--card")}
          <div class="pcard__id">
            <div class="pcard__name trace" data-text="${esc(p.name)}">${esc(p.name)}</div>
            <div class="pcard__rank">${rank} · ${esc(avatarName(p.avatar))}</div>
          </div>
        </div>
        <div class="pcard__counts">${counts}</div>
        <button class="pcard__cheat" data-cheat="${p.id}" type="button">${p.cheating ? t("uncheat") : t("cheating")}</button>
      </article>`;
    }).join("");
    refreshDrunk(wrap);
  }

  function renderMap() {
    const map = $("#map");
    const tileTokens = TILES.map(() => []);
    state.players.forEach((p) => {
      const idx = p.cheating ? TILES.length - 1 : Math.min(TILES.length - 1, Math.floor(totalScore(p) / MAP_STEP));
      tileTokens[idx].push(p);
    });
    const lead = officialRanking()[0];
    const leadId = lead ? lead.p.id : null;
    map.innerHTML = TILES.map((tile, i) => {
      const label = state.lang === "en" ? tile.en : tile.it;
      const tokens = tileTokens[i].sort((a, b) => totalScore(b) - totalScore(a))
        .map((p) => `<span class="token ${p.cheating ? "is-cheating" : ""} ${p.id === leadId ? "token--lead" : ""}" data-player="${p.id}" title="${esc(p.name)} · ${totalScore(p)}">${avatarSvg(p.avatar.key)}</span>`).join("");
      return `<div class="tile ${tile.cls}">
        <div class="tile__idx">${String(i).padStart(2, "0")}</div>
        <div class="tile__ico">${tileIcon(tile)}</div>
        <div class="tile__name trace" data-text="${esc(label)}">${esc(label)}</div>
        <div class="tile__tokens">${tokens}</div>
      </div>`;
    }).join("");
  }

  /* ---------- detail panel ---------- */
  function renderDetail() {
    const p = state.players.find((x) => x.id === ui.detailId);
    if (!p) { closeDetail(); return; }
    const sc = totalScore(p);
    const panel = $("#detailPanel .sidepanel");
    panel.classList.toggle("is-cheating", p.cheating);

    $("#detailAvatar").innerHTML = avatarSvg(p.avatar.key);
    $("#detailAvatar").classList.toggle("is-cheating", p.cheating);
    $("#detailName").textContent = p.name;
    $("#detailTag").textContent = "REC—" + p.id.slice(-4).toUpperCase();
    setDrunk($("#detailScore"), sc);
    $("#detailRank").textContent = p.cheating ? "DQ" : "#" + rankOf(p.id);

    $("#taps").innerHTML = CATEGORIES.map((k) => `
      <button class="tap" data-tap="${k}" type="button">
        <span class="tap__pts">+${POINTS[k]}</span>
        <span class="tap__details" data-detailtoggle="${k}" role="button" title="details">${uiIcon("chevron")}</span>
        <span class="tap__ico">${catIcon(k)}</span>
        <span class="tap__name">${t(k)}</span>
        <span class="tap__row"><span class="tap__plus">+1</span><span class="tap__count">×${p.counts[k]}</span></span>
      </button>
      <div class="detailsheet" data-sheet="${k}">
        <span class="dtag__cat">${t(k)}</span>
        ${DETAILS[k].map((d, di) => `<button class="dtag" data-detail="${k}" data-di="${di}" type="button">${state.lang === "en" ? d.en : d.it}</button>`).join("")}
      </div>`).join("");

    const feed = $("#detailFeed");
    const logs = [...p.logs].slice(-30).reverse();
    $("#feedCount").textContent = String(p.logs.length);
    feed.innerHTML = logs.length
      ? logs.map((l) => `<li class="feeditem">
          <span class="feeditem__ico">${catIcon(l.category)}</span>
          <span class="feeditem__txt">${esc(l.detail || t(l.category))}</span>
          <span class="feeditem__time">${timeAgo(l.ts)}</span>
        </li>`).join("")
      : `<li class="feed__empty">${esc(t("noActions"))}</li>`;

    const cb = $("#detailCheat");
    cb.textContent = p.cheating ? t("uncheat") : t("cheating");
    cb.classList.toggle("is-on", p.cheating);
  }

  /* ============================================================
     FX
     ============================================================ */
  function popFx(x, y, text) {
    const el = document.createElement("div");
    el.className = "fxpop";
    el.textContent = text;
    el.style.left = x + "px";
    el.style.top = y + "px";
    $("#fx").appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  /* ============================================================
     i18n + static icons + session ui
     ============================================================ */
  function fillStaticIcons() {
    $$("[data-ic]").forEach((el) => { el.innerHTML = uiIcon(el.getAttribute("data-ic")); });
  }
  function applyLang() {
    document.documentElement.lang = state.lang;
    $$("[data-i18n]").forEach((el) => {
      const v = t(el.getAttribute("data-i18n"));
      if (el.classList.contains("drunk")) { setDrunk(el, v); }
      else { el.textContent = v; if (el.classList.contains("trace")) el.setAttribute("data-text", v); }
    });
    $$("[data-i18n-ph]").forEach((el) => (el.placeholder = t(el.getAttribute("data-i18n-ph"))));
    $$(".langswitch__btn").forEach((b) => b.classList.toggle("is-active", b.dataset.lang === state.lang));
    $("#mapTitle").setAttribute("data-text", state.lang === "en" ? "THE LITTLE CRITTER FARM" : "LA FATTORIA DEGLI ANIMALETTI");
    renderScoring();
    refreshDrunk();
  }
  function renderScoring() {
    $("#scoringGrid").innerHTML = CATEGORIES.map((k) => `
      <div class="scell">
        <div class="scell__ico">${catIcon(k)}</div>
        <div class="scell__pt">${POINTS[k]}</div>
        <div class="scell__lbl">${t(k)}</div>
      </div>`).join("");
  }
  function setLang(lang) {
    if (!I18N[lang]) return;
    state.lang = lang; savePrefs(); applyLang(); render();
  }
  function syncSessionUI() {
    const code = "REC—" + state.session;
    $("#sessionCode").textContent = code;
    if ($("#sessionBig")) $("#sessionBig").textContent = code;
  }
  function syncCollapse() {
    $("#statsBlock").classList.toggle("is-collapsed", state.collapsedStats);
    $("#statsToggle").setAttribute("aria-expanded", String(!state.collapsedStats));
  }

  /* ============================================================
     HELPERS
     ============================================================ */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function timeAgo(ts) {
    const s = Math.floor((now() - ts) / 1000);
    if (s < 60) return "now";
    const m = Math.floor(s / 60); if (m < 60) return m + "m";
    const h = Math.floor(m / 60); if (h < 24) return h + "h";
    return Math.floor(h / 24) + "d";
  }

  /* ============================================================
     MODALS / PANEL
     ============================================================ */
  function openAdd() {
    pendingAvatar = randomAvatar();
    $("#avatarPreview").innerHTML = avatarSvg(pendingAvatar.key);
    $("#nameInput").value = "";
    $("#addModal").hidden = false;
    setTimeout(() => $("#nameInput").focus(), 30);
  }
  function closeAdd() { $("#addModal").hidden = true; }
  function openDetail(id) { ui.detailId = id; $("#detailPanel").hidden = false; renderDetail(); }
  function closeDetail() { ui.detailId = null; $("#detailPanel").hidden = true; }
  function openSettings() { $("#settingsModal").hidden = false; }
  function closeSettings() { $("#settingsModal").hidden = true; }
  function openSession() { syncSessionUI(); $("#sessionInput").value = ""; $("#sessionModal").hidden = false; }
  function closeSession() { $("#sessionModal").hidden = true; }

  /* ============================================================
     EVENTS
     ============================================================ */
  function bind() {
    $("#fab").addEventListener("click", openAdd);
    $("#addConfirm").addEventListener("click", confirmAdd);
    $("#avatarPreview").addEventListener("click", () => {
      pendingAvatar = randomAvatar();
      $("#avatarPreview").innerHTML = avatarSvg(pendingAvatar.key);
    });
    $("#nameInput").addEventListener("keydown", (e) => { if (e.key === "Enter") confirmAdd(); });

    $("#settingsBtn").addEventListener("click", openSettings);
    $("#resetDemo").addEventListener("click", () => { if (confirm(t("confirmReset"))) { seedDemo(true); closeSettings(); render(); } });
    $("#wipeAll").addEventListener("click", () => {
      if (confirm(t("confirmWipe"))) { state.clearedAt = now(); state.tombstones = {}; state.players = []; saveRoom(); closeSettings(); render(); }
    });

    // session
    $("#sessionBtn").addEventListener("click", openSession);
    $("#joinSession").addEventListener("click", () => joinSession($("#sessionInput").value));
    $("#sessionInput").addEventListener("keydown", (e) => { if (e.key === "Enter") joinSession($("#sessionInput").value); });
    $("#copySession").addEventListener("click", () => {
      const code = "REC—" + state.session;
      const done = () => { const s = $("#copySession .copytxt"); if (s) { s.textContent = t("copied"); setTimeout(() => (s.textContent = t("copy")), 1400); } };
      if (navigator.clipboard) navigator.clipboard.writeText(code).then(done).catch(done); else done();
    });

    // collapsible stats
    $("#statsToggle").addEventListener("click", () => {
      state.collapsedStats = !state.collapsedStats; savePrefs(); syncCollapse();
    });

    // generic close
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) { closeAdd(); closeSettings(); closeSession(); }
      if (e.target.closest("[data-close-panel]")) closeDetail();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { closeAdd(); closeSettings(); closeSession(); closeDetail(); }
    });

    // language
    $$(".langswitch").forEach((sw) => sw.addEventListener("click", (e) => {
      const b = e.target.closest(".langswitch__btn"); if (b) setLang(b.dataset.lang);
    }));

    // filters
    $("#catFilter").addEventListener("click", (e) => {
      const b = e.target.closest(".fbtn"); if (!b) return;
      ui.cat = b.dataset.cat;
      $$("#catFilter .fbtn").forEach((x) => x.classList.toggle("is-active", x === b));
      renderLeaderboard();
    });
    $("#timeFilter").addEventListener("click", (e) => {
      const b = e.target.closest(".fbtn"); if (!b) return;
      ui.time = b.dataset.time;
      $$("#timeFilter .fbtn").forEach((x) => x.classList.toggle("is-active", x === b));
      renderLeaderboard();
    });

    // open detail from list / cards / map / podium
    $("#leaderboard").addEventListener("click", (e) => { const r = e.target.closest("[data-player]"); if (r) openDetail(r.dataset.player); });
    $("#podium").addEventListener("click", (e) => { const r = e.target.closest("[data-player]"); if (r) openDetail(r.dataset.player); });
    $("#players").addEventListener("click", (e) => {
      const cheat = e.target.closest("[data-cheat]");
      if (cheat) { e.stopPropagation(); toggleCheating(cheat.dataset.cheat); render(); return; }
      const card = e.target.closest("[data-player]"); if (card) openDetail(card.dataset.player);
    });
    $("#map").addEventListener("click", (e) => { const tok = e.target.closest("[data-player]"); if (tok) openDetail(tok.dataset.player); });

    // taps
    $("#taps").addEventListener("click", (e) => {
      const toggle = e.target.closest("[data-detailtoggle]");
      if (toggle) {
        e.stopPropagation();
        const k = toggle.dataset.detailtoggle;
        const sheet = $(`.detailsheet[data-sheet="${k}"]`);
        $$(".detailsheet").forEach((s) => { if (s !== sheet) s.classList.remove("is-open"); });
        sheet.classList.toggle("is-open");
        return;
      }
      const dtag = e.target.closest("[data-detail]");
      if (dtag) {
        const k = dtag.dataset.detail, di = +dtag.dataset.di, d = DETAILS[k][di];
        let label = state.lang === "en" ? d.en : d.it;
        if (d.it === "Custom") { const c = prompt(t("customPh")); if (c == null) return; label = c.trim() || label; }
        doTap(k, label, dtag);
        $(`.detailsheet[data-sheet="${k}"]`).classList.remove("is-open");
        return;
      }
      const tap = e.target.closest("[data-tap]");
      if (tap) doTap(tap.dataset.tap, null, tap);
    });

    $("#detailCheat").addEventListener("click", () => { if (ui.detailId) { toggleCheating(ui.detailId); render(); } });
    $("#detailDelete").addEventListener("click", () => {
      if (!ui.detailId) return;
      const p = state.players.find((x) => x.id === ui.detailId);
      if (p && confirm(`${t("delete")} ${p.name}?`)) { deletePlayer(ui.detailId); closeDetail(); render(); }
    });
  }

  function confirmAdd() {
    const p = createPlayer($("#nameInput").value);
    if (!p) { $("#nameInput").focus(); return; }
    closeAdd(); render(); openDetail(p.id);
  }
  function doTap(category, detail, srcEl) {
    if (!ui.detailId) return;
    addAction(ui.detailId, category, detail);
    if (srcEl) {
      const r = srcEl.getBoundingClientRect();
      popFx(r.left + r.width / 2 - 14, r.top + 6, "+" + POINTS[category]);
      srcEl.classList.remove("punch"); void srcEl.offsetWidth; srcEl.classList.add("punch");
    }
    renderDetail(); renderPodium(); renderStats(); renderLeaderboard();
    renderPlayers(); renderMap(); renderLbCount();
  }

  /* ============================================================
     INIT
     ============================================================ */
  function init() {
    loadPrefs();
    const had = loadRoom();
    if (!had && state.session === DEFAULT_SESSION) seedDemo(false);
    fillStaticIcons();
    bind();
    syncSessionUI();
    syncCollapse();
    updateConn(false);
    applyLang();
    render();
    cloudConnect();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
