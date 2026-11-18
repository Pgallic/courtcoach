/* ---------- app shell ---------- */
const TABS = [['team', 'Team'], ['plan', 'Game plan'], ['live', 'Game day'], ['plays', 'Plays'], ['review', 'Review'], ['grow', 'Grow']];

function SyncChip() {
  useStore();
  const m = {
    example: ['Example team', 'warn', 'You are looking at an example. Start your team to save.'],
    local: ['Saved on this device', 'muted', 'Sign in to Claude to save to your account.'],
    loading: ['Loading…', 'muted', ''], saving: ['Saving…', 'muted', ''], saved: ['Saved', 'good', 'Saved to your Claude account.'],
    offline: ['Offline · saved here', 'warn', 'Changes are kept on this device and sync when you reconnect.']
  }[Sync.status] || ['', '', ''];
  return html`<span class=${'sync ' + m[1]} title=${m[2]}><i></i>${m[0]}</span>`;
}

function ExampleBanner({ onStart }) {
  return html`<div class="example-banner">
    <div><b>This is an example team</b> so you can try everything: planning, live stats, reviews and Claude. Nothing here is saved.</div>
    <div class="row gap wrap"><button class="btn primary" onClick=${onStart}>Start my team</button></div>
  </div>`;
}

function StartDialog({ open, onClose, openImport }) {
  const [name, setName] = useState('');
  if (!open) return null;
  function start() {
    Store.change((s) => {
      s.example = false;
      s.team = { name: name.trim() || 'My team', season: '', settings: { onCourt: 5, quarters: 4, spq: 2 }, roster: [], updatedAt: Date.now() };
      s.games = {};
    }, ['team']);
    onClose();
    location.hash = 'team';
    toast('Your team is ready. Add players, then rate their skills.');
  }
  return html`<${Dialog} open=${open} onClose=${onClose} title="Start your team"
      footer=${html`<button class="btn" onClick=${onClose}>Keep exploring</button><button class="btn primary" onClick=${start}>Start with an empty roster</button>`}>
    <label class="field"><span>Team name</span><input id="start-name" value=${name} onInput=${(e) => setName(e.target.value)} placeholder="e.g. Wildcats" /></label>
    <p class="small muted">The example team goes away. Your team saves to your Claude account so it's on your phone and tablet. Coming from the old CourtCoach? Start, then use <b>Import from old CourtCoach</b> on the Team tab.</p>
  </${Dialog}>`;
}

function Toast() {
  useStore();
  const t = Store.ui.toast;
  if (!t) return null;
  return html`<div class="toast" role="status">${t.msg}${t.action ? html`<button class="link-btn" onClick=${() => { t.action.fn(); Store.ui.toast = null; Store.notify(); }}>${t.action.label}</button>` : null}</div>`;
}

function readHash() { const h = (location.hash || '').replace('#', ''); return TABS.some(([k]) => k === h) ? h : 'team'; }

function App() {
  const s = useStore();
  const [tab, setTab] = useState(readHash());
  const [player, setPlayer] = useState(null);
  const [card, setCard] = useState(null);
  const [huddle, setHuddle] = useState(null);
  const [startOpen, setStartOpen] = useState(false);
  const [selPlay, setSelPlay] = useState('box');
  const [playHuddle, setPlayHuddle] = useState(null);
  const openPlay = (id) => { setSelPlay(id); location.hash = 'plays'; };
  const openPlayHuddle = (id, log) => setPlayHuddle({ id, log });
  const pickDefault = () => { const gs = sortedGames(); const live = gs.find((g) => g.status === 'live'); const next = gs.filter((g) => g.status === 'plan').sort((a, b) => (a.date || '').localeCompare(b.date || ''))[0]; return (live || next || gs[0] || {}).id || ''; };
  const [gameId, setGameId] = useState(pickDefault);
  useEffect(() => { const f = () => setTab(readHash()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  useEffect(() => { if (!s.games[gameId]) setGameId(pickDefault()); });
  useEffect(() => { if (window.claude && window.claude.hot) window.claude.hot.snapshot(() => ({ tab, gameId })); }, [tab, gameId]);
  const openHuddle = (gid, sh) => setHuddle({ gid, sh });
  return html`<div class="app">
    <header class="topbar">
      <div class="brand"><span class="logo" aria-hidden="true"><${Icon} name="ball" size=${22} /></span><span class="wordmark">CourtCoach</span><span class="edition">youth edition</span></div>
      <nav class="tabs" role="tablist" aria-label="Sections">${TABS.map(([k, l]) => html`<a role="tab" aria-selected=${tab === k} class=${'tab' + (tab === k ? ' on' : '')} href=${'#' + k}>${l}</a>`)}</nav>
      <${SyncChip} />
    </header>
    ${s.example ? html`<${ExampleBanner} onStart=${() => setStartOpen(true)} />` : null}
    <main>
      ${tab === 'team' ? html`<${TeamTab} openPlayer=${setPlayer} openCard=${setCard} />` : null}
      ${tab === 'plan' ? html`<${PlanTab} gameId=${gameId} setGameId=${setGameId} openHuddle=${openHuddle} openPlay=${openPlay} />` : null}
      ${tab === 'live' ? html`<${LiveTab} gameId=${gameId} setGameId=${setGameId} openHuddle=${openHuddle} openPlayHuddle=${openPlayHuddle} />` : null}
      ${tab === 'plays' ? html`<${PlaysTab} selPlay=${selPlay} setSelPlay=${setSelPlay} openPlayHuddle=${(id) => openPlayHuddle(id, null)} />` : null}
      ${tab === 'review' ? html`<${ReviewTab} gameId=${gameId} setGameId=${setGameId} />` : null}
      ${tab === 'grow' ? html`<${GrowTab} openPlayer=${setPlayer} />` : null}
    </main>
    ${player ? html`<${PlayerSheet} id=${player} onClose=${() => setPlayer(null)} openCard=${(id) => { setPlayer(null); setCard(id); }} />` : null}
    ${card ? html`<${PlayerCard} id=${card} onClose=${() => setCard(null)} />` : null}
    ${huddle ? html`<${Huddle} gameId=${huddle.gid} startShift=${huddle.sh} onClose=${() => setHuddle(null)} />` : null}
    ${playHuddle ? html`<${PlayHuddle} playId=${playHuddle.id} log=${playHuddle.log} onClose=${() => setPlayHuddle(null)} />` : null}
    <${StartDialog} open=${startOpen} onClose=${() => setStartOpen(false)} />
    <${Toast} />
  </div>`;
}

function boot(hot) {
  Store.init();
  document.getElementById('root').textContent = '';
  render(html`<${App} />`, document.getElementById('root'));
  if (hot && hot.tab && !location.hash) location.hash = hot.tab;
  Sync.start();
}
if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(boot);
else boot((window.claude && window.claude.hot && window.claude.hot.data) || {});
