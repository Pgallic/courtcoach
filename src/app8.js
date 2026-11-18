/* ---------- Game day helpers, scouting, challenges, recaps ---------- */
let audioCtx = null;
function primeAudio() { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) { audioCtx = null; } }
function beep() {
  try {
    if (!audioCtx) return;
    [0, 0.32].forEach((d) => { const o = audioCtx.createOscillator(), gn = audioCtx.createGain(); o.frequency.value = 880; o.connect(gn); gn.connect(audioCtx.destination); gn.gain.setValueAtTime(0.0001, audioCtx.currentTime + d); gn.gain.exponentialRampToValueAtTime(0.4, audioCtx.currentTime + d + 0.02); gn.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + d + 0.25); o.start(audioCtx.currentTime + d); o.stop(audioCtx.currentTime + d + 0.27); });
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  } catch (e) { /* sound not allowed here */ }
}
function mmss(ms) { const t = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }

function ChangeCard({ g, onChange, compact }) {
  const byId = rosterById();
  const ch = CCP.changeAt(g, Math.min(g.cur || 0, CC.nShifts(g) - 1));
  if (ch.next === null) return html`<div class="change-card"><span class="muted">Last shift of the game.</span></div>`;
  const label = CC.shiftLabel(g, ch.next, true);
  return html`<div class="change-card">
    <div class="cc-head"><span class="eyebrow">Next change · ${label}</span></div>
    ${!ch.out.length ? html`<p class="small muted">Same five stay on.</p>` : html`<div class="cc-swap">
      <div><span class="cc-tag out">Out</span>${ch.out.map((id) => byId[id] && html`<span class="cc-p"><${Avatar} p=${byId[id]} size=${compact ? 26 : 32} />${byId[id].name}</span>`)}</div>
      <div><span class="cc-tag in">In</span>${ch.inn.map((id) => byId[id] && html`<span class="cc-p"><${Avatar} p=${byId[id]} size=${compact ? 26 : 32} />${byId[id].name}</span>`)}</div></div>`}
    <button class="btn primary" onClick=${onChange}>Make the change <${Icon} name="next" /></button>
  </div>`;
}

function ClockPanel({ g, go }) {
  const s = useStore();
  const [now, setNow] = useState(Date.now());
  const alerted = useRef({});
  const clock = g.clock || {};
  const lenS = clock.len || ((s.team.settings || {}).periodMin || 6) * 60;
  const running = !!clock.run;
  useEffect(() => { if (!running) return; const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, [running]);
  const el = CCP.clockElapsed(clock, running ? now : Date.now());
  const spq = g.spq || 2, N = CC.nShifts(g), cur = Math.min(g.cur || 0, N - 1), q = Math.floor(cur / spq), part = cur - q * spq;
  const periods = g.quarters || 4, pname = periods === 2 ? 'Half ' : 'Q';
  let due = null;
  for (let j = 1; j < spq; j++) if (el >= (lenS * 1000 * j) / spq && part < j) { due = { kind: 'sub', key: q + ':' + j }; break; }
  const over = el >= lenS * 1000;
  if (over && !due) due = { kind: 'end', key: q + ':end' };
  useEffect(() => { if (due && running && !alerted.current[due.key]) { alerted.current[due.key] = true; beep(); } });
  function setClock(c) { Store.change((st) => { st.games[g.id].clock = c; if (st.games[g.id].status === 'plan') st.games[g.id].status = 'live'; }, [g.id]); }
  function start() { primeAudio(); setClock({ len: lenS, el: clock.el || 0, run: Date.now() }); setNow(Date.now()); }
  function pause() { setClock({ len: lenS, el: CCP.clockElapsed(clock, Date.now()), run: null }); }
  function reset() { alerted.current = {}; setClock({ len: lenS, el: 0, run: null }); }
  function setLen(min) { Store.change((st) => { st.team.settings = { ...(st.team.settings || {}), periodMin: min }; }, ['team']); setClock({ len: min * 60, el: clock.el || 0, run: clock.run || null }); }
  function nextPeriod() { alerted.current = {}; Store.change((st) => { const gg = st.games[g.id]; gg.cur = Math.min(N - 1, (q + 1) * spq); gg.clock = { len: lenS, el: 0, run: null }; }, [g.id]); }
  const marks = []; for (let j = 1; j < spq; j++) marks.push(j / spq);
  const pct = Math.min(1, el / (lenS * 1000));
  return html`<div class=${'panel clock-panel' + (due ? ' due' : '')}>
    <div class="clock-row">
      <div class="clock">
        <span class="clock-label">${pname}${q + 1} clock</span>
        <span class="clock-time">${mmss(lenS * 1000 - el)}</span>
        <div class="clock-bar"><span style=${`width:${pct * 100}%`}></span>${marks.map((m) => html`<i style=${`left:${m * 100}%`}></i>`)}</div>
      </div>
      <div class="row gap wrap">
        ${running ? html`<button class="btn" onClick=${pause}>Pause</button>` : html`<button class="btn primary" onClick=${start} disabled=${over}>${el > 0 ? 'Resume' : 'Start clock'}</button>`}
        <button class="btn ghost" onClick=${reset}>Reset</button>
        <label class="field compact"><span class="sr">Period length</span><select id="clock-len" value=${Math.round(lenS / 60)} onChange=${(e) => setLen(+e.target.value)}>${[4, 5, 6, 7, 8, 10, 12].map((m) => html`<option value=${m}>${m} min ${periods === 2 ? 'halves' : 'quarters'}</option>`)}</select></label>
      </div>
    </div>
    ${due && due.kind === 'sub' ? html`<div class="due-banner"><b>Time to sub!</b> Midpoint of ${pname}${q + 1}.</div>` : null}
    ${due && due.kind === 'end' ? html`<div class="due-banner"><b>End of ${pname}${q + 1}.</b> ${q + 1 < periods ? html`<button class="btn primary" onClick=${nextPeriod}>Start ${pname}${q + 2} lineup</button>` : 'That’s the game!'}</div>` : null}
    ${!(due && due.kind === 'end') ? html`<${ChangeCard} g=${g} onChange=${() => go(Math.min(N - 1, cur + 1))} />` : null}
    <p class="small muted">The clock beeps at the midpoint and the end of each period. Pause it when the ref stops play.</p>
  </div>`;
}

function TimeoutCard({ g, onClose, openPlay }) {
  const s = useStore();
  const names = {}; s.team.roster.forEach((p) => { names[p.id] = p.name; });
  const opp = (s.team.opponents || {})[CCP.oppKey(g.opponent)];
  const tc = CCP.timeoutCard(g, opp, names);
  const sug = CCP.suggestPlay(s.team, Object.values(s.games), opp);
  const play = CCP.findPlay(s.team, sug.id);
  const spq = g.spq || 2, q = Math.floor((g.cur || 0) / spq);
  return html`<${Dialog} open=${true} onClose=${onClose} title=${'Timeout · ' + ((g.quarters || 4) === 2 ? 'Half ' : 'Q') + (q + 1)} wide=${true}>
    <p class="muted">This period: ${s.team.name} ${tc.period.us}, ${g.opponent} ${tc.period.them}</p>
    <ol class="to-list">
      ${tc.fixes.map((f) => html`<li class="to-fix"><b>${f.title}</b><span>${f.say}</span></li>`)}
      ${!tc.fixes.length ? html`<li class="to-fix calm"><b>Keep doing what you're doing</b><span>Nothing jumps out in the stats. Remind them of one thing from practice.</span></li>` : null}
      <li class="to-good"><b>${tc.good.title}</b><span>${tc.good.say}</span></li>
    </ol>
    ${play ? html`<div class="to-play"><div><span class="eyebrow">Play to run</span><b>${play.name}</b><span class="small muted"> ${sug.why}</span></div><button class="btn primary" onClick=${() => { onClose(); openPlay(play.id); }}><${Icon} name="full" /> Show the team</button></div>` : null}
    <${ChangeCard} g=${g} compact=${true} onChange=${() => { Store.change((st) => { st.games[g.id].cur = Math.min(CC.nShifts(g) - 1, (g.cur || 0) + 1); }, [g.id]); onClose(); }} />
  </${Dialog}>`;
}

function PlayPicker({ g, onClose, openPlay }) {
  const s = useStore();
  const starred = new Set(CCP.stars(s.team));
  const plays = CCP.allPlays(s.team).filter((p) => starred.has(p.id));
  const games = Object.values(s.games);
  return html`<${Dialog} open=${true} onClose=${onClose} title="Run a play" wide=${true}>
    <p class="small muted">Fills in with the five on the court now. After the play, tap how it went.</p>
    ${CCP.CATS.map(([k, label]) => { const items = plays.filter((p) => (p.cat || 'custom') === k); if (!items.length) return null; return html`<div class="pp-group"><span class="eyebrow">${label}</span><div class="pp-grid">
      ${items.map((p) => { const st = CCP.playStats(games, p.id); return html`<button class="pp-btn" onClick=${() => { onClose(); openPlay(p.id); }}><b>${p.name}</b><span class="small muted">${st.runs ? st.score + ' of ' + st.runs + ' scored' : 'Not run yet'}</span></button>`; })}
    </div></div>`; })}
    ${!plays.length ? html`<p class="muted">Star plays on the Plays tab to put them here.</p>` : null}
  </${Dialog}>`;
}

/* ---------- opponent notes ---------- */
function OpponentPanel({ g, openPlay }) {
  const s = useStore();
  const key = CCP.oppKey(g.opponent);
  const opp = (s.team.opponents || {})[key] || { name: g.opponent, tags: [], notes: '' };
  const [open, setOpen] = useState(!!(opp.tags.length || opp.notes));
  const past = sortedGames().filter((x) => x.id !== g.id && x.status === 'final' && CCP.oppKey(x.opponent) === key).map((x) => ({ x, a: CC.analyzeGame(x) }));
  function save(fn) { Store.change((st) => { const all = { ...(st.team.opponents || {}) }; const o = { name: g.opponent, tags: [], notes: '', ...(all[key] || {}) }; fn(o); o.updatedAt = Date.now(); all[key] = o; st.team.opponents = all; }, ['team']); }
  const tips = opp.tags.map((t) => CCP.OPP_TAGS[t]).filter(Boolean);
  const offSug = tips.map((t) => t.off).find(Boolean), defSug = tips.map((t) => t.def).find(Boolean);
  const playIds = Array.from(new Set(tips.flatMap((t) => t.plays)));
  return html`<div class="panel opp-panel">
    <button class="panel-head as-btn" onClick=${() => setOpen(!open)} aria-expanded=${open}><h2>Scouting: ${g.opponent}</h2><span class="small muted">${past.length ? 'Played ' + past.length + 'x: ' + past.map((p) => p.a.us + '–' + p.a.them).join(', ') : 'First time playing them'} ${open ? '▲' : '▼'}</span></button>
    ${open ? html`<div class="opp-body">
      <div class="chips">${Object.entries(CCP.OPP_TAGS).map(([k, t]) => html`<button class=${'chip-btn' + (opp.tags.includes(k) ? ' on' : '')} aria-pressed=${opp.tags.includes(k)} onClick=${() => save((o) => { o.tags = o.tags.includes(k) ? o.tags.filter((x) => x !== k) : o.tags.concat(k); })}>${t.label}</button>`)}</div>
      <label class="field"><span>Notes</span><textarea id="opp-notes" rows="2" value=${opp.notes} onChange=${(e) => save((o) => { o.notes = e.target.value; })} placeholder="e.g. #5 is tall. They pressed after every basket."></textarea></label>
      ${tips.length ? html`<div class="opp-sug"><span class="eyebrow">Game plan ideas</span><ul>${tips.map((t) => html`<li>${t.tip}</li>`)}</ul>
        <div class="row gap wrap">
          ${offSug && offSug !== g.offForm ? html`<button class="btn small" onClick=${() => Store.change((st) => { st.games[g.id].offForm = offSug; st.games[g.id].shifts.forEach((x) => { x.offPos = {}; }); }, [g.id])}>Use ${CC.FORMATIONS.off[offSug].name} offense</button>` : null}
          ${defSug && defSug !== g.defForm ? html`<button class="btn small" onClick=${() => Store.change((st) => { st.games[g.id].defForm = defSug; st.games[g.id].shifts.forEach((x) => { x.defPos = {}; }); }, [g.id])}>Use ${CC.FORMATIONS.def[defSug].name}</button>` : null}
          ${playIds.map((id) => { const p = CCP.findPlay(s.team, id); return p ? html`<button class="btn small ghost-acc" onClick=${() => openPlay(id)}>Play: ${p.name}</button>` : null; })}
        </div></div>` : html`<p class="small muted">Tag what they do and you'll get formation and play ideas here and in your timeout card.</p>`}
    </div>` : null}
  </div>`;
}

/* ---------- home challenges ---------- */
function ChallengesPanel() {
  const s = useStore();
  const [week, setWeek] = useState(CCP.mondayOf(todayISO()));
  const [copied, setCopied] = useState(false);
  const roster = s.team.roster;
  const wk = ((s.team.challenges || {}).weeks || {})[week];
  const season = useMemo(() => CC.analyzeSeason(Object.values(s.games)), [s.games]);
  function save(fn) { Store.change((st) => { const c = { weeks: {}, ...(st.team.challenges || {}) }; c.weeks = { ...c.weeks }; const w = { team: 'drib', personal: {}, done: {}, pdone: {}, ...(c.weeks[week] || {}) }; fn(w); c.weeks[week] = w; st.team.challenges = c; }, ['team']); }
  function setup() { const tf = CC.teamFocus(roster, season); save((w) => { w.team = tf.order[0]; w.personal = {}; roster.forEach((p) => { w.personal[p.id] = CC.practiceFocus(p, season.players[p.id]); }); }); }
  const wkLabel = (() => { const [y, m, d] = week.split('-').map(Number); return 'Week of ' + new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); })();
  const text = wk ? `${s.team.name} home challenges, ${wkLabel.toLowerCase()}\n\nTeam challenge: ${CCP.CHALLENGES[wk.team].title}. ${CCP.CHALLENGES[wk.team].how}\n\nPersonal challenges:\n` + roster.map((p) => { const c = CCP.CHALLENGES[(wk.personal || {})[p.id]]; return c ? `• ${p.name}: ${c.title}. ${c.how}` : null; }).filter(Boolean).join('\n') + `\n\nKids check off at practice and earn the Home Hero badge!` : '';
  async function copy() { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (e) { setCopied('fail'); } }
  const doneN = wk ? roster.filter((p) => wk.done && wk.done[p.id]).length : 0;
  return html`<div class="panel">
    <div class="panel-head"><h2>Home challenges</h2>
      <div class="shift-step"><button class="icon-btn" onClick=${() => setWeek(CCP.shiftWeek(week, -1))} aria-label="Previous week"><${Icon} name="back" /></button><b class="wk-label">${wkLabel}</b><button class="icon-btn" onClick=${() => setWeek(CCP.shiftWeek(week, 1))} aria-label="Next week"><${Icon} name="next" /></button></div></div>
    ${!wk ? html`<div class="empty small">No challenges set for this week.<br /><button class="btn primary" onClick=${setup}>Set up this week</button><br /><span class="muted">Picks a team challenge from your team's biggest need and a personal one for each kid from her practice focus.</span></div>` : html`
      <div class="row gap wrap"><label class="field grow"><span>Team challenge</span><select id="ch-team" value=${wk.team} onChange=${(e) => save((w) => { w.team = e.target.value; })}>${Object.entries(CCP.CHALLENGES).map(([k, c]) => html`<option value=${k}>${c.title}</option>`)}</select></label>
        <span class="chip good">${doneN} of ${roster.length} done</span></div>
      <p class="small">${CCP.CHALLENGES[wk.team].how}</p>
      <div class="table-scroll"><table class="data ch-table"><thead><tr><th>Player</th><th>Team</th><th>Personal challenge</th><th>Done</th><th class="num">Season</th></tr></thead>
        <tbody>${roster.map((p) => html`<tr key=${p.id}>
          <td class="who"><${Avatar} p=${p} size=${26} /> ${p.name}</td>
          <td><button class=${'check' + (wk.done && wk.done[p.id] ? ' on' : '')} aria-pressed=${!!(wk.done && wk.done[p.id])} aria-label=${p.name + ' team challenge'} onClick=${() => save((w) => { w.done = { ...(w.done || {}) }; if (w.done[p.id]) delete w.done[p.id]; else w.done[p.id] = 1; })}>${wk.done && wk.done[p.id] ? '✓' : ''}</button></td>
          <td><select aria-label=${p.name + ' personal challenge'} value=${(wk.personal || {})[p.id] || 'drib'} onChange=${(e) => { const v = e.target.value; save((w) => { w.personal = { ...(w.personal || {}), [p.id]: v }; }); }}>${Object.entries(CCP.CHALLENGES).map(([k, c]) => html`<option value=${k}>${c.title}</option>`)}</select></td>
          <td><button class=${'check' + (wk.pdone && wk.pdone[p.id] ? ' on' : '')} aria-pressed=${!!(wk.pdone && wk.pdone[p.id])} aria-label=${p.name + ' personal challenge done'} onClick=${() => save((w) => { w.pdone = { ...(w.pdone || {}) }; if (w.pdone[p.id]) delete w.pdone[p.id]; else w.pdone[p.id] = 1; })}>${wk.pdone && wk.pdone[p.id] ? '✓' : ''}</button></td>
          <td class="num">${CCP.challengeCount(s.team, p.id)}</td></tr>`)}</tbody></table></div>
      <div class="row gap wrap"><button class="btn" onClick=${copy}><${Icon} name="copy" /> ${copied === true ? 'Copied' : 'Copy for parents'}</button><button class="btn ghost" onClick=${setup}>Re-pick from latest skills</button></div>
      ${copied === 'fail' ? html`<textarea class="copy-fallback" rows="8" readonly value=${text}></textarea>` : null}
      <p class="small muted">3 finished challenges earn the Home Hero badge on a player card.</p>`}
  </div>`;
}

/* ---------- parent recap ---------- */
function ParentRecap({ g, A, season }) {
  const s = useStore();
  const tf = CC.teamFocus(s.team.roster, season);
  const wk = ((s.team.challenges || {}).weeks || {})[CCP.mondayOf(todayISO())] || ((s.team.challenges || {}).weeks || {})[CCP.mondayOf(g.date || todayISO())];
  const base = CCP.parentRecap(s.team, g, A, season, wk, tf.order[0]);
  const [txt, setTxt] = useState(base);
  const [st, setSt] = useState({ phase: 'idle' });
  const [copied, setCopied] = useState(false);
  const aiOk = useAIAvailable();
  const ctl = useRef(null);
  useEffect(() => { setTxt(base); setSt({ phase: 'idle' }); }, [g.id]);
  async function polish() {
    const sample = await AI.get(); if (!sample) { setSt({ phase: 'error', msg: AI.message({ code: 'not_granted' }) }); return; }
    ctl.current = new AbortController(); setSt({ phase: 'thinking' });
    const shout = g.ai && g.ai.review && g.ai.review.shoutouts ? Object.entries(g.ai.review.shoutouts).map(([id, t]) => (rosterById()[id] || {}).name + ': ' + t).join('\n') : '';
    try {
      const r = await sample(`Rewrite this message for a youth basketball team's parent group chat (3rd-4th grade girls). Make it warm, upbeat and easy to read on a phone, under 140 words. Keep every player's name and every fact. Never mention turnovers, mistakes, or compare kids negatively. Keep the line about practice and the home challenge. Reply with only the message.\n\n${txt}${shout ? '\n\nCoach shout-outs you may weave in:\n' + shout : ''}`, { signal: ctl.current.signal, cache: false, onText: ({ text }) => setTxt(text) });
      setTxt(r.text.trim()); setSt({ phase: 'idle' });
    } catch (e) { if (e && e.text) setTxt(e.text); setSt({ phase: 'error', msg: AI.message(e) }); }
  }
  async function copy() { try { await navigator.clipboard.writeText(txt); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (e) { setCopied('fail'); toast('Select the text and copy it yourself.'); } }
  return html`<div class="panel">
    <div class="panel-head"><h2>Parent recap</h2><div class="row gap wrap">
      ${aiOk !== false ? (st.phase === 'thinking' ? html`<button class="btn" onClick=${() => ctl.current && ctl.current.abort()}>Stop</button>` : html`<button class="btn ai" onClick=${polish}><${Icon} name="spark" /> Polish with Claude</button>`) : null}
      <button class="btn primary" onClick=${copy}><${Icon} name="copy" /> ${copied === true ? 'Copied' : 'Copy'}</button></div></div>
    <p class="small muted">Positive only: every kid gets a highlight, no turnovers. Edit anything before you paste it in the group chat.</p>
    <textarea id="recap-txt" class="recap" rows="12" value=${txt} onInput=${(e) => setTxt(e.target.value)}></textarea>
    ${st.phase === 'error' ? html`<p class="error">${st.msg}</p>` : null}
    ${txt !== base ? html`<button class="link-btn small" onClick=${() => setTxt(base)}>Start over from the stats</button>` : null}
  </div>`;
}

/* ---------- plays in review ---------- */
function PlaysReview({ games, title }) {
  const s = useStore();
  const rows = CCP.allPlays(s.team).map((p) => ({ p, st: CCP.playStats(games, p.id) })).filter((r) => r.st.runs).sort((a, b) => (b.st.score / b.st.runs) - (a.st.score / a.st.runs) || b.st.runs - a.st.runs);
  return html`<div class="panel">
    <h2>${title}</h2>
    ${rows.length ? html`<table class="data"><thead><tr><th>Play</th><th class="num">Runs</th><th class="num">Scored</th><th class="num">Shot</th><th class="num">Turnover</th><th>Works</th></tr></thead>
      <tbody>${rows.map(({ p, st }) => html`<tr><td><b>${p.name}</b></td><td class="num">${st.runs}</td><td class="num pos">${st.score}</td><td class="num">${st.shot}</td><td class="num neg">${st.to}</td>
        <td><span class="rate"><span style=${`width:${Math.round(((st.score + 0.4 * st.shot) / st.runs) * 100)}%`}></span></span></td></tr>`)}</tbody></table>
      <p class="small muted">"Works" counts a score fully and a good shot partly. A few runs is a hint, not proof.</p>` : html`<p class="muted">No plays logged yet. On Game day, tap Plays, show one, then tap how it went.</p>`}
  </div>`;
}
