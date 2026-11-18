/* CourtCoach playbook engine, game-day helpers and extras. Pure functions only.
   Court coordinates: x 0-100 (left to right sideline), y 0-100 (half-court line to baseline).
   Our basket is at (50, 89). Out of bounds: baseline y ~104, sidelines x -3 / 103. */
var CCP = (function () {
  'use strict';

  var TYPES = {
    inb: { name: 'Inbounder', w: { pass: 0.5, conf: 0.3, space: 0.2 } },
    pg: { name: 'Ball handler', w: { drib: 0.4, conf: 0.25, pass: 0.25, space: 0.1 } },
    sh: { name: 'Shooter', w: { shoot: 0.55, conf: 0.25, space: 0.2 } },
    scr: { name: 'Screener', w: { reb: 0.35, def: 0.25, hustle: 0.25, conf: 0.15 } },
    cut: { name: 'Cutter', w: { hustle: 0.4, shoot: 0.3, space: 0.3 } },
    reb: { name: 'Rebounder', w: { reb: 0.6, hustle: 0.25, def: 0.15 } },
    safe: { name: 'Safety', w: { def: 0.45, hustle: 0.3, drib: 0.25 } }
  };
  var CATS = [['blob', 'Baseline inbounds'], ['slob', 'Sideline inbounds'], ['press', 'Press break'], ['set', 'Half-court plays'], ['ft', 'Free throws'], ['custom', 'My plays']];

  function R(key, type, label) { return { key: key, type: type, label: label }; }
  var STARTER = [
    { id: 'box', name: 'Box', cat: 'blob', desc: 'Under our basket. Four players in a box. The bottom two screen, the top two cut.',
      roles: [R('inb', 'inb', 'Inbounder'), R('pg', 'pg', 'Point'), R('sh', 'sh', 'Shooter'), R('s1', 'scr', 'Screener'), R('s2', 'reb', 'Big')],
      start: { inb: [62, 104], pg: [38, 60], sh: [62, 60], s1: [38, 85], s2: [62, 85] }, ball: 'inb',
      steps: [
        { say: 'Inbounder slaps the ball. Bottom two set screens for the top two.', moves: { s1: [38, 69], s2: [62, 69] }, screens: ['s1', 's2'] },
        { say: 'Shooter cuts to the basket. Point pops out to the top.', moves: { sh: [55, 86], pg: [50, 40] } },
        { say: 'Screeners roll to the basket with hands up.', moves: { s1: [30, 80], s2: [72, 80] } },
        { say: 'Pass to the open cutter for a layup. Covered? Pass to the top.', moves: { inb: [84, 92] }, ball: 'sh' }
      ] },
    { id: 'stack', name: 'Stack', cat: 'blob', desc: 'Under our basket. Four players in a line. On the slap, everyone breaks a different way. Great against a zone.',
      roles: [R('inb', 'inb', 'Inbounder'), R('s1', 'scr', 'Bottom'), R('c', 'cut', 'Cutter'), R('sh', 'sh', 'Shooter'), R('pg', 'pg', 'Top')],
      start: { inb: [34, 104], s1: [38, 85], c: [38, 78], sh: [38, 71], pg: [38, 64] }, ball: 'inb',
      steps: [
        { say: 'On the slap, break! Bottom holds her spot as a screen.', moves: { s1: [42, 87], c: [57, 86], sh: [9, 90], pg: [50, 41] }, screens: ['s1'] },
        { say: 'First look: the cutter for a layup. Second look: the corner.', ball: 'c' },
        { say: 'Inbounder steps in to the other side for the rebound.', moves: { inb: [64, 86] } }
      ] },
    { id: 'sideline', name: 'Sideline V-cut', cat: 'slob', desc: 'Inbound from the sideline. The point fakes toward the basket, then sprints back to the ball.',
      roles: [R('inb', 'inb', 'Inbounder'), R('pg', 'pg', 'Point'), R('sh', 'sh', 'Shooter'), R('s1', 'scr', 'Post'), R('c', 'cut', 'Wing')],
      start: { inb: [-4, 40], pg: [24, 55], sh: [9, 89], s1: [40, 63], c: [80, 54] }, ball: 'inb',
      steps: [
        { say: 'Point takes two steps toward the basket...', moves: { pg: [30, 70] } },
        { say: '...then sprints back to the ball. That is a V-cut!', moves: { pg: [13, 36] } },
        { say: 'Pass it in to the point.', ball: 'pg' },
        { say: 'Inbounder steps in. Point dribbles to the middle. Everyone spreads out.', moves: { pg: [50, 36], inb: [16, 56], s1: [62, 82] } }
      ] },
    { id: 'diamond', name: 'Press break: Diamond', cat: 'press', desc: 'After they score and press. Inbound under the basket you defend, then move it up. The top of the picture is half court.',
      roles: [R('inb', 'inb', 'Inbounder'), R('pg', 'pg', 'Point'), R('c', 'cut', 'Middle'), R('s1', 'scr', 'Opposite'), R('sh', 'sh', 'Long')],
      start: { inb: [60, 104], pg: [80, 62], c: [50, 58], s1: [20, 62], sh: [50, 12] }, ball: 'inb',
      steps: [
        { say: 'Point cuts to the corner to get open.', moves: { pg: [83, 87] } },
        { say: 'Pass in. Middle flashes toward the ball.', moves: { c: [62, 66] }, ball: 'pg' },
        { say: 'Pass to the middle. Everyone sprints up the floor.', moves: { pg: [88, 30], s1: [14, 30], inb: [56, 84] }, ball: 'c' },
        { say: 'Middle turns and passes ahead to the long player.', moves: { c: [50, 42] }, ball: 'sh' }
      ] },
    { id: 'givego', name: 'Give and go', cat: 'set', desc: 'From the 5-out. Pass, then cut hard to the basket for a return pass.',
      roles: [R('pg', 'pg', 'Point'), R('w', 'sh', 'Wing'), R('c', 'cut', 'Other wing'), R('s1', 'scr', 'Corner'), R('s2', 'reb', 'Corner')],
      start: { pg: [50, 35], w: [17, 52], c: [83, 52], s1: [9, 88], s2: [91, 88] }, ball: 'pg',
      steps: [
        { say: 'Point passes to the wing.', ball: 'w' },
        { say: 'Point fakes away, then cuts hard to the basket.', moves: { pg: [44, 84] } },
        { say: 'Wing passes back for the layup. The other wing fills the top.', moves: { c: [50, 37] }, ball: 'pg' }
      ] },
    { id: 'pnr', name: 'Pick and roll', cat: 'set', desc: 'A screen for the ball handler, then the screener rolls to the basket.',
      roles: [R('pg', 'pg', 'Point'), R('s1', 'scr', 'Screener'), R('sh', 'sh', 'Shooter'), R('c', 'cut', 'Wing'), R('r', 'reb', 'Corner')],
      start: { pg: [50, 36], s1: [50, 61], sh: [17, 52], c: [83, 52], r: [9, 88] }, ball: 'pg',
      steps: [
        { say: 'Screener comes up and sets a screen next to the point.', moves: { s1: [58, 39] }, screens: ['s1'] },
        { say: 'Point dribbles off the screen, shoulder to shoulder.', moves: { pg: [74, 56] } },
        { say: 'Screener rolls to the basket with hands up.', moves: { s1: [54, 82] } },
        { say: 'Pass to the roller for a layup, or shoot if open.', ball: 's1' }
      ] },
    { id: 'ft-ours', name: 'Free throws: we shoot', cat: 'ft', desc: 'Where to stand when we shoot. Check your league’s lane rules.',
      roles: [R('sh', 'sh', 'Shooter'), R('r1', 'reb', 'Rebounder'), R('r2', 'reb', 'Rebounder'), R('pg', 'safe', 'Safety'), R('c', 'safe', 'Safety')],
      start: { sh: [50, 60], r1: [38, 76], r2: [62, 76], pg: [50, 40], c: [22, 47] }, ball: 'sh',
      steps: [
        { say: 'Rebounders step in when the ball hits the rim. Safeties stay back.', moves: { r1: [44, 84], r2: [56, 84] } }
      ] },
    { id: 'ft-theirs', name: 'Free throws: they shoot', cat: 'ft', desc: 'Where to stand when they shoot. Box out, then get it out fast.',
      roles: [R('b1', 'reb', 'Box out'), R('b2', 'reb', 'Box out'), R('c', 'cut', 'Lane'), R('s', 'safe', 'On the shooter'), R('pg', 'pg', 'Outlet')],
      start: { b1: [38, 85], b2: [62, 85], c: [38, 68], s: [50, 45], pg: [70, 40] }, ball: null,
      steps: [
        { say: 'Box out! Find a body and sit on her.', moves: { b1: [44, 88], b2: [56, 88] }, screens: ['b1', 'b2'] },
        { say: 'Grab the rebound with two hands.', ball: 'b1' },
        { say: 'Outlet pass to the point on the side.', moves: { pg: [88, 47] }, ball: 'pg' }
      ] }
  ];
  var STARTER_IDS = STARTER.map(function (p) { return p.id; });

  function allPlays(team) { return STARTER.concat((team && team.plays) || []); }
  function findPlay(team, id) { var a = allPlays(team); for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return null; }
  function isStarter(id) { return STARTER_IDS.indexOf(id) >= 0; }
  function stars(team) { return (team && team.stars) || STARTER_IDS.slice(); }

  // Positions of every role after step k (k = -1 means the starting spots).
  function posAt(play, k) {
    var p = {}; Object.keys(play.start || {}).forEach(function (r) { p[r] = play.start[r].slice(); });
    for (var i = 0; i <= k && i < play.steps.length; i++) { var m = play.steps[i].moves || {}; Object.keys(m).forEach(function (r) { p[r] = m[r].slice(); }); }
    return p;
  }
  function ballAt(play, k) {
    var b = play.ball === undefined ? null : play.ball;
    for (var i = 0; i <= k && i < play.steps.length; i++) if (play.steps[i].ball !== undefined) b = play.steps[i].ball;
    return b;
  }
  // Arrows drawn for step k: cuts, screens, dribbles, then the pass.
  function arrows(play, k) {
    if (k < 0 || k >= play.steps.length) return [];
    var before = posAt(play, k - 1), after = posAt(play, k);
    var b0 = ballAt(play, k - 1), b1 = ballAt(play, k);
    var st = play.steps[k], out = [];
    Object.keys(st.moves || {}).forEach(function (r) {
      if (!before[r]) return;
      var kind = (st.screens || []).indexOf(r) >= 0 ? 'screen' : (b0 === r && b1 === r ? 'dribble' : 'cut');
      out.push({ kind: kind, role: r, from: before[r], to: after[r] });
    });
    if (b1 && b0 && b1 !== b0 && after[b0] && after[b1]) out.push({ kind: 'pass', role: b0, from: after[b0], to: after[b1] });
    return out;
  }

  function typeFit(p, type) { var w = (TYPES[type] || TYPES.cut).w, t = 0; for (var k in w) t += w[k] * CC.rating(p, k); return t; }
  // Put each kid in the role that fits her best (maximum total fit). Returns {roleKey: playerId|null}.
  function castPlay(play, players) {
    var roles = play.roles || [], cast = {};
    roles.forEach(function (r) { cast[r.key] = null; });
    if (!players || !players.length || !roles.length) return cast;
    var n = players.length, m = roles.length, best = null, bestScore = -1, used = [], pick = [];
    // Key roles (inbounder, ball handler) get first pick of the best fits.
    var IMP = { inb: 1.35, pg: 1.35, sh: 1.1, cut: 1, scr: 0.9, reb: 0.9, safe: 0.8 };
    var fits = players.map(function (p) { return roles.map(function (r) { return typeFit(p, r.type) * (IMP[r.type] || 1); }); });
    var slots = Math.min(n, m);
    // choose which roles get filled when there are fewer players than roles: fill the earliest roles
    function rec(ri, score) {
      if (ri === slots) { if (score > bestScore + 1e-9) { bestScore = score; best = pick.slice(); } return; }
      for (var i = 0; i < n; i++) { if (used[i]) continue; used[i] = true; pick.push(i); rec(ri + 1, score + fits[i][ri]); pick.pop(); used[i] = false; }
    }
    if (n > 8) { // trim to the 8 most versatile players to keep this fast
      var order = players.map(function (p, i) { return { i: i, s: Math.max.apply(null, fits[i]) }; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 8).map(function (x) { return x.i; });
      players = order.map(function (i) { return players[i]; }); fits = order.map(function (i) { return fits[i]; }); n = players.length;
    }
    rec(0, 0);
    if (best) for (var s = 0; s < slots; s++) cast[roles[s].key] = players[best[s]].id;
    return cast;
  }

  function playStats(games, playId) {
    var o = { runs: 0, score: 0, shot: 0, to: 0, none: 0 };
    (games || []).forEach(function (g) { (g.playLog || []).forEach(function (e) { if (e.play === playId) { o.runs++; if (o[e.res] !== undefined) o[e.res]++; } }); });
    return o;
  }

  // Clean up a play from Claude or the builder.
  function normalizePlay(raw, id) {
    if (!raw || typeof raw !== 'object') throw new Error('No play found');
    var keyOk = function (k) { return /^[a-z0-9]{1,10}$/.test(k); };
    var roles = (Array.isArray(raw.roles) ? raw.roles : []).slice(0, 5).map(function (r, i) {
      var key = String(r && r.key || 'p' + (i + 1)).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) || ('p' + (i + 1));
      return { key: key, type: TYPES[r && r.type] ? r.type : 'cut', label: String(r && r.label || (TYPES[r && r.type] || TYPES.cut).name).slice(0, 18) };
    });
    var seen = {}; roles = roles.filter(function (r) { if (seen[r.key] || !keyOk(r.key)) return false; seen[r.key] = true; return true; });
    if (!roles.length) throw new Error('The play has no players');
    function pt(v) { if (!Array.isArray(v) || v.length < 2) return null; var x = +v[0], y = +v[1]; if (!isFinite(x) || !isFinite(y)) return null; return [Math.round(CC.clamp(x, -4, 104) * 10) / 10, Math.round(CC.clamp(y, 1, 106) * 10) / 10]; }
    var start = {}; var defaults = [[50, 36], [17, 52], [83, 52], [9, 88], [91, 88]];
    roles.forEach(function (r, i) { start[r.key] = pt(raw.start && raw.start[r.key]) || defaults[i]; });
    var ball = raw.ball && seen[raw.ball] ? raw.ball : null;
    var steps = (Array.isArray(raw.steps) ? raw.steps : []).slice(0, 8).map(function (s) {
      var moves = {}; Object.keys((s && s.moves) || {}).forEach(function (k) { var p = pt(s.moves[k]); if (seen[k] && p) moves[k] = p; });
      var st = { say: String(s && s.say || '').slice(0, 140), moves: moves, screens: (Array.isArray(s && s.screens) ? s.screens : []).filter(function (k) { return seen[k] && moves[k]; }) };
      if (s && s.ball !== undefined) st.ball = s.ball && seen[s.ball] ? s.ball : null;
      return st;
    });
    var cats = CATS.map(function (c) { return c[0]; });
    return { id: id || ('my-' + CC.uid()), name: String(raw.name || 'New play').slice(0, 40), cat: cats.indexOf(raw.cat) >= 0 ? raw.cat : 'custom', desc: String(raw.desc || '').slice(0, 240), roles: roles, start: start, ball: ball, steps: steps, custom: true };
  }

  // ---------- sub helper ----------
  function changeAt(game, i) {
    var a = CC.lineupOf(game, i), b = CC.lineupOf(game, i + 1);
    return { out: a.filter(function (id) { return b.indexOf(id) < 0; }), inn: b.filter(function (id) { return a.indexOf(id) < 0; }), next: i + 1 < CC.nShifts(game) ? i + 1 : null };
  }
  function clockElapsed(clock, now) { if (!clock) return 0; return (clock.el || 0) + (clock.run ? (now - clock.run) : 0); }

  // ---------- timeout card ----------
  var OPP_TAGS = {
    press: { label: 'Presses', vs: 'presses', tip: 'Run the Diamond press break after every basket they score.', plays: ['diamond'] },
    zone: { label: 'Plays zone', vs: 'plays zone', tip: 'Use the 1-3-1 offense and flash to the middle. Stack works well for inbounds.', off: '131', plays: ['stack', 'box'] },
    man: { label: 'Man-to-man', vs: 'plays man-to-man', tip: 'Use screens: Pick and roll and Give and go.', off: '5out', plays: ['pnr', 'givego'] },
    tall: { label: 'Tall team', vs: 'is tall', tip: 'Box out every shot. The 2-3 zone protects the paint.', def: '23', plays: ['ft-theirs'] },
    fast: { label: 'Fast team', vs: 'is fast', tip: 'Sprint back on defense and keep a safety back.', def: '23', plays: [] },
    shooter: { label: 'Has a shooter', vs: 'has a shooter', tip: 'Hands up on their best shooter. Man-to-man keeps someone on her.', def: 'man', plays: [] }
  };
  function oppKey(name) { return String(name || '').trim().toLowerCase(); }

  function timeoutCard(game, opp, names) {
    var spq = game.spq || 2, cur = game.cur || 0, q = Math.floor(cur / spq);
    var inPeriod = function (s) { return Math.floor(s / spq) === q; };
    var c = { to: 0, toAll: 0, us: 0, them: 0, fga: 0, fgm: 0, reb: 0, events: 0 };
    var who = {};
    (game.events || []).forEach(function (e) {
      var d = CC.EVENTS[e.t]; if (!d) return;
      if (e.t === 'to') c.toAll++;
      if (e.p && (e.t === 'reb' || e.t === 'stl' || e.t === 'hus' || e.t === 'ast')) who[e.p] = (who[e.p] || 0) + 1;
      if (!inPeriod(e.s)) return;
      c.events++;
      if (d.team === 'them') c.them += d.pts; else c.us += d.pts;
      if (e.t === 'to') c.to++;
      if (e.t === 'fg2' || e.t === 'fg3') { c.fga++; c.fgm++; }
      if (e.t === 'miss') c.fga++;
      if (e.t === 'reb') c.reb++;
    });
    var fixes = [];
    if (c.to >= 3 || c.toAll >= 6) fixes.push({ title: 'Take care of the ball', say: 'Two hands, eyes up, bounce passes. Don’t force it.' });
    if (c.them - c.us >= 4) fixes.push({ title: 'Get back on defense', say: 'Sprint back, find a body, hands up.' + (game.defForm === 'man' ? ' Try the 2-3 zone.' : '') });
    if (c.events >= 4 && c.fga <= 1) fixes.push({ title: 'Look for your shot', say: 'If you’re open, shoot! Drive to the basket.' });
    if (c.fga >= 5 && c.fgm / c.fga < 0.2) fixes.push({ title: 'Get closer shots', say: 'Pass inside and drive for layups.' });
    if (c.reb < 2 && (c.fga - c.fgm) + c.them / 2 >= 4) fixes.push({ title: 'Box out', say: 'Every shot: find a body, then go get the ball.' });
    var tags = (opp && opp.tags) || [];
    if (tags.indexOf('press') >= 0 && c.to >= 1) fixes.unshift({ title: 'Beat the press', say: 'Use the Diamond: point to the corner, middle flashes, pass ahead.' });
    var star = Object.keys(who).sort(function (a, b) { return who[b] - who[a]; })[0];
    var good = star && who[star] >= 2 ? { title: 'Shout-out', say: (names[star] || 'Someone') + ' is everywhere: ' + who[star] + ' hustle stats. Everyone play like that!' }
      : { title: 'Keep it up', say: 'Great energy. Keep talking on defense!' };
    return { fixes: fixes.slice(0, 2), good: good, period: { us: c.us, them: c.them } };
  }
  function suggestPlay(team, games, opp) {
    var best = null, bestRate = -1;
    allPlays(team).forEach(function (p) {
      var st = playStats(games, p.id); if (st.runs < 2) return;
      var rate = (st.score + 0.4 * st.shot) / st.runs; if (rate > bestRate) { bestRate = rate; best = { id: p.id, why: st.score + ' scores in ' + st.runs + ' tries this season' }; }
    });
    if (best && bestRate >= 0.4) return best;
    var tags = (opp && opp.tags) || [];
    for (var i = 0; i < tags.length; i++) { var t = OPP_TAGS[tags[i]]; if (t && t.plays.length) return { id: t.plays[0], why: 'Good when the other team ' + t.vs }; }
    return { id: 'box', why: 'A reliable inbound play' };
  }

  // ---------- home challenges ----------
  var CHALLENGES = {
    drib: { title: '100 dribbles each hand', how: 'Every day: 100 dribbles with the right hand and 100 with the left. Eyes up, count out loud.' },
    pass: { title: 'Wall passes', how: '50 chest passes and 50 bounce passes against a wall. Step into every pass.' },
    shoot: { title: 'Close-up form shots', how: '25 one-hand shots from right in front of the basket (a laundry basket works). Elbow in, follow through.' },
    def: { title: 'Defense slides', how: '3 rounds of 30 seconds sliding side to side in a low stance. Don’t cross your feet.' },
    reb: { title: 'Toss and grab', how: 'Toss the ball up 20 times. Jump and grab it with two hands at the highest point.' },
    space: { title: 'Spot sprint game', how: 'Put 5 socks on the floor as spots. A family member calls a number and you sprint to it.' },
    hustle: { title: 'Jump rope or sprints', how: '2 minutes of jump rope or 5 short sprints. Go hard!' },
    conf: { title: 'Shoot for an audience', how: 'Shoot 10 shots while someone watches. Call “Ball!” loud before each one.' },
    wraps: { title: 'Ball wraps', how: '10 wraps around your waist, 10 around your knees, 10 figure-8s through your legs.' }
  };
  function mondayOf(iso) {
    var p = iso.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2]);
    var day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day);
    var m = d.getMonth() + 1, dd = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd;
  }
  function shiftWeek(iso, n) {
    var p = iso.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2] + 7 * n);
    var m = d.getMonth() + 1, dd = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd;
  }
  function challengeCount(team, pid) {
    var weeks = (team.challenges && team.challenges.weeks) || {}, n = 0;
    Object.keys(weeks).forEach(function (w) { var wk = weeks[w]; if (wk.done && wk.done[pid]) n++; if (wk.pdone && wk.pdone[pid]) n++; });
    return n;
  }

  // ---------- parent recap ----------
  function parentRecap(team, game, A, season, week, focusKey) {
    var byId = CC.indexRoster(team.roster);
    var res = A.us > A.them ? 'We got the win!' : A.us < A.them ? 'Tough one, but the girls kept battling the whole way.' : 'A tie! The girls battled to the end.';
    var lines = ['🏀 ' + team.name + ' vs ' + game.opponent, 'Final: ' + A.us + '–' + A.them + '. ' + res, '', 'Highlights:'];
    var generic = ['great energy', 'tough defense', 'kept hustling', 'moved the ball well', 'great teammate'];
    (game.present || []).filter(function (id) { return byId[id]; }).forEach(function (id) {
      var l = A.players[id] || CC.emptyLine(), bits = [];
      if (l.pts >= 2) bits.push(l.pts + ' points');
      if (l.reb >= 2) bits.push(l.reb + ' rebounds');
      if (l.stl >= 1) bits.push(l.stl + (l.stl === 1 ? ' steal' : ' steals'));
      if (l.ast >= 1) bits.push(l.ast + (l.ast === 1 ? ' assist' : ' assists'));
      if (!bits.length && l.hus >= 1) bits.push(l.hus + ' hustle ' + (l.hus === 1 ? 'play' : 'plays'));
      if (!bits.length) bits.push(generic[CC.hashStr(id + game.id) % generic.length]);
      lines.push('• ' + byId[id].name + ': ' + bits.slice(0, 2).join(', '));
    });
    var counts = CC.shiftCounts(game, (game.present || []).filter(function (id) { return byId[id]; }), true);
    var v = Object.keys(counts).map(function (k) { return counts[k]; });
    if (v.length) lines.push('', 'Everyone played ' + (Math.min.apply(null, v) === Math.max.apply(null, v) ? v[0] : Math.min.apply(null, v) + '–' + Math.max.apply(null, v)) + ' shifts.');
    if (focusKey) lines.push('This week we’re working on ' + CC.SKILLS.filter(function (s) { return s.k === focusKey; })[0].name.toLowerCase() + '. Ask your player to show you "' + CC.DRILLS[focusKey].name + '"!');
    if (week && week.team && CHALLENGES[week.team]) lines.push('Home challenge: ' + CHALLENGES[week.team].title + '. ' + CHALLENGES[week.team].how);
    lines.push('', 'Thanks for cheering! – Coach');
    return lines.join('\n');
  }

  // ---------- example data for the demo team ----------
  function decorateExample(state) {
    var r = CC.rng(77);
    var res = ['score', 'score', 'shot', 'to', 'none', 'score', 'shot'];
    var plan = { exg1: ['box', 'box', 'stack', 'givego', 'ft-ours'], exg2: ['box', 'diamond', 'diamond', 'stack', 'pnr'], exg3: ['box', 'stack', 'givego', 'pnr', 'sideline'] };
    Object.keys(plan).forEach(function (gid) {
      var g = state.games[gid]; if (!g) return;
      g.playLog = plan[gid].map(function (p, i) { return { id: 'pl' + gid + i, s: Math.floor(r() * 8), play: p, res: res[Math.floor(r() * res.length)], at: i }; });
    });
    state.team.opponents = { 'falcons': { name: 'Falcons', tags: ['press', 'tall'], notes: 'Pressed the whole first half last season. #5 is tall and blocks shots.', updatedAt: 1 }, tigers: { name: 'Tigers', tags: ['zone'], notes: 'Sat in a 2-3 zone all game.', updatedAt: 1 } };
    var wk = mondayOf('2026-11-14');
    var personal = {}, done = {}, pdone = {};
    state.team.roster.forEach(function (p, i) { personal[p.id] = CC.practiceFocus(p, null); if (i % 3 !== 2) done[p.id] = 1; if (i % 2 === 0) pdone[p.id] = 1; });
    var prev = shiftWeek(wk, -1), pdone2 = {}, done2 = {};
    state.team.roster.forEach(function (p, i) { if (i % 4 !== 3) done2[p.id] = 1; if (i % 3 === 0) pdone2[p.id] = 1; });
    state.team.challenges = { weeks: {} };
    state.team.challenges.weeks[wk] = { team: 'drib', personal: personal, done: done, pdone: pdone };
    state.team.challenges.weeks[prev] = { team: 'pass', personal: personal, done: done2, pdone: pdone2 };
    state.team.settings.periodMin = 6;
    return state;
  }

  return {
    TYPES: TYPES, CATS: CATS, STARTER: STARTER, STARTER_IDS: STARTER_IDS, OPP_TAGS: OPP_TAGS, CHALLENGES: CHALLENGES,
    allPlays: allPlays, findPlay: findPlay, isStarter: isStarter, stars: stars, posAt: posAt, ballAt: ballAt, arrows: arrows,
    typeFit: typeFit, castPlay: castPlay, playStats: playStats, normalizePlay: normalizePlay,
    changeAt: changeAt, clockElapsed: clockElapsed, oppKey: oppKey, timeoutCard: timeoutCard, suggestPlay: suggestPlay,
    mondayOf: mondayOf, shiftWeek: shiftWeek, challengeCount: challengeCount, parentRecap: parentRecap, decorateExample: decorateExample
  };
})();
if (typeof module !== 'undefined') module.exports = CCP;
