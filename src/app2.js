/* ---------- Team tab: roster, evaluations, player sheet ---------- */
const AVATAR_IDS = ['girl-1', 'girl-2', 'girl-3', 'girl-4', 'girl-5', 'boy-1', 'boy-2', 'boy-3', 'boy-4', 'boy-5'];

function AvatarPicker({ value, onChange }) {
  return html`<div class="avatar-pick" role="radiogroup" aria-label="Avatar">
    ${AVATAR_IDS.map((a) => html`<button type="button" role="radio" aria-checked=${value === a} class=${'avatar-opt' + (value === a ? ' on' : '')} onClick=${() => onChange(a)}><img src=${AVATARS[a]} alt=${a.replace('-', ' ')} /></button>`)}
  </div>`;
}

function TeamTab({ openPlayer, openCard }) {
  const s = useStore();
  const [name, setName] = useState('');
  const [num, setNum] = useState('');
  const [av, setAv] = useState('girl-1');
  const [showImport, setShowImport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const season = useMemo(() => CC.analyzeSeason(Object.values(s.games)), [s.games, s.team.updatedAt]);
  const roster = s.team.roster;
  const needsEval = roster.filter((p) => !CC.isEvaluated(p)).length;
  function add(e) {
    e.preventDefault();
    if (!name.trim()) return;
    Store.change((st) => { st.team.roster.push({ id: CC.uid(), name: name.trim(), number: num.trim() || '0', avatarId: av, evals: [] }); }, ['team']);
    setName(''); setNum('');
    toast(name.trim() + ' added. Tap their card to rate their skills.');
  }
  return html`<section class="tab-page">
    <div class="page-head">
      <div><h1 class="display">${s.team.name}</h1><p class="muted">${roster.length} players · ${s.team.season || 'This season'} · ${season.record.w}-${season.record.l}${season.record.t ? '-' + season.record.t : ''}</p></div>
      <div class="row gap">
        <button class="btn" onClick=${() => setShowImport(true)}>Import from old CourtCoach</button>
        <button class="btn" onClick=${() => setShowSettings(true)}>Team settings</button>
      </div>
    </div>
    ${needsEval ? html`<div class="callout"><strong>${needsEval} player${needsEval > 1 ? 's need' : ' needs'} a skills check.</strong> Ratings take about a minute per kid and power the lineup builder, positions and practice plans.</div>` : null}
    <div class="roster-grid">
      ${roster.map((p) => {
        const br = CC.bestRoles(p); const ev = CC.latestEval(p); const line = season.players[p.id];
        const top = CC.topSkill(p);
        return html`<article class="pcard" key=${p.id}>
          <button class="pcard-main" onClick=${() => openPlayer(p.id)} aria-label=${'Open ' + p.name}>
            <div class="pcard-top"><${Avatar} p=${p} size=${64} /><div class="pcard-id"><span class="pcard-num">#${p.number}</span><span class="pcard-name">${p.name}</span></div></div>
            ${ev ? html`<div class="pcard-roles"><${Chip} tone="off">${CC.ROLES[br.off[0].r].name}</${Chip}><${Chip} tone="def">${CC.ROLES[br.def[0].r].name}</${Chip}></div>
              <div class="pcard-meta"><span>Superpower: <b>${CC.SUPERPOWER[top]}</b></span>${line ? html`<span>${line.games} games · ${line.pts} pts · ${line.reb} reb</span>` : html`<span class="muted">No games yet</span>`}</div>`
            : html`<div class="pcard-meta"><span class="warn-text">Not rated yet. Tap to rate.</span></div>`}
          </button>
          <button class="link-btn" onClick=${() => openCard(p.id)}>Player card</button>
        </article>`;
      })}
      <form class="pcard add" onSubmit=${add}>
        <h3>Add a player</h3>
        <div class="row gap"><label class="field grow"><span>Name</span><input id="add-name" value=${name} onInput=${(e) => setName(e.target.value)} placeholder="e.g. Sarah" autocomplete="off" /></label>
        <label class="field w-num"><span>#</span><input id="add-num" value=${num} onInput=${(e) => setNum(e.target.value)} inputmode="numeric" maxlength="3" /></label></div>
        <${AvatarPicker} value=${av} onChange=${setAv} />
        <button class="btn primary" type="submit" disabled=${!name.trim()}><${Icon} name="plus" /> Add player</button>
      </form>
    </div>
    <${ImportDialog} open=${showImport} onClose=${() => setShowImport(false)} />
    <${SettingsDialog} open=${showSettings} onClose=${() => setShowSettings(false)} />
  </section>`;
}

function EvalForm({ player, onDone }) {
  const prev = CC.latestEval(player);
  const [r, setR] = useState(() => { const o = {}; CC.SKILLS.forEach((s) => { o[s.k] = prev ? prev.r[s.k] : 2; }); return o; });
  const [note, setNote] = useState('');
  function save() {
    Store.change((st) => {
      const p = st.team.roster.find((x) => x.id === player.id);
      p.evals = p.evals || [];
      const today = todayISO();
      const last = p.evals[p.evals.length - 1];
      const entry = { date: today, r: { ...r }, note: note.trim() };
      if (last && last.date === today) p.evals[p.evals.length - 1] = entry; else p.evals.push(entry);
    }, ['team']);
    toast('Skills saved for ' + player.name);
    onDone && onDone();
  }
  return html`<div class="evalform">
    <p class="muted small">Rate what you see in games and practice, not effort alone. 1 Learning · 2 Getting it · 3 Solid · 4 Leader.</p>
    ${CC.SKILLS.map((s) => html`<div class="eval-row" key=${s.k}>
      <div class="eval-label"><b>${s.name}</b><span class="muted small">${s.levels[r[s.k] - 1]}</span></div>
      <div class="seg" role="radiogroup" aria-label=${s.name}>
        ${[1, 2, 3, 4].map((v) => html`<button type="button" role="radio" aria-checked=${r[s.k] === v} class=${'seg-btn lv' + v + (r[s.k] === v ? ' on' : '')} onClick=${() => setR({ ...r, [s.k]: v })} title=${CC.LEVELS[v - 1] + ': ' + s.levels[v - 1]}>${v}</button>`)}
      </div>
    </div>`)}
    <label class="field"><span>Note (optional)</span><input id="eval-note" value=${note} onInput=${(e) => setNote(e.target.value)} placeholder="e.g. Much better left hand this week" /></label>
    <div class="row gap end"><button class="btn primary" onClick=${save}><${Icon} name="check" /> Save skills</button></div>
  </div>`;
}

function PlayerSheet({ id, onClose, openCard }) {
  const s = useStore();
  const p = s.team.roster.find((x) => x.id === id);
  const [mode, setMode] = useState('profile');
  const [ask, confirmEl] = useConfirm();
  const season = useMemo(() => CC.analyzeSeason(Object.values(s.games)), [s.games]);
  useEffect(() => { setMode(p && !CC.isEvaluated(p) ? 'eval' : 'profile'); }, [id]);
  if (!p) return null;
  const line = season.players[p.id];
  const br = CC.bestRoles(p);
  const focus = CC.practiceFocus(p, line);
  const first = CC.firstEval(p), last = CC.latestEval(p);
  function upd(field, val) { Store.change((st) => { st.team.roster.find((x) => x.id === id)[field] = val; }, ['team']); }
  return html`<${Dialog} open=${true} onClose=${onClose} title=${p.name} wide=${true}>
    <div class="sheet">
      <div class="sheet-head">
        <${Avatar} p=${p} size=${84} />
        <div class="grow">
          <div class="row gap wrap"><label class="field grow"><span>Name</span><input id="ps-name" value=${p.name} onChange=${(e) => upd('name', e.target.value.trim() || p.name)} /></label>
          <label class="field w-num"><span>#</span><input id="ps-num" value=${p.number} onChange=${(e) => upd('number', e.target.value.trim())} maxlength="3" /></label></div>
          <div class="tabs-mini" role="tablist">
            ${[['profile', 'Overview'], ['eval', last ? 'Update skills' : 'Rate skills'], ['look', 'Avatar']].map(([k, l]) => html`<button role="tab" aria-selected=${mode === k} class=${mode === k ? 'on' : ''} onClick=${() => setMode(k)}>${l}</button>`)}
          </div>
        </div>
      </div>
      ${mode === 'eval' ? html`<${EvalForm} player=${p} onDone=${() => setMode('profile')} />` : null}
      ${mode === 'look' ? html`<${AvatarPicker} value=${p.avatarId} onChange=${(a) => upd('avatarId', a)} />` : null}
      ${mode === 'profile' ? html`<div class="sheet-grid">
        <div class="panel">
          <h3>Skills ${last ? html`<span class="muted small">rated ${fmtDate(last.date)}</span>` : null}</h3>
          ${last ? CC.SKILLS.map((sk) => {
            const hist = (p.evals || []).map((e) => e.r[sk.k]);
            const delta = first && first !== last ? last.r[sk.k] - first.r[sk.k] : 0;
            return html`<div class="skill-line" key=${sk.k}><span class="skill-name">${sk.name}</span><${SkillBar} value=${last.r[sk.k]} /><span class="skill-lv">${CC.LEVELS[last.r[sk.k] - 1]}</span>${delta > 0 ? html`<span class="up">▲${delta}</span>` : html`<span class="up-none"></span>`}</div>`;
          }) : html`<p class="muted">No ratings yet. <button class="link-btn" onClick=${() => setMode('eval')}>Rate skills</button></p>`}
          ${last && last.note ? html`<p class="small muted">Note: ${last.note}</p>` : null}
        </div>
        <div class="panel">
          <h3>Where they fit best</h3>
          <div class="fit-list">
            <div class="fit-col"><span class="eyebrow off">Offense</span>${br.off.map((x, i) => html`<div class=${'fit-row' + (i === 0 ? ' best' : '')}><span>${CC.ROLES[x.r].name}</span><${SkillBar} value=${x.f} /></div>`)}</div>
            <div class="fit-col"><span class="eyebrow def">Defense</span>${br.def.map((x, i) => html`<div class=${'fit-row' + (i === 0 ? ' best' : '')}><span>${CC.ROLES[x.r].name}</span><${SkillBar} value=${x.f} /></div>`)}</div>
          </div>
          <p class="small">${CC.ROLES[br.off[0].r].tip}</p>
          <h3>Practice focus</h3>
          <p><b>${CC.SKILLS.find((x) => x.k === focus).name}.</b> Try <i>${CC.DRILLS[focus].name}</i>: ${CC.DRILLS[focus].how}</p>
          <p class="small muted">Kid version: "${CC.MISSION[focus]}"</p>
        </div>
        <div class="panel span2">
          <h3>Season</h3>
          ${line ? html`<div class="statstrip">
            ${[['Games', line.games], ['Shifts', line.shifts], ['Points', line.pts], ['Rebounds', line.reb], ['Steals', line.stl], ['Assists', line.ast], ['Hustle', line.hus], ['Turnovers', line.to], ['+/- per shift', line.shifts ? (line.pm / line.shifts).toFixed(1) : '–']].map(([l, v]) => html`<div class="stat"><span class="stat-v">${v}</span><span class="stat-l">${l}</span></div>`)}
          </div>` : html`<p class="muted">Stats show up after the first tracked game.</p>`}
        </div>
      </div>
      <div class="row gap between sheet-foot">
        <button class="btn danger-ghost" onClick=${() => ask('Remove ' + p.name + '?', 'They come off the roster. Past games keep their stats.', 'Remove', () => { Store.change((st) => { st.team.roster = st.team.roster.filter((x) => x.id !== id); }, ['team']); onClose(); }, true)}><${Icon} name="trash" /> Remove from roster</button>
        <button class="btn" onClick=${() => openCard(p.id)}><${Icon} name="star" /> Player card</button>
      </div>` : null}
    </div>
    ${confirmEl}
  </${Dialog}>`;
}

function ImportDialog({ open, onClose }) {
  const [txt, setTxt] = useState('');
  const [err, setErr] = useState('');
  function run() {
    setErr('');
    let data;
    try { data = JSON.parse(txt); } catch (e) { setErr("That isn't the text from the old app. Copy everything on the page, including the curly braces."); return; }
    const roster = Array.isArray(data) ? data : data.roster;
    if (!Array.isArray(roster) || !roster.length) { setErr('No players found in that text.'); return; }
    const have = new Set(Store.s.team.roster.map((p) => p.name.toLowerCase() + '#' + p.number));
    let added = 0;
    Store.change((st) => {
      if (st.example) { st.example = false; st.team.roster = []; st.games = {}; have.clear(); }
      roster.forEach((r) => {
        if (!r || !r.name) return;
        const key = String(r.name).toLowerCase() + '#' + (r.number || '');
        if (have.has(key)) return;
        st.team.roster.push({ id: r.id || CC.uid(), name: String(r.name), number: String(r.number || ''), avatarId: AVATARS[r.avatarId] ? r.avatarId : 'girl-1', evals: [] });
        added++;
      });
    }, ['team']);
    Sync.markDirty('team');
    toast(added + ' player' + (added === 1 ? '' : 's') + ' imported. Rate their skills next.');
    setTxt(''); onClose();
  }
  return html`<${Dialog} open=${open} onClose=${onClose} title="Import from old CourtCoach"
      footer=${html`<button class="btn" onClick=${onClose}>Cancel</button><button class="btn primary" onClick=${run} disabled=${!txt.trim()}>Import players</button>`}>
    <ol class="steps">
      <li>On a computer, log in at <b>kacourtcoach.com</b>.</li>
      <li>In the same browser, open <b>kacourtcoach.com/api/user-data</b>. You'll see a page of text.</li>
      <li>Select all of it, copy it, and paste it below.</li>
    </ol>
    <label class="field"><span>Pasted text</span><textarea id="import-txt" rows="6" value=${txt} onInput=${(e) => setTxt(e.target.value)} placeholder='{"roster":[{"name":"Harper","number":"1", ...'></textarea></label>
    ${err ? html`<p class="error">${err}</p>` : null}
    <p class="small muted">This brings over names, numbers and avatars. Old game plans stay on the old site.</p>
  </${Dialog}>`;
}

function SettingsDialog({ open, onClose }) {
  const s = useStore();
  const [ask, confirmEl] = useConfirm();
  const [dl, setDl] = useState(null);
  useEffect(() => { if (open && window.claude) window.claude.use('downloads').then(setDl).catch(() => setDl(null)); }, [open]);
  if (!open) return null;
  const st = s.team.settings || {};
  function set(k, v) { Store.change((x) => { x.team.settings = { ...(x.team.settings || {}), [k]: v }; }, ['team']); }
  async function backup() {
    try { await dl.save({ filename: 'courtcoach-backup-' + todayISO() + '.json', data: JSON.stringify({ team: s.team, games: s.games }, null, 1) }); }
    catch (e) { if (e && e.code !== 'declined') toast("Couldn't save the backup file here."); }
  }
  return html`<${Dialog} open=${open} onClose=${onClose} title="Team settings">
    <div class="form-grid">
      <label class="field"><span>Team name</span><input id="set-name" value=${s.team.name} onChange=${(e) => Store.change((x) => { x.team.name = e.target.value.trim() || 'My team'; }, ['team'])} /></label>
      <label class="field"><span>Season</span><input id="set-season" value=${s.team.season || ''} onChange=${(e) => Store.change((x) => { x.team.season = e.target.value.trim(); }, ['team'])} /></label>
      <label class="field"><span>Players on the court</span><select id="set-oncourt" value=${st.onCourt || 5} onChange=${(e) => set('onCourt', +e.target.value)}>${[3, 4, 5].map((n) => html`<option value=${n}>${n}</option>`)}</select></label>
      <label class="field"><span>Game is split into</span><select id="set-q" value=${st.quarters || 4} onChange=${(e) => set('quarters', +e.target.value)}><option value="4">4 quarters</option><option value="2">2 halves</option></select></label>
      <label class="field"><span>Line changes per period</span><select id="set-spq" value=${st.spq || 2} onChange=${(e) => set('spq', +e.target.value)}><option value="1">1 (no mid-period subs)</option><option value="2">2 (sub at the midpoint)</option><option value="3">3</option></select></label>
    </div>
    <p class="small muted">New games use these settings. Games you already planned keep theirs.</p>
    <div class="row gap wrap">
      ${dl ? html`<button class="btn" onClick=${backup}><${Icon} name="download" /> Download a backup</button>` : null}
      <button class="btn danger-ghost" onClick=${() => ask('Start a fresh team?', 'This clears the roster and every game on this account. It cannot be undone.', 'Clear everything', () => {
        const old = Object.keys(Store.s.games);
        Store.change((x) => { x.example = false; x.team = { name: 'My team', season: '', settings: x.team.settings, roster: [], updatedAt: Date.now() }; x.games = {}; }, ['team']);
        old.forEach((gid) => Sync.markDirty('del:' + gid));
        onClose();
      }, true)}>Clear team and games</button>
    </div>
    ${confirmEl}
  </${Dialog}>`;
}
