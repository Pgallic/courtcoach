/* ---------- CourtCoach app: store, sync, AI, shared components ---------- */
const { h, render } = preact;
const { useState, useEffect, useRef, useMemo } = preactHooks;
const html = htm.bind(h);
const LS_KEY = 'courtcoach.v2';

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function todayISO() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function fmtDate(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); }
function signed(n) { return n > 0 ? '+' + n : String(n); }
function lsGet() { try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { return null; } }
function lsSet(v) { try { localStorage.setItem(LS_KEY, JSON.stringify(v)); return true; } catch (e) { return false; } }

/* ---------- store ---------- */
const Store = {
  s: null, listeners: new Set(), ui: { toast: null },
  notify() { this.listeners.forEach((l) => l()); },
  init() {
    const saved = lsGet();
    if (saved && saved.team && !saved.example) {
      this.s = { team: saved.team, games: saved.games || {}, example: false };
      Sync.dirty = saved.dirty || {};
    } else {
      const ex = CCP.decorateExample(CC.exampleState());
      this.s = { team: ex.team, games: ex.games, example: true };
    }
  },
  // Change something. docs: list of 'team' or game ids touched.
  change(fn, docs) {
    fn(this.s);
    const now = Date.now();
    (docs || []).forEach((d) => {
      if (d === 'team') this.s.team.updatedAt = now;
      else if (this.s.games[d]) this.s.games[d].updatedAt = now;
      Sync.markDirty(d === 'team' ? 'team' : 'g:' + d);
    });
    Sync.saveLocal();
    this.notify();
  },
  deleteGame(id) {
    delete this.s.games[id];
    Sync.markDirty('del:' + id);
    Sync.saveLocal();
    this.notify();
  }
};
function useStore() {
  const [, force] = useState(0);
  useEffect(() => { const l = () => force((x) => x + 1); Store.listeners.add(l); return () => Store.listeners.delete(l); }, []);
  return Store.s;
}
function toast(msg, action) {
  Store.ui.toast = { msg, action, id: Math.random() };
  Store.notify();
  const id = Store.ui.toast.id;
  setTimeout(() => { if (Store.ui.toast && Store.ui.toast.id === id) { Store.ui.toast = null; Store.notify(); } }, action ? 6000 : 3200);
}

/* ---------- sync: this device first, then the cloud ---------- */
const Sync = {
  db: null, uid: null, status: 'local', dirty: {}, writing: {}, timer: null, retry: null, ver: 0, gotRemote: false, unsub: [],
  setStatus(s) { if (this.status !== s) { this.status = s; Store.notify(); } },
  saveLocal() { lsSet({ team: Store.s.team, games: Store.s.games, example: Store.s.example, dirty: this.dirty }); },
  markDirty(key) {
    if (Store.s.example) return; // the example team is never saved to the cloud
    this.dirty[key] = ++this.ver;
    if (key.startsWith('del:')) delete this.dirty['g:' + key.slice(4)];
    this.schedule();
  },
  schedule() {
    if (!this.db) { this.setStatus(Store.s.example ? 'example' : 'local'); return; }
    this.setStatus('saving');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.pushAll(), 900);
  },
  ref(key) {
    const base = this.db.doc('data/users/' + this.uid + '/team');
    if (key === 'team') return base;
    return base.collection('games').doc(key.split(':')[1]);
  },
  async pushAll() {
    if (!this.db) return;
    const keys = Object.keys(this.dirty).filter((k) => !this.writing[k]);
    let failed = false;
    for (const key of keys) {
      const v = this.dirty[key];
      this.writing[key] = true;
      try {
        if (key === 'team') await this.ref('team').set(clone(Store.s.team));
        else if (key.startsWith('g:')) { const g = Store.s.games[key.slice(2)]; if (g) await this.ref(key).set(clone(g)); }
        else if (key.startsWith('del:')) await this.ref(key).delete();
        if (this.dirty[key] === v) delete this.dirty[key];
      } catch (e) {
        failed = true;
        if (e && e.code === 'quota_exceeded') toast('Cloud storage is full. Delete old games to keep saving.');
        if (e && (e.code === 'revoked' || e.code === 'not_granted')) { this.db = null; }
      } finally { delete this.writing[key]; }
    }
    this.saveLocal();
    if (failed) {
      this.setStatus('offline');
      clearTimeout(this.retry); this.retry = setTimeout(() => this.pushAll(), 20000);
    } else if (Object.keys(this.dirty).length) { this.schedule(); }
    else this.setStatus('saved');
  },
  async start() {
    let user = null, db = null;
    try { user = window.claude ? await window.claude.use('user') : null; } catch (e) { user = null; }
    try { db = window.claude ? await window.claude.use('db') : null; } catch (e) { db = null; }
    let id = null;
    if (user && user.id) { try { id = await user.id(); } catch (e) { id = null; } }
    if (!db || !id) { this.setStatus(Store.s.example ? 'example' : 'local'); return; }
    this.db = db; this.uid = id;
    this.setStatus('loading');
    const loadTimer = setTimeout(() => { if (!this.gotRemote) this.setStatus('offline'); }, 10000);
    const base = db.doc('data/users/' + id + '/team');
    this.unsub.push(base.onSnapshot((snap) => {
      if (!snap.metadata.fromCache) { this.gotRemote = true; clearTimeout(loadTimer); }
      if (!snap.exists) {
        if (!snap.metadata.fromCache && !Store.s.example) { this.markDirty('team'); Object.keys(Store.s.games).forEach((gid) => this.markDirty('g:' + gid)); }
        if (!snap.metadata.fromCache && !Object.keys(this.dirty).length) this.setStatus(Store.s.example ? 'example' : 'saved');
        return;
      }
      if (this.dirty.team) return;
      const remote = snap.data();
      if (Store.s.example) { Store.s.example = false; Store.s.games = {}; }
      if (!Store.s.team || remote.updatedAt !== Store.s.team.updatedAt) { Store.s.team = clone(remote); }
      this.saveLocal(); Store.notify();
      if (!Object.keys(this.dirty).length) this.setStatus('saved');
    }, () => { clearTimeout(loadTimer); this.setStatus('offline'); }));
    this.unsub.push(base.collection('games').onSnapshot((qs) => {
      if (!qs.metadata.fromCache) this.gotRemote = true;
      if (Store.s.example) { if (qs.empty) return; Store.s.example = false; Store.s.games = {}; }
      const seen = {};
      qs.docs.forEach((d) => {
        seen[d.id] = true;
        if (this.dirty['g:' + d.id] || this.dirty['del:' + d.id]) return;
        const data = d.data();
        const local = Store.s.games[d.id];
        if (!local || local.updatedAt !== data.updatedAt) Store.s.games[d.id] = clone(data);
      });
      if (!qs.metadata.fromCache) {
        Object.keys(Store.s.games).forEach((gid) => { if (!seen[gid] && !this.dirty['g:' + gid]) delete Store.s.games[gid]; });
      }
      this.saveLocal(); Store.notify();
    }, () => { this.setStatus('offline'); }));
    window.addEventListener('online', () => this.pushAll());
    if (Object.keys(this.dirty).length && !Store.s.example) this.schedule();
  }
};

/* ---------- AI (Claude, on the coach's own account) ---------- */
const AI = {
  fn: undefined,
  async get() { if (this.fn !== undefined) return this.fn; try { this.fn = window.claude ? await window.claude.use('sample') : null; } catch (e) { this.fn = null; } return this.fn; },
  message(e) {
    const c = e && e.code;
    if (c === 'not_granted' || c === 'sampling_disabled' || c === 'not_declared' || c === 'capability_disabled' || c === 'capability_removed') return 'Claude is turned off for this page. Everything else still works.';
    if (c === 'rate_limited') return 'Claude is busy or your usage limit was reached. Try again in a few minutes.';
    if (c === 'session_expired') return 'Sign in to Claude again, then retry.';
    if (c === 'invalid_json') return 'Claude answered in an unexpected format. Try again.';
    if (c === 'refused') return 'Claude could not help with that. Try rewording your notes.';
    if (c === 'cancelled') return 'Stopped.';
    return 'Something went wrong reaching Claude. Try again.';
  }
};
function useAIAvailable() {
  const [ok, setOk] = useState(null);
  useEffect(() => { let live = true; AI.get().then((f) => { if (live) setOk(!!f); }); return () => { live = false; }; }, []);
  return ok;
}

/* ---------- shared bits ---------- */
function rosterById() { return CC.indexRoster(Store.s.team.roster); }
function playerName(id) { const p = rosterById()[id]; return p ? p.name : 'Player'; }
function sortedGames() { return Object.values(Store.s.games).sort((a, b) => (b.date || '').localeCompare(a.date || '')); }

function Avatar({ p, size = 44, ring }) {
  const src = AVATARS[p && p.avatarId] || AVATARS['girl-1'];
  return html`<span class="avatar" style=${`--sz:${size}px` + (ring ? `;--ring:${ring}` : '')}><img src=${src} alt="" draggable="false" /></span>`;
}
function Num({ n, side }) {
  return html`<span class=${'jersey ' + (side === 'def' ? 'def' : '')}>${n}</span>`;
}
function Chip({ children, tone, title }) { return html`<span class=${'chip ' + (tone || '')} title=${title || ''}>${children}</span>`; }
function Icon({ name, size = 18 }) {
  const P = {
    plus: 'M12 5v14M5 12h14', x: 'M6 6l12 12M18 6L6 18', check: 'M5 12l5 5L20 7', back: 'M15 6l-6 6 6 6', next: 'M9 6l6 6-6 6',
    spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z', undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3',
    download: 'M12 4v11M7 10l5 5 5-5M5 20h14', users: 'M9 11a4 4 0 100-8 4 4 0 000 8zM2 21a7 7 0 0114 0M17 3a4 4 0 010 8M22 21a7 7 0 00-5-6.7',
    full: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5', copy: 'M8 8h11v11H8zM5 16V5h11', trash: 'M5 7h14M10 11v6M14 11v6M7 7l1 13h8l1-13M9 7V4h6v3',
    swap: 'M7 7h13l-4-4M17 17H4l4 4', edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4', star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', ball: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18'
  };
  return html`<svg class="ic" width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${P[name] || ''} /></svg>`;
}

function Dialog({ open, onClose, title, children, wide, footer }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const k = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', k);
    setTimeout(() => { const el = ref.current && ref.current.querySelector('input,select,textarea,button.primary'); if (el) el.focus(); }, 30);
    return () => window.removeEventListener('keydown', k);
  }, [open]);
  if (!open) return null;
  return html`<div class="scrim" onClick=${(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}>
    <div class=${'dialog' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label=${title} ref=${ref}>
      <header class="dialog-head"><h2>${title}</h2><button class="icon-btn" onClick=${onClose} aria-label="Close"><${Icon} name="x" /></button></header>
      <div class="dialog-body">${children}</div>
      ${footer ? html`<footer class="dialog-foot">${footer}</footer>` : null}
    </div>
  </div>`;
}
function useConfirm() {
  const [st, setSt] = useState(null);
  const ask = (title, body, okLabel, fn, danger) => setSt({ title, body, okLabel, fn, danger });
  const el = st ? html`<${Dialog} open=${true} title=${st.title} onClose=${() => setSt(null)}
      footer=${html`<button class="btn" onClick=${() => setSt(null)}>Cancel</button><button class=${'btn primary' + (st.danger ? ' danger' : '')} onClick=${() => { const f = st.fn; setSt(null); f(); }}>${st.okLabel}</button>`}>
      <p>${st.body}</p></${Dialog}>` : null;
  return [ask, el];
}

/* ---------- the court ---------- */
function CourtLines() {
  return html`<svg class="court-svg" viewBox="0 0 500 470" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <defs>
      <pattern id="planks" width="31" height="470" patternUnits="userSpaceOnUse"><rect width="31" height="470" fill="var(--maple)" /><rect x="30" width="1" height="470" fill="var(--maple-2)" /></pattern>
    </defs>
    <rect x="0" y="0" width="500" height="470" fill="url(#planks)" />
    <rect x="190" y="280" width="120" height="190" fill="var(--paint)" />
    <g fill="none" stroke="var(--court-line)" stroke-width="3">
      <rect x="1.5" y="1.5" width="497" height="467" />
      <path d="M190 0 A60 60 0 0 0 310 0" />
      <rect x="190" y="280" width="120" height="190" />
      <path d="M190 280 A60 60 0 0 1 310 280" />
      <path d="M190 280 A60 60 0 0 0 310 280" stroke-dasharray="9 9" />
      <path d="M52.5 470 L52.5 417.5 A197.5 197.5 0 0 1 447.5 417.5 L447.5 470" />
      <path d="M220 430 L280 430" stroke-width="4" />
      <circle cx="250" cy="417.5" r="8" />
      <path d="M210 470 A40 40 0 0 1 290 470" opacity=".5" />
    </g>
  </svg>`;
}

// Court with draggable kids. positions: {pid: {x,y,role,spot}}
function Court({ positions, roster, side, editable, onMove, onTap, big, tips, showSpots }) {
  const ref = useRef(null);
  const [drag, setDrag] = useState(null);
  const byId = CC.indexRoster(roster);
  const ids = Object.keys(positions);
  function pct(e) {
    const r = ref.current.getBoundingClientRect();
    return [CC.clamp(((e.clientX - r.left) / r.width) * 100, 4, 96), CC.clamp(((e.clientY - r.top) / r.height) * 100, 5, 96)];
  }
  function down(e, id) {
    if (!editable) { onTap && onTap(id); return; }
    e.preventDefault();
    e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ id, x: positions[id].x, y: positions[id].y, sx: e.clientX, sy: e.clientY, moved: false });
  }
  function move(e) {
    if (!drag) return;
    const [x, y] = pct(e);
    const moved = drag.moved || Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6;
    setDrag({ ...drag, x, y, moved });
  }
  function up() {
    if (!drag) return;
    if (drag.moved) onMove && onMove(drag.id, Math.round(drag.x * 10) / 10, Math.round(drag.y * 10) / 10);
    else onTap && onTap(drag.id);
    setDrag(null);
  }
  return html`<div class=${'court' + (big ? ' big' : '') + (editable ? ' editable' : '')} ref=${ref} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${() => setDrag(null)}>
    <${CourtLines} />
    <div class="court-side-tag">${side === 'def' ? 'Defense' : 'Offense'}</div>
    ${ids.map((id) => {
      const p = byId[id]; if (!p) return null;
      const pos = drag && drag.id === id ? drag : positions[id];
      const tip = tips && tips[id];
      return html`<button key=${id} class=${'token' + (drag && drag.id === id ? ' dragging' : '')} style=${`left:${pos.x}%;top:${pos.y}%`}
          onPointerDown=${(e) => down(e, id)} aria-label=${p.name + (positions[id].spot ? ', ' + positions[id].spot : '')}>
        <span class="token-face"><img src=${AVATARS[p.avatarId] || AVATARS['girl-1']} alt="" draggable="false" />
          <span class=${'token-num ' + (side === 'def' ? 'def' : '')}>${p.number}</span>
          ${tip ? html`<span class="token-tip" title=${tip}>!</span>` : null}
        </span>
        <span class="token-name">${p.name}</span>
        ${showSpots && positions[id].role ? html`<span class="token-role">${CC.ROLES[positions[id].role].name}</span>` : null}
      </button>`;
    })}
  </div>`;
}

/* ---------- small charts ---------- */
function SkillBar({ value, max = 4 }) {
  const pct = Math.max(0, Math.min(1, (value - 1) / (max - 1)));
  return html`<span class="skillbar"><span style=${`width:${8 + pct * 92}%`}></span></span>`;
}
function Spark({ values, w = 90, h = 26 }) {
  if (!values || values.length < 2) return html`<span class="muted small">one rating</span>`;
  const min = 1, max = 4, n = values.length;
  const pts = values.map((v, i) => [4 + (i * (w - 8)) / (n - 1), h - 4 - ((v - min) / (max - min)) * (h - 8)]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const last = pts[pts.length - 1];
  return html`<svg class="spark" width=${w} height=${h} viewBox=${`0 0 ${w} ${h}`} aria-hidden="true"><path d=${d + ` L${last[0]} ${h} L4 ${h} Z`} class="spark-fill" /><path d=${d} class="spark-line" /><circle cx=${last[0]} cy=${last[1]} r="3" class="spark-dot" /></svg>`;
}
