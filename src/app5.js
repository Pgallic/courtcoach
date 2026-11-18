/* ---------- Grow: development, positions, practice ---------- */
function heatClass(v) { return 'lv' + Math.round(v); }

function aiPracticePrompt(roster, season, tf, minutes) {
  const rows = roster.map((p) => {
    const l = season.players[p.id]; const f = CC.practiceFocus(p, l);
    return `${p.name} | ratings ${CC.SKILLS.map((s) => CC.rating(p, s.k)).join(',')} | focus: ${f}${l && l.games ? ` | per game: pts ${(l.pts / l.games).toFixed(1)}, reb ${(l.reb / l.games).toFixed(1)}, to ${(l.to / l.games).toFixed(1)}` : ''}`;
  });
  return `You are a youth basketball skills coach. Write a ${minutes}-minute practice plan for a 3rd-4th grade team (ages 8-10) with one volunteer coach and maybe a parent helper, one basket area or a half court, and about ${roster.length} kids.

Team skill averages (1-4): ${CC.SKILLS.map((s) => s.name + ' ' + tf.avg[s.k].toFixed(1)).join(', ')}.
Biggest team needs: ${tf.order.slice(0, 3).join(', ')}.
Kids (ratings in order dribbling, passing, shooting, defense, rebounding, spacing, hustle, confidence):
${rows.join('\n')}

Rules: keep kids moving (no long lines), short instructions, games and competitions over lectures, end with something fun. Split into groups when it helps, and name which kids go in which group by need.

Reply with only JSON:
{"title":"short name for this practice","goal":"one sentence","blocks":[{"minutes":8,"name":"drill name","how":"2-3 sentences a parent could run","coachCue":"one phrase to repeat","groups":"optional: who goes where"}],"homework":"one fun thing kids can practice at home"}`;
}

function GrowTab({ openPlayer }) {
  const s = useStore();
  const roster = s.team.roster;
  const season = useMemo(() => CC.analyzeSeason(Object.values(s.games)), [s.games]);
  const tf = CC.teamFocus(roster, season);
  const aiOk = useAIAvailable();
  const [st, setSt] = useState({ phase: 'idle' });
  const [mins, setMins] = useState(60);
  const ctl = useRef(null);
  const plan = s.team.ai && s.team.ai.practice;
  const ROLE_GROUPS = [['handler', 'Ball Handler'], ['wing', 'Wing'], ['post', 'Post'], ['top', 'Top Defender'], ['wingd', 'Wing Defender'], ['middle', 'Paint Protector']];
  async function run() {
    const sample = await AI.get();
    if (!sample) { setSt({ phase: 'error', msg: AI.message({ code: 'not_granted' }) }); return; }
    ctl.current = new AbortController(); setSt({ phase: 'thinking' });
    try {
      const r = await sample.json(aiPracticePrompt(roster, season, tf, mins), { signal: ctl.current.signal, cache: false });
      const clean = { title: String(r.title || 'Practice plan'), goal: String(r.goal || ''), homework: String(r.homework || ''), minutes: mins, at: Date.now(),
        blocks: (Array.isArray(r.blocks) ? r.blocks : []).slice(0, 10).map((b) => ({ minutes: +b.minutes || 5, name: String(b.name || ''), how: String(b.how || ''), coachCue: String(b.coachCue || ''), groups: b.groups ? String(b.groups) : '' })) };
      Store.change((x) => { x.team.ai = { ...(x.team.ai || {}), practice: clean }; }, ['team']);
      setSt({ phase: 'idle' });
    } catch (e) { setSt({ phase: 'error', msg: AI.message(e) }); }
  }
  const unrated = roster.filter((p) => !CC.isEvaluated(p));
  return html`<section class="tab-page">
    <div class="page-head"><div><h1 class="display">Grow</h1><p class="muted">Who fits where, what each kid should work on, and what to run at practice.</p></div></div>
    ${unrated.length ? html`<div class="callout">Rate ${unrated.map((p) => p.name).join(', ')} on the Team tab so they show up correctly here.</div>` : null}
    <div class="panel">
      <h2>Skills at a glance</h2>
      <div class="table-scroll"><table class="heat">
        <thead><tr><th></th>${CC.SKILLS.map((sk) => html`<th title=${sk.name}>${sk.short}</th>`)}<th>Best spot</th><th>Growth</th></tr></thead>
        <tbody>${roster.map((p) => {
          const br = CC.bestRoles(p); const first = CC.firstEval(p), last = CC.latestEval(p);
          const growth = first && last && first !== last ? CC.SKILLS.reduce((t, sk) => t + (last.r[sk.k] - first.r[sk.k]), 0) : 0;
          return html`<tr><th><button class="who link-btn" onClick=${() => openPlayer(p.id)}><${Avatar} p=${p} size=${26} /> ${p.name}</button></th>
            ${CC.SKILLS.map((sk) => { const v = CC.rating(p, sk.k); return html`<td class=${'hc ' + (CC.isEvaluated(p) ? heatClass(v) : 'none')} title=${sk.name + ': ' + CC.LEVELS[v - 1]}>${CC.isEvaluated(p) ? v : '·'}</td>`; })}
            <td class="small">${CC.isEvaluated(p) ? CC.ROLES[br.off[0].r].name + ' / ' + CC.ROLES[br.def[0].r].name : '–'}</td>
            <td class=${'small ' + (growth > 0 ? 'pos' : '')}>${growth > 0 ? '▲ ' + growth + (growth === 1 ? ' level' : ' levels') : last ? (first === last ? 'first rating' : 'steady') : ''}</td></tr>`;
        })}</tbody>
        <tfoot><tr><th class="small muted">Team</th>${CC.SKILLS.map((sk) => html`<td class=${'hc ' + heatClass(tf.avg[sk.k])}><b>${tf.avg[sk.k].toFixed(1)}</b></td>`)}<td></td><td></td></tr></tfoot>
      </table></div>
      <p class="small muted legend"><span class="hc lv1">1</span> Learning <span class="hc lv2">2</span> Getting it <span class="hc lv3">3</span> Solid <span class="hc lv4">4</span> Leader</p>
    </div>
    <div class="panel">
      <h2>Who fits each spot</h2>
      <p class="small muted">Ranked by the skills each role needs. At this age, rotate kids through spots in practice so everyone learns them.</p>
      <div class="role-grid">${ROLE_GROUPS.map(([r, name]) => {
        const ranked = roster.filter(CC.isEvaluated).map((p) => ({ p, f: CC.fit(p, r) })).sort((a, b) => b.f - a.f).slice(0, 4);
        return html`<div class=${'role-card ' + CC.ROLES[r].side}><h3>${name}</h3><p class="small muted">${Object.keys(CC.ROLES[r].w).map((k) => CC.SKILLS.find((x) => x.k === k).short).join(' · ')}</p>
          <ol>${ranked.map((x) => html`<li><${Avatar} p=${x.p} size=${24} /><span class="grow">${x.p.name}</span><${SkillBar} value=${x.f} /></li>`)}</ol></div>`;
      })}</div>
    </div>
    <div class="grow-grid">
      <div class="panel">
        <h2>Team focus</h2>
        <p class="small muted">The skills holding the team back most, from ratings plus game stats.</p>
        ${tf.order.slice(0, 3).map((k, i) => html`<div class="focus-card"><span class="focus-rank">${i + 1}</span><div><b>${CC.SKILLS.find((x) => x.k === k).name}</b> <span class="muted small">team avg ${tf.avg[k].toFixed(1)}</span><p class="small"><i>${CC.DRILLS[k].name}.</i> ${CC.DRILLS[k].how}</p></div></div>`)}
      </div>
      <div class="panel">
        <h2>Each kid's mission</h2>
        <ul class="mission-list">${roster.filter(CC.isEvaluated).map((p) => { const f = CC.practiceFocus(p, season.players[p.id]); return html`<li><${Avatar} p=${p} size=${28} /><span class="grow"><b>${p.name}</b> <span class="small muted">${CC.SKILLS.find((x) => x.k === f).name}</span><br /><span class="small">"${CC.MISSION[f]}"</span></span></li>`; })}</ul>
      </div>
    </div>
    <${ChallengesPanel} />
    <div class="panel ai-review">
      <div class="panel-head"><h2><span class="ai-badge"><${Icon} name="spark" /> Claude</span> Practice plan</h2>
        ${aiOk !== false && st.phase !== 'thinking' ? html`<div class="row gap"><label class="field compact"><span class="sr">Length</span><select id="prac-min" value=${mins} onChange=${(e) => setMins(+e.target.value)}>${[45, 60, 75, 90].map((m) => html`<option value=${m}>${m} min</option>`)}</select></label><button class="btn ai" onClick=${run}>${plan ? 'New plan' : 'Build a practice plan'}</button></div>` : null}</div>
      ${aiOk === false ? html`<p class="muted">Claude isn't available on this page right now. The team focus drills above are a good start.</p>` : null}
      ${st.phase === 'thinking' ? html`<div class="thinking"><span class="dots"><i></i><i></i><i></i></span> Claude is building drills around your team's needs.<button class="btn" onClick=${() => ctl.current && ctl.current.abort()}>Stop</button></div>` : null}
      ${st.phase === 'error' ? html`<p class="error">${st.msg}</p>` : null}
      ${plan && st.phase !== 'thinking' ? html`<div class="report"><h3 class="display">${plan.title}</h3><p>${plan.goal}</p>
        <ol class="practice">${plan.blocks.map((b) => html`<li><span class="pr-min">${b.minutes}'</span><div><b>${b.name}</b><p class="small">${b.how}</p>${b.coachCue ? html`<p class="small"><span class="eyebrow">Say</span> "${b.coachCue}"</p>` : null}${b.groups ? html`<p class="small muted">${b.groups}</p>` : null}</div></li>`)}</ol>
        ${plan.homework ? html`<p class="kid-read"><span class="eyebrow">Home challenge</span> ${plan.homework}</p>` : null}</div>` : null}
      ${!plan && st.phase === 'idle' && aiOk !== false ? html`<p class="muted small">Claude builds a plan around your team's weakest skills and splits kids into groups by need.</p>` : null}
    </div>
  </section>`;
}

/* ---------- Huddle: big court for the kids ---------- */
function Huddle({ gameId, startShift, onClose }) {
  const s = useStore();
  const g = s.games[gameId];
  const [shift, setShift] = useState(startShift || 0);
  const [side, setSide] = useState('off');
  const ref = useRef(null);
  if (!g) return null;
  const N = CC.nShifts(g);
  const positions = CC.positionsFor(g, shift, side, s.team.roster);
  function full() { try { const el = ref.current; (el.requestFullscreen || el.webkitRequestFullscreen).call(el).catch(() => {}); } catch (e) { /* not allowed here */ } }
  return html`<div class="huddle" ref=${ref} role="dialog" aria-label="Show the team">
    <div class="huddle-bar">
      <button class="hb-btn" onClick=${() => setShift(Math.max(0, shift - 1))} disabled=${shift === 0} aria-label="Previous"><${Icon} name="back" size=${28} /></button>
      <div class="huddle-title"><span class="display">${CC.shiftLabel(g, shift, true)}</span><span class=${'huddle-side ' + side}>${side === 'off' ? 'Offense' : 'Defense'}</span></div>
      <button class="hb-btn" onClick=${() => setShift(Math.min(N - 1, shift + 1))} disabled=${shift >= N - 1} aria-label="Next"><${Icon} name="next" size=${28} /></button>
    </div>
    <div class="huddle-court"><${Court} positions=${positions} roster=${s.team.roster} side=${side} big=${true} tips=${g.tips} /></div>
    <div class="huddle-foot">
      <div class="seg two big"><button class=${'seg-btn' + (side === 'off' ? ' on off' : '')} onClick=${() => setSide('off')}>Offense</button><button class=${'seg-btn' + (side === 'def' ? ' on def' : '')} onClick=${() => setSide('def')}>Defense</button></div>
      ${g.shifts[shift] && g.shifts[shift].note ? html`<p class="huddle-note">${g.shifts[shift].note}</p>` : null}
      <div class="row gap"><button class="btn" onClick=${full}><${Icon} name="full" /> Full screen</button><button class="btn primary" onClick=${onClose}>Done</button></div>
    </div>
  </div>`;
}

/* ---------- Player card for kids and parents ---------- */
function PlayerCard({ id, onClose }) {
  const s = useStore();
  const p = s.team.roster.find((x) => x.id === id);
  const season = useMemo(() => CC.analyzeSeason(Object.values(s.games)), [s.games]);
  const [copied, setCopied] = useState(false);
  if (!p) return null;
  const line = season.players[p.id];
  const badges = CC.badgesFor(line);
  const homeN = CCP.challengeCount(s.team, p.id);
  if (homeN >= 3) badges.push({ k: 'home', name: 'Home Hero', desc: 'Finished 3+ home challenges', n: Math.floor(homeN / 3) });
  const top = CC.topSkill(p), focus = CC.practiceFocus(p, line);
  const last = CC.latestEval(p), first = CC.firstEval(p);
  const grew = last && first && first !== last ? CC.SKILLS.filter((sk) => last.r[sk.k] > first.r[sk.k]).map((sk) => sk.name) : [];
  const lastReview = sortedGames().find((g) => g.ai && g.ai.review && g.ai.review.shoutouts && g.ai.review.shoutouts[id]);
  const shout = lastReview ? lastReview.ai.review.shoutouts[id] : '';
  const text = `${p.name} (#${p.number}) · ${s.team.name}\nSuperpower: ${CC.SUPERPOWER[top]}\n` + (line ? `This season: ${line.pts} points, ${line.reb} rebounds, ${line.stl} steals, ${line.ast} assists, ${line.hus} hustle plays\n` : '') +
    (grew.length ? `Getting better at: ${grew.join(', ')}\n` : '') + (badges.length ? `Badges: ${badges.map((b) => b.name + (b.n > 1 ? ' x' + b.n : '')).join(', ')}\n` : '') + (homeN ? `Home challenges done: ${homeN}\n` : '') + `Mission this week: ${CC.MISSION[focus]}` + (shout ? `\nCoach says: ${shout}` : '');
  async function copy() { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (e) { setCopied('fail'); } }
  return html`<${Dialog} open=${true} onClose=${onClose} title="Player card">
    <div class="tcard">
      <div class="tcard-top"><span class="tcard-num display">${p.number}</span><${Avatar} p=${p} size=${120} /><span class="tcard-team">${s.team.name}</span></div>
      <h2 class="tcard-name display">${p.name}</h2>
      <div class="tcard-power"><span class="eyebrow">Superpower</span><b>${CC.SUPERPOWER[top]}</b></div>
      ${line ? html`<div class="tcard-stats">${[['Points', line.pts], ['Rebounds', line.reb], ['Steals', line.stl], ['Assists', line.ast], ['Hustle', line.hus]].map(([l, v]) => html`<div><b class="display">${v}</b><span>${l}</span></div>`)}</div>` : null}
      ${grew.length ? html`<p class="tcard-grew">Getting better at <b>${grew.join(', ')}</b></p>` : null}
      ${homeN ? html`<p class="tcard-grew">Home challenges done: <b>${homeN}</b></p>` : null}
      ${badges.length ? html`<div class="badges">${badges.map((b) => html`<span class="badge" title=${b.desc}><${Icon} name="star" size=${14} /> ${b.name}${b.n > 1 ? html` <i>×${b.n}</i>` : null}</span>`)}</div>` : null}
      <div class="tcard-mission"><span class="eyebrow">This week's mission</span><b>${CC.MISSION[focus]}</b></div>
      ${shout ? html`<p class="tcard-shout">"${shout}"</p>` : null}
    </div>
    <div class="row gap end"><button class="btn" onClick=${copy}><${Icon} name="copy" /> ${copied === true ? 'Copied' : 'Copy for parents'}</button></div>
    ${copied === 'fail' ? html`<textarea class="copy-fallback" rows="6" readonly value=${text}></textarea>` : null}
  </${Dialog}>`;
}

/* ---------- Printable game plan (US Letter, drawn as vectors) ---------- */
let jsPDFLoading = null;
function loadJsPDF() {
  if (window.jspdf) return Promise.resolve(window.jspdf.jsPDF);
  if (!jsPDFLoading) jsPDFLoading = new Promise((res, rej) => {
    const sc = document.createElement('script'); sc.src = JSPDF_SRC; sc.onload = () => res(window.jspdf.jsPDF); sc.onerror = () => rej(new Error("Couldn't load the PDF maker. Check your connection."));
    document.head.appendChild(sc);
  });
  return jsPDFLoading;
}
function avatarJPEG(id) {
  return new Promise((res) => {
    const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 96, 96); x.drawImage(img, 0, 0, 96, 96); res(c.toDataURL('image/jpeg', 0.85)); };
    img.onerror = () => res(null); img.src = AVATARS[id] || AVATARS['girl-1'];
  });
}
async function exportPlanPDF(g) {
  const dl = window.claude ? await window.claude.use('downloads').catch(() => null) : null;
  if (!dl) throw new Error('Downloads are not available in this view. Open the page on claude.ai to print.');
  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({ unit: 'pt', format: 'letter' });
  const W = 612, H = 792, M = 36;
  const byId = rosterById();
  const present = (g.present || []).filter((id) => byId[id]);
  const imgs = {}; for (const id of present) imgs[id] = await avatarJPEG(byId[id].avatarId);
  const N = CC.nShifts(g), spq = g.spq || 2;
  const ink = [17, 28, 51], orange = [236, 106, 30], blue = [44, 103, 214], grey = [110, 120, 140];
  function header(sub) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...ink); doc.text(Store.s.team.name + ' vs ' + g.opponent, M, M + 14);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...grey); doc.text(fmtDate(g.date) + (sub ? '  ·  ' + sub : ''), M, M + 32);
  }
  // Page 1: rotation overview
  header('Rotation');
  const top = M + 56, nameW = 130, cw = Math.min(46, (W - 2 * M - nameW - 50) / N), rh = 24;
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...ink);
  for (let i = 0; i < N; i++) doc.text(CC.shiftLabel(g, i), M + nameW + i * cw + cw / 2, top, { align: 'center' });
  doc.text('Shifts', M + nameW + N * cw + 22, top, { align: 'center' });
  const counts = CC.shiftCounts(g, present, false);
  present.forEach((id, r) => {
    const y = top + 12 + r * rh;
    if (r % 2 === 0) { doc.setFillColor(243, 245, 248); doc.rect(M, y, nameW + N * cw + 44, rh, 'F'); }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...ink);
    doc.text('#' + byId[id].number + '  ' + byId[id].name, M + 6, y + 16);
    for (let i = 0; i < N; i++) {
      const cx = M + nameW + i * cw + cw / 2;
      if (i % spq === 0) { doc.setDrawColor(200, 206, 216); doc.line(M + nameW + i * cw, y, M + nameW + i * cw, y + rh); }
      if ((g.shifts[i].lineup || []).includes(id)) { doc.setFillColor(...ink); doc.circle(cx, y + rh / 2, 6, 'F'); }
    }
    doc.setFont('helvetica', 'normal'); doc.text(String(counts[id]), M + nameW + N * cw + 22, y + 16, { align: 'center' });
  });
  let y1 = top + 24 + present.length * rh;
  doc.setFontSize(10); doc.setTextColor(...grey);
  doc.text('A dot means the player is on the court for that shift. Positions for each shift are on the next pages.', M, y1);
  if (g.ai && g.ai.plan && g.ai.plan.summary) { y1 += 18; doc.setTextColor(...ink); doc.text(doc.splitTextToSize('Plan: ' + g.ai.plan.summary, W - 2 * M), M, y1); }
  // Court drawer
  function court(x, y, w, side, shiftIdx, title) {
    const h = w * 0.94; const sx = w / 500, sy = h / 470;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...(side === 'off' ? orange : blue)); doc.text(title, x, y - 6);
    doc.setDrawColor(...ink); doc.setLineWidth(1.2); doc.setFillColor(250, 246, 238); doc.rect(x, y, w, h, 'FD');
    doc.setFillColor(238, 230, 214); doc.rect(x + 190 * sx, y + 280 * sy, 120 * sx, 190 * sy, 'FD');
    doc.setLineWidth(0.8);
    doc.ellipse(x + 250 * sx, y + 280 * sy, 60 * sx, 60 * sy, 'S');
    { let px = null; for (let a = 0; a <= 180; a += 10) { const r = (a * Math.PI) / 180; const pt = [x + (250 + 60 * Math.cos(r)) * sx, y + 60 * Math.sin(r) * sy]; if (px) doc.line(px[0], px[1], pt[0], pt[1]); px = pt; } }
    // 3pt line as polyline
    const pts = []; for (let a = 180; a <= 360; a += 6) { const r = (a * Math.PI) / 180; pts.push([250 + 197.5 * Math.cos(r), 417.5 + 197.5 * Math.sin(r)]); }
    doc.line(x + 52.5 * sx, y + h, x + 52.5 * sx, y + 417.5 * sy); doc.line(x + 447.5 * sx, y + h, x + 447.5 * sx, y + 417.5 * sy);
    for (let i = 1; i < pts.length; i++) doc.line(x + pts[i - 1][0] * sx, y + pts[i - 1][1] * sy, x + pts[i][0] * sx, y + pts[i][1] * sy);
    doc.circle(x + 250 * sx, y + 417.5 * sy, 7 * sx, 'S'); doc.line(x + 220 * sx, y + 430 * sy, x + 280 * sx, y + 430 * sy);
    const pos = CC.positionsFor(g, shiftIdx, side, Store.s.team.roster);
    const R = Math.max(12, w * 0.055);
    Object.entries(pos).forEach(([id, ps]) => {
      const p = byId[id]; if (!p) return;
      const cx = x + (ps.x / 100) * w, cy = y + (ps.y / 100) * h;
      if (imgs[id]) {
        doc.saveGraphicsState(); doc.circle(cx, cy, R, null); doc.clip(); doc.discardPath();
        doc.addImage(imgs[id], 'JPEG', cx - R, cy - R, R * 2, R * 2, 'av-' + id); doc.restoreGraphicsState();
      }
      doc.setDrawColor(255, 255, 255); doc.setLineWidth(1.5); doc.circle(cx, cy, R, 'S');
      doc.setFillColor(...(side === 'off' ? orange : blue)); doc.circle(cx + R * 0.72, cy + R * 0.72, R * 0.42, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(Math.max(6, R * 0.5));
      doc.text(String(p.number), cx + R * 0.72, cy + R * 0.72, { align: 'center', baseline: 'middle' });
      doc.setFontSize(Math.max(7, R * 0.62)); const nm = p.name; const tw = doc.getTextWidth(nm) + 6;
      doc.setFillColor(255, 255, 255); doc.setDrawColor(200, 206, 216); doc.setLineWidth(0.5); doc.roundedRect(cx - tw / 2, cy + R + 2, tw, R * 0.8, 2, 2, 'FD');
      doc.setTextColor(...ink); doc.text(nm, cx, cy + R + 2 + R * 0.4, { align: 'center', baseline: 'middle' });
    });
    return h;
  }
  // One page per period: each shift gets offense + defense side by side
  const periods = g.quarters || 4;
  for (let q = 0; q < periods; q++) {
    const idxs = []; for (let j = 0; j < spq; j++) idxs.push(q * spq + j);
    if (!idxs.some((i) => (g.shifts[i].lineup || []).length)) continue;
    doc.addPage(); header(((g.quarters || 4) === 2 ? 'Half ' : 'Quarter ') + (q + 1));
    const cwid = (W - 2 * M - 18) / 2;
    const chH = cwid * 0.94;
    const rowsPerPage = spq <= 2 ? 2 : 3;
    const scale = spq <= 2 ? 1 : 0.68;
    let y = M + 68;
    idxs.forEach((i, k) => {
      if (k && k % rowsPerPage === 0) { doc.addPage(); header(((g.quarters || 4) === 2 ? 'Half ' : 'Quarter ') + (q + 1) + ' (cont.)'); y = M + 68; }
      const w = cwid * scale;
      const label = CC.shiftLabel(g, i, true);
      court(M, y, w, 'off', i, label + ' · Offense (' + CC.FORMATIONS.off[g.offForm].name + ')');
      court(M + w + 18, y, w, 'def', i, label + ' · Defense (' + CC.FORMATIONS.def[g.defForm].name + ')');
      let ty = y + w * 0.94 + 22;
      const lines = [];
      if (g.shifts[i].note) lines.push('Note: ' + g.shifts[i].note);
      CC.lineupOf(g, i).forEach((id) => { if ((g.tips || {})[id] && byId[id]) lines.push(byId[id].name + ': ' + g.tips[id]); });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...ink);
      if (lines.length) { const t = doc.splitTextToSize(lines.join('   ·   '), W - 2 * M); doc.text(t, M, ty); ty += t.length * 12; }
      y = ty + 26;
    });
  }
  doc.setProperties({ title: Store.s.team.name + ' vs ' + g.opponent });
  const blob = doc.output('blob');
  try { await dl.save({ filename: 'CourtCoach-vs-' + g.opponent.replace(/[^A-Za-z0-9]+/g, '-') + '.pdf', data: blob }); }
  catch (e) { if (e && e.code === 'declined') return; throw new Error("Couldn't save the PDF here."); }
}
