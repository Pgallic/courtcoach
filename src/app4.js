/* ---------- Game day (live tracking) ---------- */
const PAD = [
  ['fg2', 'Made 2', 'score'], ['ft', 'Free throw', 'score'], ['miss', 'Missed shot', 'shot'], ['fg3', 'Made 3', 'score'],
  ['reb', 'Rebound', 'good'], ['stl', 'Steal', 'good'], ['ast', 'Assist', 'good'], ['hus', 'Hustle play', 'good'], ['to', 'Turnover', 'learn']
];

function LiveTab({ gameId, setGameId, openHuddle, openPlayHuddle }) {
  const s = useStore();
  const g = s.games[gameId];
  const [sel, setSel] = useState(null);
  const [subOut, setSubOut] = useState(null);
  const [showTO, setShowTO] = useState(false);
  const [showPlays, setShowPlays] = useState(false);
  const [ask, confirmEl] = useConfirm();
  if (!g) return html`<section class="tab-page"><div class="page-head"><h1 class="display">Game day</h1><${GamePicker} gameId=${gameId} setGameId=${setGameId} allowNew=${true} /></div><div class="empty">Plan a game first, then track it here.</div></section>`;
  const byId = rosterById();
  const N = CC.nShifts(g);
  const cur = Math.min(g.cur || 0, N - 1);
  const lineup = CC.lineupOf(g, cur).filter((id) => byId[id]);
  const A = CC.analyzeGame({ ...g, status: 'final' });
  const ss = A.shiftScore[cur] || { us: 0, them: 0 };
  const bench = (g.present || []).filter((id) => byId[id] && !lineup.includes(id));
  function log(t) {
    const def = CC.EVENTS[t];
    const p = def.team === 'them' ? null : sel;
    const ev = { id: CC.uid(), s: cur, p, t, at: Date.now() };
    Store.change((st) => { const gg = st.games[g.id]; gg.events = (gg.events || []).concat(ev); if (gg.status === 'plan') gg.status = 'live'; }, [g.id]);
    const who = p ? byId[p].name : def.team === 'them' ? g.opponent : 'Team';
    toast(def.label + ' · ' + who, { label: 'Undo', fn: () => Store.change((st) => { st.games[g.id].events = st.games[g.id].events.filter((e) => e.id !== ev.id); }, [g.id]) });
    setSel(null);
  }
  function go(i) { Store.change((st) => { st.games[g.id].cur = i; if (st.games[g.id].status === 'plan') st.games[g.id].status = 'live'; }, [g.id]); setSel(null); }
  function doSub(inId) {
    Store.change((st) => { const t = st.games[g.id].shifts[cur]; const l = CC.lineupOf(st.games[g.id], cur).slice(); const i = l.indexOf(subOut); if (i >= 0) l[i] = inId; else l.push(inId); t.actual = l; }, [g.id]);
    toast(byId[inId].name + ' in for ' + byId[subOut].name);
    setSubOut(null);
  }
  const recent = (g.events || []).slice(-6).reverse();
  const line = (id) => { const l = A.players[id] || CC.emptyLine(); const bits = []; if (l.pts) bits.push(l.pts + ' pts'); if (l.reb) bits.push(l.reb + ' reb'); if (l.stl) bits.push(l.stl + ' stl'); if (l.ast) bits.push(l.ast + ' ast'); if (l.hus) bits.push(l.hus + ' hustle'); return bits.join(' · ') || 'No stats yet'; };
  return html`<section class="tab-page live">
    <div class="page-head"><div><h1 class="display">Game day</h1><p class="muted">Tap a player, then what they did. Tap a stat with nobody picked to credit the team.</p></div><${GamePicker} gameId=${gameId} setGameId=${setGameId} /></div>
    <div class="scoreboard">
      <div class="sb-team"><span class="sb-name">${s.team.name}</span><span class="sb-score">${A.us}</span></div>
      <div class="sb-mid">
        <div class="shift-step big"><button class="icon-btn" disabled=${cur === 0} onClick=${() => go(cur - 1)} aria-label="Previous shift"><${Icon} name="back" /></button><span class="sb-shift">${CC.shiftLabel(g, cur, true)}</span><button class="icon-btn" disabled=${cur >= N - 1} onClick=${() => go(cur + 1)} aria-label="Next shift"><${Icon} name="next" /></button></div>
        <span class="sb-sub">This shift ${ss.us}–${ss.them}</span>
        ${g.status === 'final' ? html`<span class="chip good">Final</span>` : null}
      </div>
      <div class="sb-team them"><span class="sb-name">${g.opponent}</span><span class="sb-score">${A.them}</span></div>
    </div>
    <div class="live-actions">
      <button class="btn big-act" onClick=${() => setShowTO(true)}><${Icon} name="users" /> Timeout</button>
      <button class="btn big-act" onClick=${() => setShowPlays(true)}><${Icon} name="ball" /> Plays</button>
      <button class="btn big-act" onClick=${() => openHuddle(g.id, cur)}><${Icon} name="full" /> Where to stand</button>
    </div>
    ${g.status !== 'final' ? html`<${ClockPanel} g=${g} go=${go} />` : null}
    <div class="live-grid">
      <div class="panel">
        <div class="panel-head"><h2>On the court</h2><button class="btn small" onClick=${() => openHuddle(g.id, cur)}><${Icon} name="full" /> Show the team</button></div>
        <div class="oncourt">
          ${lineup.map((id) => html`<div class=${'oc-tile' + (sel === id ? ' sel' : '')} key=${id}>
            <button class="oc-main" aria-pressed=${sel === id} onClick=${() => setSel(sel === id ? null : id)}><${Avatar} p=${byId[id]} size=${56} /><span class="oc-name">${byId[id].name} <span class="muted">#${byId[id].number}</span></span><span class="oc-line">${line(id)}</span></button>
            <button class="link-btn small" onClick=${() => setSubOut(id)}><${Icon} name="swap" size=${14} /> Sub</button>
          </div>`)}
          ${!lineup.length ? html`<p class="muted">Nobody is planned for this shift. Fill it in on the Game plan tab.</p>` : null}
        </div>
      </div>
      <div class="panel">
        <h2>${sel ? byId[sel].name : 'Team'}</h2>
        <div class="pad">${PAD.map(([t, label, kind]) => html`<button class=${'pad-btn ' + kind} onClick=${() => log(t)}>${label}</button>`)}</div>
        <h3 class="pad-sub">${g.opponent} scored</h3>
        <div class="pad opp">${['opp2', 'opp1', 'opp3'].map((t) => html`<button class="pad-btn opp" onClick=${() => log(t)}>+${CC.EVENTS[t].pts}</button>`)}</div>
        <div class="log">${recent.map((e) => html`<div class="log-row"><span class="muted small">${CC.shiftLabel(g, e.s)}</span><span>${CC.EVENTS[e.t].label}</span><span class="grow muted">${e.p ? byId[e.p] && byId[e.p].name : CC.EVENTS[e.t].team === 'them' ? g.opponent : 'Team'}</span><button class="icon-btn small" aria-label="Remove" onClick=${() => Store.change((st) => { st.games[g.id].events = st.games[g.id].events.filter((x) => x.id !== e.id); }, [g.id])}><${Icon} name="x" size=${14} /></button></div>`)}</div>
      </div>
    </div>
    <div class="row gap end">
      ${g.status !== 'final' ? html`<button class="btn primary" onClick=${() => ask('End the game?', 'The game moves to Review, where you can see how each rotation did.', 'End game', () => { Store.change((st) => { st.games[g.id].status = 'final'; st.games[g.id].cur = N - 1; }, [g.id]); location.hash = 'review'; })}>End game and review</button>`
        : html`<button class="btn" onClick=${() => Store.change((st) => { st.games[g.id].status = 'live'; }, [g.id])}>Reopen game</button><a class="btn primary" href="#review">See the review</a>`}
    </div>
    <${Dialog} open=${!!subOut} onClose=${() => setSubOut(null)} title=${subOut ? 'Who goes in for ' + byId[subOut].name + '?' : ''}>
      <div class="sub-grid">${bench.map((id) => html`<button class="attend-btn on" onClick=${() => doSub(id)}><${Avatar} p=${byId[id]} size=${36} /><span>${byId[id].name}</span></button>`)}</div>
      ${!bench.length ? html`<p class="muted">Everyone who's here is already on the court.</p>` : null}
      <p class="small muted">The sub only changes this shift. Stats for the rest of the shift go to the new group.</p>
    </${Dialog}>
    ${showTO ? html`<${TimeoutCard} g=${g} onClose=${() => setShowTO(false)} openPlay=${(id) => openPlayHuddle(id, { gameId: g.id })} />` : null}
    ${showPlays ? html`<${PlayPicker} g=${g} onClose=${() => setShowPlays(false)} openPlay=${(id) => openPlayHuddle(id, { gameId: g.id })} />` : null}
    ${confirmEl}
  </section>`;
}

/* ---------- Review: how each rotation worked ---------- */
function ShiftChart({ g, A }) {
  const N = CC.nShifts(g);
  const W = 640, H = 170, pad = 28, bw = (W - pad * 2) / N;
  const maxv = Math.max(4, ...A.shiftScore.map((x) => Math.abs(x.us - x.them)));
  const mid = H / 2 + 6;
  const sc = (v) => (v / maxv) * (H / 2 - 30);
  return html`<svg class="shiftchart" viewBox=${`0 0 ${W} ${H}`} role="img" aria-label="Score difference for each shift">
    <line x1=${pad} x2=${W - pad} y1=${mid} y2=${mid} class="axis" />
    ${A.shiftScore.slice(0, N).map((x, i) => {
      const d = x.us - x.them, hgt = Math.max(2, Math.abs(sc(d))), xx = pad + i * bw + bw * 0.18;
      return html`<g key=${i}>
        <rect x=${xx} width=${bw * 0.64} y=${d >= 0 ? mid - hgt : mid} height=${hgt} rx="3" class=${d > 0 ? 'bar-pos' : d < 0 ? 'bar-neg' : 'bar-even'} />
        <text x=${xx + bw * 0.32} y=${d >= 0 ? mid - hgt - 6 : mid + hgt + 14} class="bar-lbl" text-anchor="middle">${x.us}–${x.them}</text>
        <text x=${xx + bw * 0.32} y=${H - 4} class="axis-lbl" text-anchor="middle">${CC.shiftLabel(g, i)}</text>
      </g>`;
    })}
    <text x=${pad} y="14" class="axis-lbl">Our points minus theirs, by shift</text>
  </svg>`;
}

function Faces({ ids, size = 24 }) { const byId = rosterById(); return html`<span class="mini-faces">${ids.filter((id) => byId[id]).map((id) => html`<span title=${byId[id].name}><${Avatar} p=${byId[id]} size=${size} /></span>`)}</span>`; }

function aiReviewPrompt(g, A, season) {
  const byId = rosterById();
  const shifts = A.shiftScore.slice(0, CC.nShifts(g)).map((x, i) => `${CC.shiftLabel(g, i, true)}: ${CC.lineupOf(g, i).map((id) => (byId[id] || {}).name).join(', ')} | ${x.us}-${x.them}`);
  const players = (g.present || []).filter((id) => byId[id]).map((id) => {
    const l = A.players[id] || CC.emptyLine(); const p = byId[id];
    return `${id} | ${p.name} | shifts ${l.shifts} | pts ${l.pts} (${l.fgm}/${l.fga} FG, ${l.ftm} FT) reb ${l.reb} stl ${l.stl} ast ${l.ast} hustle ${l.hus} to ${l.to} | on-court ${signed(l.pm)} | ratings ${CC.SKILLS.map((s) => CC.rating(p, s.k)).join(',')}`;
  });
  return `You are an encouraging, practical assistant coach for a youth basketball team (3rd-4th grade). Review this game for the head coach.

Game: ${Store.s.team.name} ${A.us}, ${g.opponent} ${A.them} (${fmtDate(g.date)}). Team points with no player credited: ${A.teamUnassigned}.
Shifts (lineup | score in that shift):
${shifts.join('\n')}

Players (id | name | stats this game | ratings 1-4 for dribbling, passing, shooting, defense, rebounding, spacing, hustle, confidence):
${players.join('\n')}

Season so far: ${season.record.w}-${season.record.l}${season.record.t ? '-' + season.record.t : ''} in ${season.games.length} tracked games.

Guidance: these are 8-10 year olds. Small samples are noisy (one shift is a hint, not proof). Celebrate effort stats (rebounds, steals, hustle, assists) as much as points. Turnovers are for the coach only and are normal at this age. Suggest concrete, simple changes.

Reply with only JSON:
{"headline":"6-10 word summary","recap":"3-4 sentences for the coach","kidRecap":"2 positive sentences the coach can read to the team","worked":["up to 3 things that worked, naming lineups or players"],"change":["up to 3 specific adjustments for next game"],"shoutouts":{"player id":"one specific, positive sentence for that kid"},"focus":{"player id":{"skill":"one of drib,pass,shoot,def,reb,space,hustle,conf","why":"short reason"}},"practice":[{"drill":"name","minutes":10,"why":"short reason"}]}`;
}

function AIReview({ g, A, season }) {
  const aiOk = useAIAvailable();
  const [st, setSt] = useState({ phase: 'idle' });
  const ctl = useRef(null);
  const saved = g.ai && g.ai.review;
  const byId = rosterById();
  async function run() {
    const sample = await AI.get();
    if (!sample) { setSt({ phase: 'error', msg: AI.message({ code: 'not_granted' }) }); return; }
    ctl.current = new AbortController();
    setSt({ phase: 'thinking' });
    try {
      const r = await sample.json(aiReviewPrompt(g, A, season), { signal: ctl.current.signal, cache: false });
      const clean = { headline: String(r.headline || ''), recap: String(r.recap || ''), kidRecap: String(r.kidRecap || ''), worked: (r.worked || []).map(String).slice(0, 3), change: (r.change || []).map(String).slice(0, 3),
        shoutouts: {}, focus: {}, practice: Array.isArray(r.practice) ? r.practice.slice(0, 5).map((d) => ({ drill: String(d.drill || ''), minutes: +d.minutes || 10, why: String(d.why || '') })) : [], at: Date.now() };
      Object.keys(r.shoutouts || {}).forEach((id) => { if (byId[id]) clean.shoutouts[id] = String(r.shoutouts[id]); });
      Object.keys(r.focus || {}).forEach((id) => { const f = r.focus[id]; if (byId[id] && f && CC.SKILLS.some((s) => s.k === f.skill)) clean.focus[id] = { skill: f.skill, why: String(f.why || '') }; });
      Store.change((s) => { s.games[g.id].ai = { ...(s.games[g.id].ai || {}), review: clean }; }, [g.id]);
      setSt({ phase: 'idle' });
    } catch (e) { setSt({ phase: 'error', msg: AI.message(e) }); }
  }
  return html`<div class="panel ai-review">
    <div class="panel-head"><h2><span class="ai-badge"><${Icon} name="spark" /> Claude</span> Coach's report</h2>
      ${st.phase !== 'thinking' && aiOk !== false ? html`<button class="btn ai" onClick=${run}>${saved ? 'Write a new report' : 'Write the report'}</button>` : null}</div>
    ${aiOk === false ? html`<p class="muted">Claude isn't available on this page right now. The numbers above still tell the story.</p>` : null}
    ${st.phase === 'thinking' ? html`<div class="thinking"><span class="dots"><i></i><i></i><i></i></span> Claude is reviewing every shift and stat.<button class="btn" onClick=${() => ctl.current && ctl.current.abort()}>Stop</button></div>` : null}
    ${st.phase === 'error' ? html`<p class="error">${st.msg}</p>` : null}
    ${saved && st.phase !== 'thinking' ? html`<div class="report">
      <h3 class="display">${saved.headline}</h3>
      <p>${saved.recap}</p>
      <div class="kid-read"><span class="eyebrow">Read to the team</span><p>${saved.kidRecap}</p></div>
      <div class="two-col"><div><h4>What worked</h4><ul>${saved.worked.map((x) => html`<li>${x}</li>`)}</ul></div><div><h4>Try next game</h4><ul>${saved.change.map((x) => html`<li>${x}</li>`)}</ul></div></div>
      ${Object.keys(saved.shoutouts).length ? html`<h4>Shout-outs</h4><ul class="shout-list">${Object.entries(saved.shoutouts).map(([id, t]) => html`<li><${Avatar} p=${byId[id]} size=${28} /><span><b>${byId[id].name}:</b> ${t}</span></li>`)}</ul>` : null}
      ${saved.practice.length ? html`<h4>Practice this week</h4><ol class="drills">${saved.practice.map((d) => html`<li><b>${d.drill}</b> <span class="muted">${d.minutes} min</span><br /><span class="small">${d.why}</span></li>`)}</ol>` : null}
    </div>` : null}
    ${!saved && st.phase === 'idle' && aiOk !== false ? html`<p class="muted small">Claude reads every shift and stat, then writes a recap, what to change, a shout-out for each kid and a practice plan.</p>` : null}
  </div>`;
}

function ReviewTab({ gameId, setGameId }) {
  const s = useStore();
  const [scope, setScope] = useState('game');
  const tracked = (g) => g.status !== 'plan' || (g.events || []).length;
  const g = s.games[gameId] && tracked(s.games[gameId]) ? s.games[gameId] : sortedGames().find(tracked);
  const season = useMemo(() => CC.analyzeSeason(Object.values(s.games)), [s.games]);
  const byId = rosterById();
  if (!g) return html`<section class="tab-page"><h1 class="display">Review</h1><div class="empty">Track a game on Game day and the review shows up here.</div></section>`;
  const A = CC.analyzeGame(g.status === 'final' ? g : { ...g, status: 'live' });
  const result = A.us > A.them ? 'Win' : A.us < A.them ? 'Loss' : 'Tie';
  const L = scope === 'game' ? A.lineups.map((x) => ({ ...x, n: x.shifts.length })) : season.lineups.map((x) => ({ ...x, n: x.shifts }));
  const lineups = L.slice().sort((a, b) => b.pm / b.n - a.pm / a.n || b.n - a.n);
  const P = scope === 'game' ? A.players : season.players;
  const pairsSrc = scope === 'game' ? A.pairs : season.pairs;
  const minPair = scope === 'game' ? 2 : 3;
  const pairs = pairsSrc.filter((x) => x.shifts >= minPair).sort((a, b) => b.pm / b.shifts - a.pm / a.shifts);
  const ids = Object.keys(P).filter((id) => byId[id]).sort((a, b) => (P[b].pts + P[b].reb + P[b].stl + P[b].ast) - (P[a].pts + P[a].reb + P[a].stl + P[a].ast));
  const cols = [['shifts', 'Shifts'], ['pts', 'Pts'], ['fg', 'FG'], ['reb', 'Reb'], ['stl', 'Stl'], ['ast', 'Ast'], ['hus', 'Hustle'], ['to', 'TO'], ['pm', '+/-']];
  const maxOf = {}; cols.forEach(([k]) => { maxOf[k] = Math.max(1, ...ids.map((id) => P[id][k] || 0)); });
  const fair = CC.shiftCounts(g, (g.present || []).filter((id) => byId[id]), true);
  const fv = Object.values(fair);
  return html`<section class="tab-page">
    <div class="page-head"><div><h1 class="display">${scope === 'game' ? 'vs ' + g.opponent : 'Season review'}</h1><p class="muted">${scope === 'game' ? fmtDate(g.date) + (g.status === 'final' ? '' : ' · in progress') : season.games.length + ' tracked games · ' + season.record.w + '-' + season.record.l + (season.record.t ? '-' + season.record.t : '')}</p></div>
      <div class="row gap wrap"><div class="seg two"><button class=${'seg-btn' + (scope === 'game' ? ' on' : '')} onClick=${() => setScope('game')}>This game</button><button class=${'seg-btn' + (scope === 'season' ? ' on' : '')} onClick=${() => setScope('season')}>Season</button></div>
      ${scope === 'game' ? html`<${GamePicker} gameId=${g.id} setGameId=${setGameId} filter=${tracked} />` : null}</div></div>
    ${scope === 'game' ? html`<div class="summary-strip">
      <div class=${'result ' + result.toLowerCase()}><span class="display big">${A.us}–${A.them}</span><span>${result}</span></div>
      <div class="quarters">${A.byQuarter.map((q, i) => html`<div class="qbox"><span class="muted small">${(g.quarters || 4) === 2 ? 'H' : 'Q'}${i + 1}</span><b>${q.us}–${q.them}</b></div>`)}</div>
      <div class=${'fair-mini ' + (fv.length && Math.max(...fv) - Math.min(...fv) <= 1 ? 'good' : 'warn')}><span class="muted small">Playing time</span><b>${fv.length ? (Math.min(...fv) === Math.max(...fv) ? fv[0] + ' shifts each' : Math.min(...fv) + '–' + Math.max(...fv) + ' shifts') : '–'}</b></div>
    </div>
    <div class="panel"><${ShiftChart} g=${g} A=${A} /></div>` : null}
    <div class="review-grid">
      <div class="panel">
        <h2>Which groups worked</h2>
        <p class="small muted">Score while each exact group of ${onCourtOf(g)} was on the court. ${scope === 'game' ? 'One shift is a hint, not proof.' : 'Groups with more shifts are more reliable.'}</p>
        <table class="data"><thead><tr><th>Group</th><th class="num">Shifts</th><th class="num">Score</th><th class="num">+/-</th></tr></thead>
          <tbody>${lineups.slice(0, 8).map((x, i) => html`<tr class=${i === 0 && x.pm > 0 ? 'best' : ''}><td><${Faces} ids=${x.ids} /></td><td class="num">${x.n}</td><td class="num">${x.us}–${x.them}</td><td class=${'num ' + (x.pm > 0 ? 'pos' : x.pm < 0 ? 'neg' : '')}>${signed(x.pm)}</td></tr>`)}</tbody></table>
      </div>
      <div class="panel">
        <h2>Pairs that click</h2>
        <p class="small muted">Two kids on the court together for ${minPair}+ shifts. Use this to build groups, not to bench anyone.</p>
        ${pairs.length ? html`<div class="pairs">
          <div><span class="eyebrow good-text">Best together</span>${pairs.slice(0, 3).map((x) => html`<div class="pair-row"><${Faces} ids=${x.ids} size=${28} /><span class="grow">${byId[x.ids[0]] ? byId[x.ids[0]].name : ''} + ${byId[x.ids[1]] ? byId[x.ids[1]].name : ''}</span><span class="pos num">${signed(x.pm)}</span><span class="muted small">${x.shifts} sh</span></div>`)}</div>
          ${pairs.slice(-3).some((x) => x.pm < 0) ? html`<div><span class="eyebrow warn-text">Not clicking yet</span>${pairs.slice(-3).reverse().filter((x) => x.pm < 0).map((x) => html`<div class="pair-row"><${Faces} ids=${x.ids} size=${28} /><span class="grow">${byId[x.ids[0]] ? byId[x.ids[0]].name : ''} + ${byId[x.ids[1]] ? byId[x.ids[1]].name : ''}</span><span class="neg num">${signed(x.pm)}</span><span class="muted small">${x.shifts} sh</span></div>`)}</div>` : null}
        </div>` : html`<p class="muted">Not enough shared shifts yet.</p>`}
      </div>
    </div>
    <div class="panel">
      <h2>Player stats</h2>
      <div class="table-scroll"><table class="data players"><thead><tr><th>Player</th>${cols.map(([, l]) => html`<th class="num">${l}</th>`)}</tr></thead>
        <tbody>${ids.map((id) => { const l = P[id]; return html`<tr><td class="who"><${Avatar} p=${byId[id]} size=${26} /> ${byId[id].name}</td>${cols.map(([k]) => {
          const v = k === 'fg' ? l.fgm + '/' + l.fga : k === 'pm' ? signed(l.pm) : l[k];
          const heat = k === 'fg' || k === 'pm' || k === 'to' || k === 'shifts' ? 0 : (l[k] || 0) / maxOf[k];
          return html`<td class=${'num' + (k === 'pm' ? (l.pm > 0 ? ' pos' : l.pm < 0 ? ' neg' : '') : '') + (k === 'to' ? ' muted' : '')} style=${heat ? `--heat:${(heat * 38).toFixed(0)}%` : ''}>${v}</td>`;
        })}</tr>`; })}</tbody></table></div>
      ${scope === 'game' && A.teamUnassigned ? html`<p class="small muted">${A.teamUnassigned} team points weren't credited to a player.</p>` : null}
    </div>
    <${PlaysReview} games=${scope === 'game' ? [g] : season.games} title=${scope === 'game' ? 'Plays this game' : 'Which plays work'} />
    ${scope === 'game' ? html`<${AIReview} g=${g} A=${A} season=${season} />` : null}
    ${scope === 'game' ? html`<${ParentRecap} g=${g} A=${A} season=${season} />` : null}
  </section>`;
}
