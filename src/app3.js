/* ---------- Game plan tab ---------- */
function newGame(opponent, date) {
  const st = Store.s.team.settings || {};
  const id = CC.uid();
  const g = { id, opponent: opponent || 'Opponent', date: date || todayISO(), status: 'plan', quarters: st.quarters || 4, spq: st.spq || 2, onCourt: st.onCourt || 5,
    offForm: '5out', defForm: '23', present: Store.s.team.roster.map((p) => p.id), shifts: [], tips: {}, events: [], cur: 0, notes: '', updatedAt: Date.now() };
  for (let i = 0; i < CC.nShifts(g); i++) g.shifts.push({ lineup: [], note: '' });
  Store.change((s) => { s.games[id] = g; }, [id]);
  return id;
}
function recentShiftHistory(excludeId) {
  const out = {};
  sortedGames().filter((g) => g.id !== excludeId && g.status === 'final').slice(0, 3).forEach((g) => {
    const c = CC.shiftCounts(g, g.present || [], true); Object.keys(c).forEach((id) => { out[id] = (out[id] || 0) + c[id]; });
  });
  return out;
}
function onCourtOf(g) { return g.onCourt || (Store.s.team.settings || {}).onCourt || 5; }

function GamePicker({ gameId, setGameId, filter, allowNew }) {
  const s = useStore();
  const [showNew, setShowNew] = useState(false);
  const [opp, setOpp] = useState('');
  const [date, setDate] = useState(todayISO());
  const games = sortedGames().filter(filter || (() => true));
  return html`<div class="gamepicker">
    <label class="field compact"><span class="sr">Game</span>
      <select id=${'gp-' + (allowNew ? 'plan' : 'other')} value=${gameId || ''} onChange=${(e) => setGameId(e.target.value)}>
        ${games.length ? null : html`<option value="">No games yet</option>`}
        ${games.map((g) => html`<option value=${g.id}>vs ${g.opponent} · ${fmtDate(g.date)}${g.status === 'final' ? ' · final' : g.status === 'live' ? ' · in progress' : ''}</option>`)}
      </select></label>
    ${allowNew ? html`<button class="btn primary" onClick=${() => setShowNew(true)}><${Icon} name="plus" /> New game</button>` : null}
    <${Dialog} open=${showNew} onClose=${() => setShowNew(false)} title="New game"
      footer=${html`<button class="btn" onClick=${() => setShowNew(false)}>Cancel</button><button class="btn primary" disabled=${!opp.trim()} onClick=${() => { const id = newGame(opp.trim(), date); setGameId(id); setShowNew(false); setOpp(''); }}>Create game</button>`}>
      <div class="form-grid"><label class="field"><span>Opponent</span><input id="ng-opp" value=${opp} onInput=${(e) => setOpp(e.target.value)} placeholder="e.g. Tigers" /></label>
      <label class="field"><span>Date</span><input id="ng-date" type="date" value=${date} onInput=${(e) => setDate(e.target.value)} /></label></div>
      <p class="small muted">Everyone starts as present. Tap kids off if they can't make it.</p>
    </${Dialog}>
  </div>`;
}

function Attendance({ g }) {
  const s = useStore();
  const pres = new Set(g.present || []);
  function toggle(id) {
    Store.change((st) => {
      const gg = st.games[g.id];
      const set = new Set(gg.present || []);
      if (set.has(id)) { set.delete(id); gg.shifts.forEach((sh) => { sh.lineup = sh.lineup.filter((x) => x !== id); }); } else set.add(id);
      gg.present = s.team.roster.map((p) => p.id).filter((x) => set.has(x));
    }, [g.id]);
  }
  return html`<div class="attend">
    <span class="eyebrow">Who's here · ${pres.size} of ${s.team.roster.length}</span>
    <div class="attend-row">${s.team.roster.map((p) => html`<button class=${'attend-btn' + (pres.has(p.id) ? ' on' : '')} aria-pressed=${pres.has(p.id)} onClick=${() => toggle(p.id)}><${Avatar} p=${p} size=${30} /><span>${p.name}</span></button>`)}</div>
  </div>`;
}

function RotationBoard({ g, onPick, picked }) {
  const s = useStore();
  const byId = rosterById();
  const present = (g.present || []).filter((id) => byId[id]);
  const k = Math.min(onCourtOf(g), present.length);
  const N = CC.nShifts(g);
  const f = CC.fairness(g, present, onCourtOf(g));
  function toggle(id, i) {
    Store.change((st) => {
      const sh = st.games[g.id].shifts[i];
      if (sh.lineup.includes(id)) sh.lineup = sh.lineup.filter((x) => x !== id);
      else sh.lineup = sh.lineup.concat(id);
    }, [g.id]);
  }
  const spq = g.spq || 2;
  return html`<div class="rotation">
    <div class="rot-scroll">
      <table class="rot-table">
        <thead>
          <tr><th class="rot-name"></th>${Array.from({ length: g.quarters || 4 }, (_, q) => html`<th colspan=${spq} class="rot-q">${(g.quarters || 4) === 2 ? 'Half ' : 'Q'}${q + 1}</th>`)}<th class="rot-tot">Shifts</th></tr>
          <tr><th></th>${Array.from({ length: N }, (_, i) => html`<th class=${'rot-shift' + (picked === i ? ' picked' : '')}><button class="link-btn" onClick=${() => onPick(i)} title="Show this shift on the court">${spq === 1 ? '' : CC.shiftLabel(g, i).slice(-1).toUpperCase()}</button></th>`)}<th></th></tr>
        </thead>
        <tbody>
          ${present.map((id) => {
            const p = byId[id]; const c = f.counts[id];
            const low = present.length > k && c < Math.floor(f.target), high = c > Math.ceil(f.target);
            return html`<tr key=${id}>
              <th class="rot-name"><${Avatar} p=${p} size=${26} /><span>${p.name}</span></th>
              ${Array.from({ length: N }, (_, i) => { const on = (g.shifts[i].lineup || []).includes(id); return html`<td class=${(i % spq === 0 ? 'qstart ' : '') + (picked === i ? 'picked' : '')}><button class=${'cell' + (on ? ' on' : '')} aria-pressed=${on} aria-label=${p.name + ' ' + CC.shiftLabel(g, i, true)} onClick=${() => toggle(id, i)}>${on ? '●' : ''}</button></td>`; })}
              <td class=${'rot-tot ' + (low ? 'low' : high ? 'high' : '')}>${c}</td>
            </tr>`;
          })}
        </tbody>
        <tfoot><tr><th class="rot-name small muted">On court</th>${Array.from({ length: N }, (_, i) => { const n = (g.shifts[i].lineup || []).length; return html`<td class=${'rot-count ' + (n === k ? 'ok' : n > k ? 'over' : 'under')}>${n}/${k}</td>`; })}<td></td></tr></tfoot>
      </table>
    </div>
    <div class=${'fair-meter ' + (f.fair && f.complete ? 'good' : 'warn')}>
      ${!present.length ? 'Mark who is here first.' : f.fair && f.complete ? html`<${Icon} name="check" /> Fair play: everyone plays ${f.min === f.max ? f.min : f.min + ' or ' + f.max} shifts.`
        : !f.complete ? html`Some shifts don't have ${k} players yet.` : html`Uneven: shifts range from ${f.min} to ${f.max}. Youth leagues usually want this within 1.`}
    </div>
  </div>`;
}

function aiRotationPrompt(g, notes) {
  const byId = rosterById();
  const present = (g.present || []).filter((id) => byId[id]);
  const season = CC.analyzeSeason(Object.values(Store.s.games).filter((x) => x.id !== g.id));
  const k = Math.min(onCourtOf(g), present.length), N = CC.nShifts(g);
  const base = Math.floor((N * k) / present.length);
  const rows = present.map((id) => {
    const p = byId[id], l = season.players[id], br = CC.bestRoles(p);
    const r = CC.SKILLS.map((s) => CC.rating(p, s.k)).join(',');
    const per = l && l.games ? `pts ${(l.pts / l.games).toFixed(1)}, reb ${(l.reb / l.games).toFixed(1)}, stl ${(l.stl / l.games).toFixed(1)}, ast ${(l.ast / l.games).toFixed(1)}, to ${(l.to / l.games).toFixed(1)}, on-court +/- per shift ${(l.pm / Math.max(1, l.shifts)).toFixed(1)} over ${l.shifts} shifts` : 'no tracked games';
    return `${id} | ${p.name} #${p.number} | ${CC.isEvaluated(p) ? r : 'not rated (assume 2s)'} | best: ${CC.ROLES[br.off[0].r].name} / ${CC.ROLES[br.def[0].r].name} | ${per}`;
  });
  const pairs = season.pairs.filter((x) => x.shifts >= 3 && x.ids.every((i) => present.includes(i))).sort((a, b) => b.pm / b.shifts - a.pm / a.shifts);
  const pairTxt = pairs.length ? pairs.slice(0, 4).map((x) => `${playerName(x.ids[0])} + ${playerName(x.ids[1])}: ${signed(x.pm)} over ${x.shifts} shifts`).concat(pairs.slice(-2).map((x) => `${playerName(x.ids[0])} + ${playerName(x.ids[1])}: ${signed(x.pm)} over ${x.shifts} shifts (struggled)`)).join('\n') : 'Not enough shared shifts yet.';
  return `You are an assistant coach for a youth basketball team (3rd-4th grade, ages 8-10). Plan the playing rotation for the next game.

RULES (must follow):
- ${N} shifts in order: ${Array.from({ length: N }, (_, i) => CC.shiftLabel(g, i, true)).join(', ')}.
- Exactly ${k} players on court in every shift. Use only the player ids listed below.
- Fair play: every player's shift count must be ${base} or ${base + 1} (counts differ by at most 1).

GOALS, in order:
1. Development and fun. Every kid gets real minutes and a chance to grow.
2. At least one capable ball handler (Dribbling 3+) on the court every shift whenever possible.
3. Mix stronger and newer players so no shift is all beginners or all stars.
4. Avoid anyone sitting two shifts in a row.
5. Use what the data shows about groups that played well together, but treat 1-2 shifts as weak evidence.

Coach's notes for this game: ${notes ? '"' + notes + '"' : 'none'}
Opponent: ${g.opponent}

PLAYERS. Ratings are 1-4 (1 Learning, 2 Getting it, 3 Solid, 4 Leader) in this order: dribbling, passing, shooting, defense, rebounding, spacing, hustle, confidence.
id | name | ratings | best offense / defense role | season averages
${rows.join('\n')}

PAIRS ON COURT TOGETHER THIS SEASON:
${pairTxt}

Reply with only JSON, no other text:
{"shifts":[["id","id",...], ...exactly ${N} arrays], "why":["one short sentence per shift, in order"], "summary":"2-3 plain sentences for the coach", "watch":["up to 3 short things to watch for during the game"], "cues":{"player id":"one short, positive coaching cue for this kid in this game"}}`;
}

function normalizeAIRotation(g, res) {
  const byId = rosterById();
  const present = new Set((g.present || []).filter((id) => byId[id]));
  const k = Math.min(onCourtOf(g), present.size), N = CC.nShifts(g);
  if (!res || !Array.isArray(res.shifts)) throw { code: 'invalid_json' };
  const shifts = [];
  for (let i = 0; i < N; i++) {
    const raw = Array.isArray(res.shifts[i]) ? res.shifts[i] : [];
    const seen = new Set(); const l = [];
    raw.forEach((id) => { id = String(id); if (present.has(id) && !seen.has(id) && l.length < k) { seen.add(id); l.push(id); } });
    shifts.push(l);
  }
  const counts = {}; present.forEach((id) => { counts[id] = 0; }); shifts.forEach((l) => l.forEach((id) => counts[id]++));
  const vals = Object.values(counts);
  const issues = [];
  shifts.forEach((l, i) => { if (l.length !== k) issues.push(CC.shiftLabel(g, i, true) + ' has ' + l.length + ' players'); });
  if (vals.length && Math.max(...vals) - Math.min(...vals) > 1) issues.push('shift counts range from ' + Math.min(...vals) + ' to ' + Math.max(...vals));
  const cues = {}; if (res.cues && typeof res.cues === 'object') Object.keys(res.cues).forEach((id) => { if (present.has(id)) cues[id] = String(res.cues[id]).slice(0, 120); });
  return { shifts, why: Array.isArray(res.why) ? res.why.map(String) : [], summary: String(res.summary || ''), watch: Array.isArray(res.watch) ? res.watch.map(String).slice(0, 3) : [], cues, issues };
}

function AIRotationPanel({ g, onClose }) {
  const aiOk = useAIAvailable();
  const [notes, setNotes] = useState('');
  const [state, setState] = useState({ phase: 'idle' });
  const ctl = useRef(null);
  async function run() {
    const sample = await AI.get();
    if (!sample) { setState({ phase: 'error', msg: AI.message({ code: 'not_granted' }) }); return; }
    ctl.current = new AbortController();
    setState({ phase: 'thinking' });
    try {
      const res = await sample.json(aiRotationPrompt(g, notes.trim()), { signal: ctl.current.signal, modelTier: 'default', cache: false });
      setState({ phase: 'done', plan: normalizeAIRotation(g, res) });
    } catch (e) { setState({ phase: 'error', msg: AI.message(e) }); }
  }
  function apply() {
    const plan = state.plan;
    Store.change((st) => {
      const gg = st.games[g.id];
      plan.shifts.forEach((l, i) => { gg.shifts[i].lineup = l; gg.shifts[i].offPos = {}; gg.shifts[i].defPos = {}; });
      gg.tips = { ...(gg.tips || {}), ...plan.cues };
      gg.ai = { ...(gg.ai || {}), plan: { summary: plan.summary, why: plan.why, watch: plan.watch, at: Date.now() } };
    }, [g.id]);
    toast('Claude’s rotation applied. Positions were set from each kid’s strengths.');
    onClose();
  }
  const byId = rosterById();
  return html`<div class="ai-panel">
    <div class="ai-head"><span class="ai-badge"><${Icon} name="spark" /> Claude</span><h3>Build the rotation with Claude</h3><button class="icon-btn" onClick=${onClose} aria-label="Close"><${Icon} name="x" /></button></div>
    ${aiOk === false ? html`<p class="muted">Claude isn't available on this page right now. Use <b>Build fair rotation</b> instead. It follows the same rules.</p>` : null}
    ${state.phase === 'idle' || state.phase === 'error' ? html`
      <p class="small muted">Claude reads each kid's skill ratings, season stats and which groups played well together, then follows your league's fair-play rule.</p>
      <label class="field"><span>Anything Claude should know? (optional)</span><textarea id="ai-notes" rows="2" value=${notes} onInput=${(e) => setNotes(e.target.value)} placeholder="e.g. Strong team today. Give Nora reps bringing the ball up. Keep Rose and Maya apart."></textarea></label>
      ${state.phase === 'error' ? html`<p class="error">${state.msg}</p>` : null}
      <div class="row gap end"><button class="btn primary" onClick=${run} disabled=${aiOk === false}><${Icon} name="spark" /> Suggest a rotation</button></div>` : null}
    ${state.phase === 'thinking' ? html`<div class="thinking"><span class="dots"><i></i><i></i><i></i></span> Claude is weighing skills, stats and fair play. This takes up to a minute.<button class="btn" onClick=${() => ctl.current && ctl.current.abort()}>Stop</button></div>` : null}
    ${state.phase === 'done' ? html`<div class="ai-result">
      <p>${state.plan.summary}</p>
      ${state.plan.issues.length ? html`<p class="warn-text small">Heads up: ${state.plan.issues.join('; ')}. You can fix these in the grid after applying.</p>` : null}
      <ol class="ai-shifts">${state.plan.shifts.map((l, i) => html`<li><b>${CC.shiftLabel(g, i, true)}</b><span class="mini-faces">${l.map((id) => html`<${Avatar} p=${byId[id]} size=${24} />`)}</span><span class="small">${state.plan.why[i] || ''}</span></li>`)}</ol>
      ${state.plan.watch.length ? html`<div class="small"><b>Watch for:</b><ul>${state.plan.watch.map((w) => html`<li>${w}</li>`)}</ul></div>` : null}
      <div class="row gap end"><button class="btn" onClick=${() => setState({ phase: 'idle' })}>Try again</button><button class="btn primary" onClick=${apply}><${Icon} name="check" /> Use this rotation</button></div>
    </div>` : null}
  </div>`;
}

function CourtEditor({ g, shift, setShift }) {
  const s = useStore();
  const [side, setSide] = useState('off');
  const [tipFor, setTipFor] = useState(null);
  const [tipTxt, setTipTxt] = useState('');
  const roster = s.team.roster;
  const N = CC.nShifts(g);
  const positions = CC.positionsFor(g, shift, side, roster);
  const sh = g.shifts[shift] || {};
  const formKey = side === 'off' ? g.offForm : g.defForm;
  function moveTo(id, x, y) {
    Store.change((st) => { const t = st.games[g.id].shifts[shift]; const k = side === 'off' ? 'offPos' : 'defPos'; t[k] = { ...(t[k] || {}), [id]: [x, y] }; }, [g.id]);
  }
  function setForm(v) { Store.change((st) => { st.games[g.id][side === 'off' ? 'offForm' : 'defForm'] = v; st.games[g.id].shifts.forEach((t) => { t[side === 'off' ? 'offPos' : 'defPos'] = {}; }); }, [g.id]); }
  function resetSpots() { Store.change((st) => { st.games[g.id].shifts[shift][side === 'off' ? 'offPos' : 'defPos'] = {}; }, [g.id]); }
  function saveTip() { Store.change((st) => { const t = { ...(st.games[g.id].tips || {}) }; if (tipTxt.trim()) t[tipFor] = tipTxt.trim(); else delete t[tipFor]; st.games[g.id].tips = t; }, [g.id]); setTipFor(null); }
  const byId = rosterById();
  return html`<div class="court-editor">
    <div class="ce-bar">
      <div class="shift-step"><button class="icon-btn" disabled=${shift === 0} onClick=${() => setShift(shift - 1)} aria-label="Previous shift"><${Icon} name="back" /></button><b>${CC.shiftLabel(g, shift, true)}</b><button class="icon-btn" disabled=${shift >= N - 1} onClick=${() => setShift(shift + 1)} aria-label="Next shift"><${Icon} name="next" /></button></div>
      <div class="seg two" role="tablist"><button role="tab" aria-selected=${side === 'off'} class=${'seg-btn' + (side === 'off' ? ' on off' : '')} onClick=${() => setSide('off')}>Offense</button><button role="tab" aria-selected=${side === 'def'} class=${'seg-btn' + (side === 'def' ? ' on def' : '')} onClick=${() => setSide('def')}>Defense</button></div>
      <label class="field compact"><span class="sr">Formation</span><select id=${'form-' + side} value=${formKey} onChange=${(e) => setForm(e.target.value)}>${CC.FORM_ORDER[side].map((k) => html`<option value=${k}>${CC.FORMATIONS[side][k].name}</option>`)}</select></label>
    </div>
    <div class="ce-body">
      <${Court} positions=${positions} roster=${roster} side=${side} editable=${true} onMove=${moveTo} tips=${g.tips} showSpots=${true}
        onTap=${(id) => { setTipFor(id); setTipTxt((g.tips || {})[id] || ''); }} />
      <div class="ce-side">
        <p class="small muted">${CC.FORMATIONS[side][formKey].desc} Kids start on the spot that fits their skills. Drag to adjust, tap a kid to add a tip.</p>
        <ul class="spot-list">${Object.entries(positions).map(([id, pos]) => html`<li key=${id}><${Avatar} p=${byId[id]} size=${28} /><span class="grow"><b>${byId[id].name}</b><span class="small muted"> ${pos.spot || ''}${pos.role ? ' · ' + CC.ROLES[pos.role].name : ''}</span>${(g.tips || {})[id] ? html`<span class="small tip-line">"${g.tips[id]}"</span>` : null}</span></li>`)}</ul>
        ${!Object.keys(positions).length ? html`<p class="muted">No one is on the court for this shift yet. Tap dots in the rotation grid.</p>` : null}
        <label class="field"><span>Note for ${CC.shiftLabel(g, shift, true)}</span><textarea id="shift-note" rows="2" value=${sh.note || ''} onChange=${(e) => Store.change((st) => { st.games[g.id].shifts[shift].note = e.target.value; }, [g.id])} placeholder="e.g. Hands up in the zone. Run the 5-out." ></textarea></label>
        <button class="btn small" onClick=${resetSpots}>Reset spots for this shift</button>
      </div>
    </div>
    <${Dialog} open=${!!tipFor} onClose=${() => setTipFor(null)} title=${'Tip for ' + (tipFor ? byId[tipFor] && byId[tipFor].name : '')}
      footer=${html`<button class="btn" onClick=${() => setTipFor(null)}>Cancel</button><button class="btn primary" onClick=${saveTip}>Save tip</button>`}>
      <label class="field"><span>One short cue for this game</span><input id="tip-txt" value=${tipTxt} onInput=${(e) => setTipTxt(e.target.value)} placeholder="e.g. Box out! Stay wide!" maxlength="80" /></label>
      ${tipFor && positions[tipFor] && positions[tipFor].role ? html`<p class="small muted">Spot idea: ${CC.ROLES[positions[tipFor].role].tip}</p>` : null}
    </${Dialog}>
  </div>`;
}

function PlanTab({ gameId, setGameId, openHuddle, openPlay }) {
  const s = useStore();
  const g = s.games[gameId];
  const [shift, setShift] = useState(0);
  const [aiOpen, setAiOpen] = useState(false);
  const [ask, confirmEl] = useConfirm();
  const [pdfBusy, setPdfBusy] = useState(false);
  useEffect(() => { setShift(0); setAiOpen(false); }, [gameId]);
  if (!g) return html`<section class="tab-page"><div class="page-head"><h1 class="display">Game plan</h1><${GamePicker} gameId=${gameId} setGameId=${setGameId} allowNew=${true} /></div><div class="empty">Create a game to plan the rotation.</div></section>`;
  const byId = rosterById();
  const present = (g.present || []).filter((id) => byId[id]);
  function autoBuild() {
    const players = present.map((id) => byId[id]);
    const rot = CC.buildRotation(players, CC.nShifts(g), onCourtOf(g), recentShiftHistory(g.id), CC.hashStr(g.id + Date.now()));
    Store.change((st) => { st.games[g.id].shifts.forEach((t, i) => { t.lineup = rot[i]; t.offPos = {}; t.defPos = {}; }); }, [g.id]);
    toast('Fair rotation built. Every shift has a ball handler where possible.');
  }
  async function pdf() {
    setPdfBusy(true);
    try { await exportPlanPDF(g); } catch (e) { toast(e && e.message ? e.message : "Couldn't make the PDF here."); }
    setPdfBusy(false);
  }
  const planInfo = g.ai && g.ai.plan;
  return html`<section class="tab-page">
    <div class="page-head">
      <div><h1 class="display">vs ${g.opponent}</h1><p class="muted">${fmtDate(g.date)} · ${CC.FORMATIONS.off[g.offForm].name} offense · ${CC.FORMATIONS.def[g.defForm].name}</p></div>
      <${GamePicker} gameId=${gameId} setGameId=${setGameId} allowNew=${true} />
    </div>
    <${Attendance} g=${g} />
    <${OpponentPanel} g=${g} openPlay=${openPlay} />
    <div class="panel">
      <div class="panel-head"><h2>Rotation</h2>
        <div class="row gap wrap">
          <button class="btn" onClick=${autoBuild} disabled=${!present.length}><${Icon} name="users" /> Build fair rotation</button>
          <button class="btn ai" onClick=${() => setAiOpen(true)} disabled=${!present.length}><${Icon} name="spark" /> Ask Claude</button>
          <button class="btn ghost" onClick=${() => ask('Clear the rotation?', 'Every shift will be emptied.', 'Clear', () => Store.change((st) => { st.games[g.id].shifts.forEach((t) => { t.lineup = []; t.offPos = {}; t.defPos = {}; }); }, [g.id]))}>Clear</button>
        </div>
      </div>
      ${aiOpen ? html`<${AIRotationPanel} g=${g} onClose=${() => setAiOpen(false)} />` : null}
      ${planInfo && !aiOpen ? html`<div class="ai-note"><span class="ai-badge"><${Icon} name="spark" /> Claude's plan</span> ${planInfo.summary}${planInfo.watch && planInfo.watch.length ? html` <b>Watch for:</b> ${planInfo.watch.join(' · ')}` : null}</div>` : null}
      <${RotationBoard} g=${g} onPick=${setShift} picked=${shift} />
    </div>
    <div class="panel">
      <div class="panel-head"><h2>Where everyone stands</h2>
        <div class="row gap wrap"><button class="btn" onClick=${() => openHuddle(g.id, shift)}><${Icon} name="full" /> Show the team</button>
        <button class="btn" onClick=${pdf} disabled=${pdfBusy}><${Icon} name="download" /> ${pdfBusy ? 'Making PDF…' : 'Printable game plan'}</button></div>
      </div>
      <${CourtEditor} g=${g} shift=${shift} setShift=${setShift} />
    </div>
    <div class="row gap between">
      <button class="btn danger-ghost" onClick=${() => ask('Delete this game?', 'The plan and any stats for this game will be removed.', 'Delete game', () => { const next = sortedGames().find((x) => x.id !== g.id); Store.deleteGame(g.id); setGameId(next ? next.id : ''); }, true)}><${Icon} name="trash" /> Delete game</button>
      <a class="btn primary" href="#live">Go to game day <${Icon} name="next" /></a>
    </div>
    ${confirmEl}
  </section>`;
}
