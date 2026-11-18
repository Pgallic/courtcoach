/* ---------- Playbook: animated plays, builder, Claude, play cards ---------- */
const REDUCED_MOTION = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const toSvg = (p) => [p[0] * 5, p[1] * 4.7];

// Where the players for a play come from.
function castOptions() {
  const s = Store.s, out = [];
  const byId = rosterById();
  const live = sortedGames().find((g) => g.status === 'live');
  if (live) { const ids = CC.lineupOf(live, live.cur || 0).filter((id) => byId[id]); if (ids.length) out.push({ key: 'live', label: 'On the court now (' + CC.shiftLabel(live, live.cur || 0, true) + ')', ids }); }
  const next = sortedGames().filter((g) => g.status === 'plan').sort((a, b) => (a.date || '').localeCompare(b.date || ''))[0];
  if (next) for (let i = 0; i < CC.nShifts(next); i++) { const ids = CC.lineupOf(next, i).filter((id) => byId[id]); if (ids.length) out.push({ key: 'g:' + next.id + ':' + i, label: 'vs ' + next.opponent + ' · ' + CC.shiftLabel(next, i, true), ids }); }
  out.push({ key: 'roster', label: 'Best fits from the whole roster', ids: s.team.roster.map((p) => p.id) });
  out.push({ key: 'none', label: 'No names (show roles)', ids: [] });
  return out;
}
function castFor(play, ids) { const byId = rosterById(); return CCP.castPlay(play, ids.map((id) => byId[id]).filter(Boolean)); }

function arrowEls(list, faint) {
  const out = [];
  list.forEach((a, i) => {
    let [x1, y1] = toSvg(a.from), [x2, y2] = toSvg(a.to);
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    if (len < 30) return;
    const ux = dx / len, uy = dy / len, s0 = 24, s1 = a.kind === 'screen' ? 20 : 30;
    x1 += ux * s0; y1 += uy * s0; x2 -= ux * s1; y2 -= uy * s1;
    const cls = 'pa ' + a.kind + (faint ? ' faint' : '');
    const head = (hx, hy) => { const sz = 16, px = -uy, py = ux; return `${hx + ux * 4},${hy + uy * 4} ${hx - ux * sz + px * sz * 0.6},${hy - uy * sz + py * sz * 0.6} ${hx - ux * sz - px * sz * 0.6},${hy - uy * sz - py * sz * 0.6}`; };
    if (a.kind === 'screen') {
      const px = -uy * 16, py = ux * 16;
      out.push(html`<g key=${i} class=${cls}><path d=${`M${x1} ${y1} L${x2} ${y2}`} /><path d=${`M${x2 + px} ${y2 + py} L${x2 - px} ${y2 - py}`} class="bar" /></g>`);
    } else if (a.kind === 'dribble') {
      const L = Math.hypot(x2 - x1, y2 - y1), n = Math.max(2, Math.floor((L - 22) / 14)); let d = `M${x1} ${y1}`;
      for (let k = 1; k <= n; k++) { const t = (k * 14) / L, side = k % 2 ? 7 : -7; d += ` L${x1 + (x2 - x1) * t - uy * side} ${y1 + (y2 - y1) * t + ux * side}`; }
      d += ` L${x2 - ux * 6} ${y2 - uy * 6}`;
      out.push(html`<g key=${i} class=${cls}><path d=${d} /><polygon points=${head(x2, y2)} /></g>`);
    } else {
      out.push(html`<g key=${i} class=${cls}><path d=${`M${x1} ${y1} L${x2 - ux * 10} ${y2 - uy * 10}`} /><polygon points=${head(x2, y2)} /></g>`);
    }
  });
  return out;
}

// A court that draws a play at a moment in time (step, progress t).
function PlayCourt({ play, cast, step, t = 1, big, editable, onMove, onTap, selected, extraArrows }) {
  const ref = useRef(null);
  const [drag, setDrag] = useState(null);
  const byId = rosterById();
  const prev = CCP.posAt(play, step - 1), cur = CCP.posAt(play, step);
  const tm = step < 0 ? 1 : ease(Math.min(1, t / 0.62)), tb = step < 0 ? 1 : ease(Math.max(0, (t - 0.62) / 0.38));
  const pos = {}; (play.roles || []).forEach((r) => { if (cur[r.key]) pos[r.key] = lerp(prev[r.key] || cur[r.key], cur[r.key], tm); });
  if (drag) pos[drag.key] = [drag.x, drag.y];
  const b0 = CCP.ballAt(play, step - 1), b1 = CCP.ballAt(play, step);
  let ball = null, ballFade = 1;
  if (step < 0) ball = b1 && pos[b1];
  else if (b0 === b1) ball = b1 && pos[b1];
  else if (b0 && b1 && pos[b0] && pos[b1]) ball = tb <= 0 ? pos[b0] : lerp(cur[b0], cur[b1], tb);
  else if (!b0 && b1) { ball = pos[b1]; ballFade = tb; }
  else if (b0 && !b1) { ball = pos[b0]; ballFade = 1 - tb; }
  const arr = extraArrows || (step >= 0 ? CCP.arrows(play, step) : []);
  function pct(e) { const r = ref.current.getBoundingClientRect(); return [CC.clamp(((e.clientX - r.left) / r.width) * 100, -4, 104), CC.clamp(((e.clientY - r.top) / r.height) * 100, 2, 106)]; }
  function down(e, key) {
    if (!editable) { onTap && onTap(key); return; }
    e.preventDefault(); e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ key, x: pos[key][0], y: pos[key][1], sx: e.clientX, sy: e.clientY, moved: false });
  }
  function move(e) { if (!drag) return; const [x, y] = pct(e); setDrag({ ...drag, x, y, moved: drag.moved || Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6 }); }
  function up() { if (!drag) return; if (drag.moved) onMove && onMove(drag.key, Math.round(drag.x * 10) / 10, Math.round(drag.y * 10) / 10); else onTap && onTap(drag.key); setDrag(null); }
  return html`<div class=${'play-wrap' + (big ? ' big' : '')}>
    <div class=${'court play' + (big ? ' big' : '') + (editable ? ' editable' : '')} ref=${ref} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${() => setDrag(null)}>
      <${CourtLines} />
      <svg class="play-arrows" viewBox="0 0 500 470" aria-hidden="true">${arrowEls(arr, step >= 0 && t < 0.62 && !extraArrows)}</svg>
      ${(play.roles || []).map((r) => {
        const p = pos[r.key]; if (!p) return null;
        const pid = cast && cast[r.key]; const pl = pid && byId[pid];
        return html`<button key=${r.key} class=${'token' + (selected === r.key ? ' sel' : '') + (drag && drag.key === r.key ? ' dragging' : '')} style=${`left:${p[0]}%;top:${p[1]}%`} onPointerDown=${(e) => down(e, r.key)} aria-label=${(pl ? pl.name + ', ' : '') + r.label}>
          <span class=${'token-face' + (pl ? '' : ' generic')}>${pl ? html`<img src=${AVATARS[pl.avatarId] || AVATARS['girl-1']} alt="" draggable="false" /><span class="token-num">${pl.number}</span>` : html`<span class="gen-lbl">${r.label.slice(0, 1)}</span>`}</span>
          <span class="token-name">${pl ? pl.name : r.label}</span>
        </button>`;
      })}
      ${ball ? html`<span class="ball" style=${`left:${ball[0]}%;top:${ball[1]}%;opacity:${ballFade}`}></span>` : null}
    </div>
  </div>`;
}

// Animated viewer with controls.
function PlayViewer({ play, cast, big, autoplay }) {
  const n = play.steps.length;
  const [st, setSt] = useState({ step: -1, t: 1, playing: false, one: false });
  const [loop, setLoop] = useState(!!autoplay);
  const [slow, setSlow] = useState(!!big);
  const ref = useRef(st); ref.current = st;
  const hold = useRef(0);
  useEffect(() => { setSt({ step: -1, t: 1, playing: !!autoplay, one: false }); hold.current = autoplay ? 900 : 0; }, [play.id, play]);
  useEffect(() => {
    if (!st.playing && !st.one) return;
    let raf, last = performance.now();
    const dur = REDUCED_MOTION ? 1 : slow ? 2300 : 1400, pause = slow ? 1300 : 800;
    const frame = (now) => {
      const dt = now - last; last = now;
      let { step, t, playing, one } = ref.current;
      if (hold.current > 0) {
        hold.current -= dt;
        if (hold.current <= 0) {
          if (one) { setSt({ step, t: 1, playing: false, one: false }); return; }
          if (step < n - 1) { step++; t = 0; }
          else if (loop) { step = -1; t = 1; hold.current = 1400; setSt({ step, t, playing, one }); raf = requestAnimationFrame(frame); return; }
          else { setSt({ step, t: 1, playing: false, one: false }); return; }
        }
      } else if (step >= 0) {
        t = Math.min(1, t + dt / dur);
        if (t >= 1) hold.current = one ? 1 : pause;
      } else { step = 0; t = 0; }
      setSt({ step, t, playing, one });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [st.playing, st.one, loop, slow, n]);
  function playPause() {
    if (st.playing) { setSt({ ...st, playing: false }); return; }
    if (st.step >= n - 1 && st.t >= 1) { hold.current = 700; setSt({ step: -1, t: 1, playing: true, one: false }); }
    else { hold.current = st.step < 0 ? 300 : 0; setSt({ ...st, playing: true, one: false }); }
  }
  const go = (k) => { hold.current = 0; setSt({ step: k, t: k >= 0 ? 0 : 1, playing: false, one: k >= 0 }); };
  const step = Math.min(st.step, n - 1);
  const say = step < 0 ? 'Starting spots' : play.steps[step].say;
  return html`<div class=${'viewer' + (big ? ' big' : '')}>
    <${PlayCourt} play=${play} cast=${cast} step=${step} t=${step === st.step ? st.t : 1} big=${big} />
    <div class="caption" aria-live="polite"><span class="cap-num">${step < 0 ? 'Start' : step + 1 + ' of ' + n}</span><span class="cap-say">${say}</span></div>
    <div class="vctl">
      <button class="icon-btn" onClick=${() => go(-1)} aria-label="Back to start"><${Icon} name="undo" /></button>
      <button class="icon-btn" onClick=${() => go(Math.max(-1, st.step - 1))} disabled=${st.step < 0} aria-label="Previous step"><${Icon} name="back" /></button>
      <button class="btn primary play-btn" onClick=${playPause}>${st.playing ? 'Pause' : st.step >= n - 1 && st.t >= 1 ? 'Play again' : 'Play'}</button>
      <button class="icon-btn" onClick=${() => go(Math.min(n - 1, st.step + 1))} disabled=${st.step >= n - 1} aria-label="Next step"><${Icon} name="next" /></button>
      <label class="toggle"><input type="checkbox" checked=${loop} onChange=${(e) => setLoop(e.target.checked)} /> Loop</label>
      <label class="toggle"><input type="checkbox" checked=${slow} onChange=${(e) => setSlow(e.target.checked)} /> Slow</label>
    </div>
  </div>`;
}

function RoleList({ play, cast, onSwap }) {
  const byId = rosterById();
  return html`<ul class="role-list">${play.roles.map((r) => { const pid = cast[r.key]; const p = pid && byId[pid]; return html`<li key=${r.key}>
    ${p ? html`<${Avatar} p=${p} size=${30} />` : html`<span class="gen-dot">${r.label.slice(0, 1)}</span>`}
    <span class="grow"><b>${r.label}</b><span class="small muted"> ${CCP.TYPES[r.type].name}${p ? ' · ' + p.name : ''}</span></span>
    ${onSwap ? html`<button class="link-btn small" onClick=${() => onSwap(r.key)}>Change</button>` : null}</li>`; })}</ul>`;
}

/* Full-screen play for the huddle. log = {gameId} to record how it went. */
function PlayHuddle({ playId, log, onClose }) {
  const s = useStore();
  const play = CCP.findPlay(s.team, playId);
  const ref = useRef(null);
  const [done, setDone] = useState(false);
  if (!play) return null;
  const g = log && s.games[log.gameId];
  const opts = castOptions();
  const ids = g ? CC.lineupOf(g, g.cur || 0) : (opts.find((o) => o.key !== 'none') || { ids: [] }).ids;
  const cast = castFor(play, ids);
  function record(res) {
    Store.change((st) => { const gg = st.games[g.id]; gg.playLog = (gg.playLog || []).concat({ id: CC.uid(), s: gg.cur || 0, play: play.id, res, at: Date.now() }); }, [g.id]);
    toast(play.name + ': ' + { score: 'scored', shot: 'got a shot', to: 'turnover', none: "didn't run" }[res]);
    onClose();
  }
  function full() { try { const el = ref.current; (el.requestFullscreen || el.webkitRequestFullscreen).call(el).catch(() => {}); } catch (e) { /* not allowed */ } }
  return html`<div class="huddle play-huddle" ref=${ref} role="dialog" aria-label=${play.name}>
    <div class="huddle-bar"><div class="huddle-title"><span class="display">${play.name}</span><span class="huddle-side off">${(CCP.CATS.find((c) => c[0] === play.cat) || ['', 'Play'])[1]}</span></div></div>
    <div class="huddle-court"><${PlayViewer} play=${play} cast=${cast} big=${true} autoplay=${true} /></div>
    <div class="huddle-foot">
      ${g && !done ? html`<span class="muted">How did it go?</span>
        <button class="btn" onClick=${() => record('score')}>Scored</button><button class="btn" onClick=${() => record('shot')}>Got a shot</button>
        <button class="btn" onClick=${() => record('to')}>Turnover</button><button class="btn ghost" onClick=${() => record('none')}>Didn't run it</button>` : null}
      <button class="btn" onClick=${full}><${Icon} name="full" /> Full screen</button>
      <button class="btn primary" onClick=${onClose}>${g ? 'Close' : 'Done'}</button>
    </div>
  </div>`;
}

function PlaysTab({ selPlay, setSelPlay, openPlayHuddle }) {
  const s = useStore();
  const opts = castOptions();
  const [srcKey, setSrcKey] = useState(opts[0].key);
  const [over, setOver] = useState({});
  const [swapFor, setSwapFor] = useState(null);
  const [edit, setEdit] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [ask, confirmEl] = useConfirm();
  const plays = CCP.allPlays(s.team);
  const play = plays.find((p) => p.id === selPlay) || plays[0];
  useEffect(() => { setOver({}); }, [selPlay, srcKey]);
  const src = opts.find((o) => o.key === srcKey) || opts[0];
  const cast = { ...castFor(play, src.ids), ...over };
  const games = Object.values(s.games);
  const starSet = new Set(CCP.stars(s.team));
  const byId = rosterById();
  function toggleStar(id) { Store.change((st) => { const cur = new Set(CCP.stars(st.team)); cur.has(id) ? cur.delete(id) : cur.add(id); st.team.stars = Array.from(cur); }, ['team']); }
  function saveDraft(d) {
    Store.change((st) => { const list = (st.team.plays || []).filter((p) => p.id !== d.id); list.push(d); st.team.plays = list; const cur = new Set(CCP.stars(st.team)); cur.add(d.id); st.team.stars = Array.from(cur); }, ['team']);
    setSelPlay(d.id); setEdit(null); toast(d.name + ' saved to your playbook.');
  }
  const stats = CCP.playStats(games, play.id);
  return html`<section class="tab-page">
    <div class="page-head"><div><h1 class="display">Playbook</h1><p class="muted">Plays fill in with your players automatically. Tap Show the team in a timeout.</p></div>
      <div class="row gap wrap">
        <button class="btn" onClick=${() => setEdit(CCP.normalizePlay({ name: 'New play', cat: 'custom', roles: [{ key: 'p1', type: 'pg', label: 'Point' }, { key: 'p2', type: 'sh', label: 'Wing' }, { key: 'p3', type: 'sh', label: 'Wing' }, { key: 'p4', type: 'scr', label: 'Post' }, { key: 'p5', type: 'cut', label: 'Corner' }], start: { p1: [50, 36], p2: [17, 52], p3: [83, 52], p4: [38, 85], p5: [91, 88] }, ball: 'p1', steps: [] }))}><${Icon} name="plus" /> New play</button>
        <button class="btn ai" onClick=${() => setAiOpen(true)}><${Icon} name="spark" /> Ask Claude to draw one</button>
        <button class="btn" onClick=${() => setPrintOpen(true)}><${Icon} name="download" /> Play cards</button>
      </div></div>
    <div class="playbook">
      <nav class="play-list" aria-label="Plays">
        ${CCP.CATS.map(([k, label]) => { const items = plays.filter((p) => (p.cat || 'custom') === k); if (!items.length) return null; return html`<div class="pl-group" key=${k}><span class="eyebrow">${label}</span>
          ${items.map((p) => { const ps = CCP.playStats(games, p.id); return html`<button key=${p.id} class=${'pl-item' + (p.id === play.id ? ' on' : '')} onClick=${() => setSelPlay(p.id)}>
            <span class=${'star' + (starSet.has(p.id) ? ' on' : '')} aria-hidden="true">★</span><span class="grow">${p.name}</span>${ps.runs ? html`<span class="small muted">${ps.score}/${ps.runs}</span>` : null}</button>`; })}</div>`; })}
        <p class="small muted">★ = in your game-day playbook.</p>
      </nav>
      <div class="panel play-main">
        <div class="panel-head"><div><h2>${play.name}</h2><p class="small muted">${play.desc}</p></div>
          <button class=${'btn small' + (starSet.has(play.id) ? ' starred' : '')} onClick=${() => toggleStar(play.id)} aria-pressed=${starSet.has(play.id)}>★ ${starSet.has(play.id) ? 'In game-day playbook' : 'Add to game-day playbook'}</button></div>
        <label class="field compact cast-src"><span>Players</span><select id="cast-src" value=${src.key} onChange=${(e) => setSrcKey(e.target.value)}>${opts.map((o) => html`<option value=${o.key}>${o.label}</option>`)}</select></label>
        <div class="play-body">
          <${PlayViewer} key=${play.id} play=${play} cast=${cast} />
          <div class="play-side">
            <${RoleList} play=${play} cast=${cast} onSwap=${src.key === 'none' ? null : setSwapFor} />
            ${stats.runs ? html`<div class="play-stats"><span><b>${stats.runs}</b> runs</span><span class="pos"><b>${stats.score}</b> scored</span><span><b>${stats.shot}</b> shots</span><span class="neg"><b>${stats.to}</b> turnovers</span></div>` : html`<p class="small muted">Run it on Game day and log how it went to see if it works.</p>`}
            <div class="row gap wrap">
              <button class="btn primary" onClick=${() => openPlayHuddle(play.id)}><${Icon} name="full" /> Show the team</button>
              <button class="btn" onClick=${() => setEdit(play.custom ? clone(play) : { ...clone(play), id: 'my-' + CC.uid(), name: play.name + ' (my version)', custom: true, cat: play.cat })}><${Icon} name="edit" /> ${play.custom ? 'Edit' : 'Copy and edit'}</button>
              ${play.custom ? html`<button class="btn danger-ghost" onClick=${() => ask('Delete ' + play.name + '?', 'It comes out of your playbook. Logged results stay in past games.', 'Delete', () => { Store.change((st) => { st.team.plays = (st.team.plays || []).filter((p) => p.id !== play.id); }, ['team']); setSelPlay('box'); }, true)}><${Icon} name="trash" /></button>` : null}
            </div>
          </div>
        </div>
      </div>
    </div>
    <${Dialog} open=${!!swapFor} onClose=${() => setSwapFor(null)} title=${swapFor ? 'Who plays ' + (play.roles.find((r) => r.key === swapFor) || {}).label + '?' : ''}>
      <div class="sub-grid">${(src.key === 'roster' ? s.team.roster.map((p) => p.id) : src.ids).concat(s.team.roster.map((p) => p.id).filter((id) => !src.ids.includes(id))).filter((id, i, a) => a.indexOf(id) === i && byId[id]).map((id) => html`<button class=${'attend-btn' + (src.ids.includes(id) ? ' on' : '')} onClick=${() => {
        const next = { ...cast }; const had = Object.keys(next).find((k) => next[k] === id); if (had) next[had] = cast[swapFor]; next[swapFor] = id; setOver(next); setSwapFor(null);
      }}><${Avatar} p=${byId[id]} size=${32} /><span>${byId[id].name}</span></button>`)}</div>
    </${Dialog}>
    ${edit ? html`<${PlayBuilder} draft=${edit} onSave=${saveDraft} onClose=${() => setEdit(null)} />` : null}
    ${aiOpen ? html`<${AIPlayDialog} onClose=${() => setAiOpen(false)} onDraft=${(d) => { setAiOpen(false); setEdit(d); }} lineupIds=${src.ids} />` : null}
    ${printOpen ? html`<${PrintCardsDialog} onClose=${() => setPrintOpen(false)} srcIds=${src.ids} srcLabel=${src.label} />` : null}
    ${confirmEl}
  </section>`;
}

function PlayBuilder({ draft, onSave, onClose }) {
  const [d, setD] = useState(() => clone(draft));
  const [k, setK] = useState(-1);
  const [sel, setSel] = useState(null);
  const [preview, setPreview] = useState(false);
  const upd = (fn) => setD((old) => { const n = clone(old); fn(n); return n; });
  const n = d.steps.length;
  function onMove(key, x, y) { upd((p) => { if (k < 0) p.start[key] = [x, y]; else { p.steps[k].moves = p.steps[k].moves || {}; p.steps[k].moves[key] = [x, y]; } }); setSel(key); }
  function addStep() { upd((p) => { p.steps.push({ say: '', moves: {}, screens: [] }); }); setK(n); }
  function delStep() { if (k < 0) return; upd((p) => { p.steps.splice(k, 1); }); setK(k - 1); }
  function addRole() { upd((p) => { if (p.roles.length >= 5) return; let i = p.roles.length + 1; while (p.roles.some((r) => r.key === 'p' + i)) i++; const key = 'p' + i; p.roles.push({ key, type: 'cut', label: 'Player ' + i }); p.start[key] = [50, 50]; }); }
  function delRole(key) { upd((p) => { p.roles = p.roles.filter((r) => r.key !== key); delete p.start[key]; if (p.ball === key) p.ball = null; p.steps.forEach((s) => { delete s.moves[key]; s.screens = (s.screens || []).filter((x) => x !== key); if (s.ball === key) s.ball = null; }); }); }
  const step = k >= 0 ? d.steps[k] : null;
  const prevHolder = k >= 0 ? CCP.ballAt(d, k - 1) : null;
  const prevLabel = prevHolder ? ((d.roles.find((r) => r.key === prevHolder) || {}).label || 'nobody') : 'nobody';
  function save() { try { onSave(CCP.normalizePlay(d, d.id)); } catch (e) { toast(e.message || 'Check the play and try again.'); } }
  return html`<${Dialog} open=${true} onClose=${onClose} title=${draft.custom && draft.steps.length ? 'Edit play' : 'Draw a play'} wide=${true}
      footer=${html`<button class="btn" onClick=${onClose}>Cancel</button><button class="btn primary" onClick=${save} disabled=${!d.name.trim()}><${Icon} name="check" /> Save play</button>`}>
    ${draft.fromAI ? html`<p class="ai-note"><span class="ai-badge"><${Icon} name="spark" /> Claude</span> Here's Claude's version. Press Preview to watch it, drag anyone who's off, then save.</p>` : null}
    <div class="builder">
      <div class="b-court">
        <div class="steps-bar">
          <button class=${'step-chip' + (k < 0 ? ' on' : '')} onClick=${() => { setK(-1); setPreview(false); }}>Start</button>
          ${d.steps.map((_, i) => html`<button class=${'step-chip' + (k === i ? ' on' : '')} onClick=${() => { setK(i); setPreview(false); }}>${i + 1}</button>`)}
          <button class="step-chip add" onClick=${addStep} disabled=${n >= 8}><${Icon} name="plus" size=${14} /> Step</button>
          <button class=${'btn small' + (preview ? ' starred' : '')} onClick=${() => setPreview(!preview)} disabled=${!n}>${preview ? 'Back to editing' : 'Preview'}</button>
        </div>
        ${preview ? html`<${PlayViewer} play=${d} cast=${{}} autoplay=${true} />` : html`<${PlayCourt} play=${d} cast=${{}} step=${k} t=${1} editable=${true} onMove=${onMove} onTap=${setSel} selected=${sel} />`}
        ${!preview ? html`<p class="small muted">${k < 0 ? 'Drag everyone to their starting spots. Inbounders can stand off the court.' : 'Drag the players who move in this step. Arrows show the moves.'}</p>` : null}
      </div>
      <div class="b-side">
        <div class="form-grid"><label class="field"><span>Play name</span><input id="pb-name" value=${d.name} onInput=${(e) => { const v = e.target.value; upd((p) => { p.name = v; }); }} /></label>
          <label class="field"><span>Type</span><select id="pb-cat" value=${d.cat} onChange=${(e) => { const v = e.target.value; upd((p) => { p.cat = v; }); }}>${CCP.CATS.map(([c, l]) => html`<option value=${c}>${l}</option>`)}</select></label></div>
        <label class="field"><span>What it's for</span><input id="pb-desc" value=${d.desc} onInput=${(e) => { const v = e.target.value; upd((p) => { p.desc = v; }); }} placeholder="e.g. Under our basket. Gets our shooter a layup." /></label>
        ${step ? html`<div class="b-step">
          <label class="field"><span>Step ${k + 1}: what to tell the kids</span><input id="pb-say" value=${step.say} onInput=${(e) => { const v = e.target.value; upd((p) => { p.steps[k].say = v; }); }} placeholder="e.g. Point cuts to the corner" maxlength="140" /></label>
          <label class="field"><span>Who has the ball at the end of this step?</span><select id="pb-ball" value=${step.ball === undefined ? '__same' : step.ball || '__none'} onChange=${(e) => { const v = e.target.value; upd((p) => { if (v === '__same') delete p.steps[k].ball; else p.steps[k].ball = v === '__none' ? null : v; }); }}>
            <option value="__same">No pass (${prevLabel} keeps it)</option>
            ${d.roles.map((r) => html`<option value=${r.key}>Pass to ${r.label}</option>`)}<option value="__none">Nobody (shot or loose ball)</option></select></label>
          <div class="small"><b>Screens this step:</b> ${d.roles.filter((r) => step.moves[r.key]).length ? d.roles.filter((r) => step.moves[r.key]).map((r) => html`<label class="toggle"><input type="checkbox" checked=${(step.screens || []).includes(r.key)} onChange=${(e) => { const on = e.target.checked; upd((p) => { const s2 = new Set(p.steps[k].screens || []); on ? s2.add(r.key) : s2.delete(r.key); p.steps[k].screens = Array.from(s2); }); }} /> ${r.label}</label>`) : html`<span class="muted">Move someone first.</span>`}</div>
          <div class="row gap wrap">${sel && step.moves[sel] ? html`<button class="btn small" onClick=${() => upd((p) => { delete p.steps[k].moves[sel]; p.steps[k].screens = (p.steps[k].screens || []).filter((x) => x !== sel); })}>Undo ${(d.roles.find((r) => r.key === sel) || {}).label}'s move</button>` : null}<button class="btn small danger-ghost" onClick=${delStep}>Delete step ${k + 1}</button></div>
        </div>` : html`<label class="field"><span>Who starts with the ball?</span><select id="pb-start-ball" value=${d.ball || '__none'} onChange=${(e) => { const v = e.target.value; upd((p) => { p.ball = v === '__none' ? null : v; }); }}>${d.roles.map((r) => html`<option value=${r.key}>${r.label}</option>`)}<option value="__none">Nobody (other team's ball)</option></select></label>`}
        <div><span class="eyebrow">Players in this play</span>
          ${d.roles.map((r) => html`<div class=${'b-role' + (sel === r.key ? ' sel' : '')} key=${r.key}>
            <input aria-label="Role name" value=${r.label} onInput=${(e) => { const v = e.target.value; upd((p) => { p.roles.find((x) => x.key === r.key).label = v; }); }} />
            <select aria-label="Best fit" value=${r.type} onChange=${(e) => { const v = e.target.value; upd((p) => { p.roles.find((x) => x.key === r.key).type = v; }); }}>${Object.entries(CCP.TYPES).map(([t, x]) => html`<option value=${t}>${x.name}</option>`)}</select>
            <button class="icon-btn small" onClick=${() => delRole(r.key)} disabled=${d.roles.length <= 1} aria-label=${'Remove ' + r.label}><${Icon} name="x" size=${14} /></button></div>`)}
          ${d.roles.length < 5 ? html`<button class="link-btn small" onClick=${addRole}><${Icon} name="plus" size=${14} /> Add a player</button>` : null}
          <p class="small muted">"Best fit" decides which kid gets each spot when the play fills in automatically.</p>
        </div>
      </div>
    </div>
  </${Dialog}>`;
}

function aiPlayPrompt(desc, names) {
  const ex = CCP.STARTER[0];
  const exJson = JSON.stringify({ name: ex.name, cat: ex.cat, desc: ex.desc, roles: ex.roles, start: ex.start, ball: ex.ball, steps: ex.steps });
  return `Draw a youth basketball play (3rd-4th grade girls) as JSON for an app that animates it.

COURT (half court, numbers are percentages): x 0-100 from the left sideline to the right sideline. y 0-100 from the half-court line (y 0) to the baseline (y 100). Our basket is at (50, 89). Lane: x 38-62 from y 60 to y 100. Free-throw line y 60. Blocks (38,85) and (62,85). Elbows (38,60) and (62,60). Top of the arc (50,47). Wings about (18,54) and (82,54). Corners (8,91) and (92,91). Out of bounds: a baseline inbounder stands at y 104; a sideline inbounder at x -4 or 104. For a press break, the bottom basket is the one we defend and players move up toward y 0.

PLAYERS: 3 to 5 roles. Each role has a short key (lowercase letters/digits), a label kids understand, and a type that decides which kid gets the spot: inb (inbounder), pg (ball handler), sh (shooter), scr (screener), cut (cutter), reb (rebounder), safe (safety).

STEPS: 2 to 5 steps. Each step lists only the roles that move ("moves"), which of those moves are screens ("screens"), and "ball" = the role holding the ball at the END of the step (leave it out if it doesn't change; null for a shot). Keep each "say" under 14 words, in simple words for 8-10 year olds. Keep it simple: one main action plus a safety option.

EXAMPLE:
${exJson}

COACH'S REQUEST: "${desc}"
${names.length ? 'Players likely on the court: ' + names.join(', ') + '. Use role labels, not names.' : ''}

Reply with only JSON in the same shape as the example: {"name","cat":"blob|slob|press|set|ft","desc","roles":[...],"start":{...},"ball":"key or null","steps":[...]}`;
}

function AIPlayDialog({ onClose, onDraft, lineupIds }) {
  const aiOk = useAIAvailable();
  const [desc, setDesc] = useState('');
  const [st, setSt] = useState({ phase: 'idle' });
  const ctl = useRef(null);
  const byId = rosterById();
  const ideas = ['An inbound play under our basket that beats a 2-3 zone', 'A simple play to get our best shooter open', 'Jump ball: where everyone stands', 'Last-second play with 10 seconds left'];
  async function run() {
    const sample = await AI.get();
    if (!sample) { setSt({ phase: 'error', msg: AI.message({ code: 'not_granted' }) }); return; }
    ctl.current = new AbortController(); setSt({ phase: 'thinking' });
    try {
      const raw = await sample.json(aiPlayPrompt(desc.trim(), (lineupIds || []).map((id) => byId[id] && byId[id].name).filter(Boolean)), { signal: ctl.current.signal, cache: false });
      const p = CCP.normalizePlay(raw); if (!p.steps.length) throw { code: 'invalid_json' };
      onDraft({ ...p, fromAI: true });
    } catch (e) { setSt({ phase: 'error', msg: e && e.code ? AI.message(e) : "Claude's play didn't come through cleanly. Try describing it a little differently." }); }
  }
  return html`<${Dialog} open=${true} onClose=${onClose} title="Ask Claude to draw a play"
      footer=${st.phase === 'thinking' ? html`<button class="btn" onClick=${() => ctl.current && ctl.current.abort()}>Stop</button>` : html`<button class="btn" onClick=${onClose}>Cancel</button><button class="btn primary" onClick=${run} disabled=${!desc.trim() || aiOk === false}><${Icon} name="spark" /> Draw it</button>`}>
    ${aiOk === false ? html`<p class="muted">Claude isn't available on this page right now. You can still draw plays yourself with New play.</p>` : null}
    <label class="field"><span>Describe the play or the situation</span><textarea id="aip-desc" rows="3" value=${desc} onInput=${(e) => setDesc(e.target.value)} placeholder="e.g. Box inbound where Gemma screens for Nora and Harper is the safety"></textarea></label>
    <div class="chips">${ideas.map((t) => html`<button class="chip-btn" onClick=${() => setDesc(t)}>${t}</button>`)}</div>
    ${st.phase === 'thinking' ? html`<div class="thinking"><span class="dots"><i></i><i></i><i></i></span> Claude is drawing the play.</div>` : null}
    ${st.phase === 'error' ? html`<p class="error">${st.msg}</p>` : null}
    <p class="small muted">You'll see it in the editor to check and adjust before it's saved.</p>
  </${Dialog}>`;
}

/* ---------- play cards PDF ---------- */
function pdfCourt(doc, x, y, w) {
  const h = w * 0.94, sx = w / 500, sy = h / 470;
  doc.setDrawColor(17, 28, 51); doc.setLineWidth(1); doc.setFillColor(250, 246, 238); doc.rect(x, y, w, h, 'FD');
  doc.setFillColor(238, 230, 214); doc.rect(x + 190 * sx, y + 280 * sy, 120 * sx, 190 * sy, 'FD');
  doc.setLineWidth(0.7);
  doc.ellipse(x + 250 * sx, y + 280 * sy, 60 * sx, 60 * sy, 'S');
  const arc = (cx, cy, r, a0, a1, stepDeg) => { let px = null; for (let a = a0; a <= a1 + 0.01; a += stepDeg) { const rr = (a * Math.PI) / 180; const pt = [x + (cx + r * Math.cos(rr)) * sx, y + (cy + r * Math.sin(rr)) * sy]; if (px) doc.line(px[0], px[1], pt[0], pt[1]); px = pt; } };
  arc(250, 0, 60, 0, 180, 10);
  doc.line(x + 52.5 * sx, y + h, x + 52.5 * sx, y + 417.5 * sy); doc.line(x + 447.5 * sx, y + h, x + 447.5 * sx, y + 417.5 * sy);
  arc(250, 417.5, 197.5, 180, 360, 6);
  doc.circle(x + 250 * sx, y + 417.5 * sy, 7 * sx, 'S'); doc.line(x + 220 * sx, y + 430 * sy, x + 280 * sx, y + 430 * sy);
  return h;
}
function pdfArrow(doc, a, X, Y, num) {
  let [x1, y1] = [X(a.from[0]), Y(a.from[1])], [x2, y2] = [X(a.to[0]), Y(a.to[1])];
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy); if (len < 8) return;
  const ux = dx / len, uy = dy / len; x1 += ux * 9; y1 += uy * 9; x2 -= ux * 11; y2 -= uy * 11;
  const pass = a.kind === 'pass';
  doc.setLineWidth(1.1); if (pass) { doc.setDrawColor(232, 98, 26); doc.setFillColor(232, 98, 26); doc.setLineDashPattern([3, 2], 0); } else { doc.setDrawColor(17, 28, 51); doc.setFillColor(17, 28, 51); doc.setLineDashPattern([], 0); }
  if (a.kind === 'dribble') {
    const L = Math.hypot(x2 - x1, y2 - y1), n = Math.max(2, Math.floor((L - 6) / 5)); let px = x1, py = y1;
    for (let k = 1; k <= n; k++) { const t = (k * 5) / L, side = k % 2 ? 2.2 : -2.2; const nx = x1 + (x2 - x1) * t - uy * side, ny = y1 + (y2 - y1) * t + ux * side; doc.line(px, py, nx, ny); px = nx; py = ny; }
    doc.line(px, py, x2, y2);
  } else doc.line(x1, y1, x2, y2);
  doc.setLineDashPattern([], 0);
  if (a.kind === 'screen') { doc.setLineWidth(1.6); doc.line(x2 - uy * 5, y2 + ux * 5, x2 + uy * 5, y2 - ux * 5); }
  else { const s = 5; doc.triangle(x2 + ux * 2, y2 + uy * 2, x2 - ux * s - uy * s * 0.6, y2 - uy * s + ux * s * 0.6, x2 - ux * s + uy * s * 0.6, y2 - uy * s - ux * s * 0.6, 'F'); }
  if (num) { const mx = (x1 + x2) / 2, my = (y1 + y2) / 2; doc.setFillColor(255, 255, 255); doc.setDrawColor(17, 28, 51); doc.setLineWidth(0.6); doc.circle(mx, my, 4.2, 'FD'); doc.setTextColor(17, 28, 51); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.text(String(num), mx, my, { align: 'center', baseline: 'middle' }); }
}
function pdfPlayCard(doc, play, cast, byId, x, y, w) {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(17, 28, 51); doc.text(play.name, x, y + 10);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(110, 120, 140); doc.text((CCP.CATS.find((c) => c[0] === play.cat) || ['', 'Play'])[1], x + w, y + 10, { align: 'right' });
  const cy = y + 18, ch = pdfCourt(doc, x, cy, w);
  const X = (v) => x + (v / 100) * w, Y = (v) => cy + (v / 100) * ch;
  play.steps.forEach((_, k) => CCP.arrows(play, k).forEach((a, i) => pdfArrow(doc, a, X, Y, i === 0 ? k + 1 : null)));
  const R = w * 0.03;
  play.roles.forEach((r) => {
    const p = play.start[r.key]; if (!p) return; const pid = cast[r.key], pl = pid && byId[pid];
    const cx = X(p[0]), cyy = Y(p[1]);
    doc.setFillColor(17, 28, 51); doc.setDrawColor(255, 255, 255); doc.setLineWidth(1); doc.circle(cx, cyy, R, 'FD');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(R * 0.95); doc.text(pl ? String(pl.number) : r.label.slice(0, 1), cx, cyy, { align: 'center', baseline: 'middle' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(17, 28, 51); const nm = pl ? pl.name : r.label; const tw = doc.getTextWidth(nm) + 4;
    const lx = p[0] > 82 ? cx - R - 1 - tw : cx + R + 1;
    doc.setFillColor(255, 255, 255); doc.roundedRect(lx, cyy - 4, tw, 8, 1.5, 1.5, 'F'); doc.text(nm, lx + 2, cyy, { baseline: 'middle' });
  });
  if (play.ball && play.start[play.ball]) { const p = play.start[play.ball]; doc.setFillColor(232, 98, 26); doc.circle(X(p[0]) - R * 0.9, Y(p[1]) + R * 0.6, R * 0.42, 'F'); }
  let ty = cy + ch + 30; doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(17, 28, 51);
  play.steps.forEach((s, k) => { const lines = doc.splitTextToSize((k + 1) + '. ' + s.say, w); doc.text(lines, x, ty); ty += lines.length * 10.5; });
}
async function exportPlayCards(plays, ids) {
  const dl = window.claude ? await window.claude.use('downloads').catch(() => null) : null;
  if (!dl) throw new Error('Downloads are not available in this view. Open the page on claude.ai to print.');
  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({ unit: 'pt', format: 'letter' });
  const byId = rosterById(), M = 30, colW = (612 - 2 * M - 18) / 2, w = 232;
  plays.forEach((p, i) => {
    if (i && i % 4 === 0) doc.addPage();
    const slot = i % 4, col = slot % 2, row = Math.floor(slot / 2);
    const x = M + col * (colW + 18) + (colW - w) / 2, y = M + row * 372;
    pdfPlayCard(doc, p, ids.length ? castFor(p, ids) : {}, byId, x, y, w);
  });
  doc.setProperties({ title: Store.s.team.name + ' playbook' });
  try { await dl.save({ filename: Store.s.team.name.replace(/[^A-Za-z0-9]+/g, '-') + '-playbook.pdf', data: doc.output('blob') }); }
  catch (e) { if (e && e.code === 'declined') return; throw new Error("Couldn't save the PDF here."); }
}
function PrintCardsDialog({ onClose, srcIds, srcLabel }) {
  const s = useStore();
  const [which, setWhich] = useState('stars');
  const [names, setNames] = useState(srcIds.length > 0);
  const [busy, setBusy] = useState(false);
  const plays = which === 'stars' ? CCP.allPlays(s.team).filter((p) => CCP.stars(s.team).includes(p.id)) : CCP.allPlays(s.team);
  async function go() { setBusy(true); try { await exportPlayCards(plays, names ? srcIds : []); onClose(); } catch (e) { toast(e.message || "Couldn't make the PDF here."); } setBusy(false); }
  return html`<${Dialog} open=${true} onClose=${onClose} title="Print play cards"
      footer=${html`<button class="btn" onClick=${onClose}>Cancel</button><button class="btn primary" onClick=${go} disabled=${busy || !plays.length}><${Icon} name="download" /> ${busy ? 'Making PDF…' : 'Download PDF'}</button>`}>
    <div class="seg two"><button class=${'seg-btn' + (which === 'stars' ? ' on' : '')} onClick=${() => setWhich('stars')}>Game-day playbook</button><button class=${'seg-btn' + (which === 'all' ? ' on' : '')} onClick=${() => setWhich('all')}>Every play</button></div>
    <p class="small">${plays.length} plays, 4 per page, US Letter. Each card shows the starting spots, every move numbered by step, and what to say.</p>
    ${srcIds.length ? html`<label class="toggle"><input type="checkbox" checked=${names} onChange=${(e) => setNames(e.target.checked)} /> Put names on the cards from: ${srcLabel}</label>` : null}
  </${Dialog}>`;
}
