/* CourtCoach coaching model: skills, roles, formations, rotation builder, game math.
   Pure functions only, so they can be tested outside the page. */
var CC = (function () {
  'use strict';

  var SKILLS = [
    { k: 'drib', name: 'Dribbling', short: 'Dribble', levels: ['Looks down, loses it under pressure', 'Dribbles with strong hand while moving', 'Head up, uses both hands', 'Brings it up against pressure'] },
    { k: 'pass', name: 'Passing & catching', short: 'Pass', levels: ['Passes often get away', 'Short passes to an open teammate', 'Chest and bounce passes on target', 'Sees the open kid and hits them'] },
    { k: 'shoot', name: 'Shooting & layups', short: 'Shoot', levels: ['Still learning the form', 'Makes close shots sometimes', 'Good form, makes layups', 'Scores from several spots'] },
    { k: 'def', name: 'Defense', short: 'Defend', levels: ['Watches the ball, loses their player', 'Stays near their player', 'Stance, hands up, stays between player and basket', 'Stops drives and helps teammates'] },
    { k: 'reb', name: 'Rebounding', short: 'Rebound', levels: ['Waits for the ball to come down', 'Goes after balls close by', 'Jumps and grabs with two hands', 'Boxes out and wins most boards'] },
    { k: 'space', name: 'Spacing & spots', short: 'Spacing', levels: ['Bunches up near the ball', 'Finds a spot when reminded', 'Knows the spots and spreads out', 'Moves to get open, reads the play'] },
    { k: 'hustle', name: 'Hustle', short: 'Hustle', levels: ['Walks back on defense', 'Runs when the coach calls it', 'Sprints back, chases loose balls', 'Never stops, dives for loose balls'] },
    { k: 'conf', name: 'Confidence', short: 'Confidence', levels: ['Avoids the ball', 'Takes it when wide open', 'Wants the ball, shoots when open', 'Leads, calls for it, talks on court'] }
  ];
  var LEVELS = ['Learning', 'Getting it', 'Solid', 'Leader'];

  var SUPERPOWER = { drib: 'Ball wizard', pass: 'Playmaker', shoot: 'Bucket getter', def: 'Lockdown defender', reb: 'Board grabber', space: 'Spot finder', hustle: 'Energy engine', conf: 'Team leader' };
  var MISSION = { drib: 'Dribble with your eyes up', pass: 'Make 3 great passes every game', shoot: 'Practice your 1-2 layup steps', def: 'Stay between your player and the basket', reb: 'Find a body, then go get the ball', space: 'Find an open spot away from the ball', hustle: 'Sprint back every single time', conf: "Call for the ball when you're open" };

  var DRILLS = {
    drib: { name: 'Red light, green light dribble', how: 'Dribble on green, freeze on red. Eyes on the coach the whole time, then switch hands.' },
    pass: { name: 'Partner pass ladder', how: 'Partners take a step back after 3 good chest passes in a row, then bounce passes on the way back in.' },
    shoot: { name: 'Layup lines, both sides', how: 'Right side then left side. Everyone says "1-2-up" out loud for the steps.' },
    def: { name: 'Mirror slides', how: 'Partners face each other. The defender mirrors in a stance without crossing feet. 20 seconds, then switch.' },
    reb: { name: 'Box-out battles', how: 'Coach shoots. Find a body, sit on your heels to hold them off, then go grab the ball.' },
    space: { name: 'Spot ball', how: 'Cones on the 5 spots. Nobody can pass until every player is on a different cone.' },
    hustle: { name: 'Sprint-back race', how: 'After every shot, everyone races past half court. First one back earns a point for their group.' },
    conf: { name: 'Hot spot shooting', how: 'Each player picks a hot spot. The whole team counts and cheers every make.' }
  };

  var ROLES = {
    handler: { side: 'off', name: 'Ball Handler', w: { drib: 0.4, conf: 0.25, pass: 0.25, space: 0.1 }, tip: 'Bring it up with your head up and find the open teammate.' },
    wing: { side: 'off', name: 'Wing', w: { shoot: 0.35, space: 0.25, pass: 0.2, hustle: 0.2 }, tip: 'Stay wide and be ready to catch and shoot.' },
    post: { side: 'off', name: 'Post', w: { reb: 0.4, shoot: 0.2, hustle: 0.2, def: 0.2 }, tip: 'Hands up near the basket and crash for rebounds.' },
    top: { side: 'def', name: 'Top Defender', w: { hustle: 0.4, def: 0.4, conf: 0.2 }, tip: 'Hands up and pressure the ball.' },
    wingd: { side: 'def', name: 'Wing Defender', w: { def: 0.45, hustle: 0.3, reb: 0.25 }, tip: 'Slide with your player and stay between them and the basket.' },
    middle: { side: 'def', name: 'Paint Protector', w: { reb: 0.5, def: 0.3, hustle: 0.2 }, tip: 'Guard the paint, box out, grab the rebound.' }
  };
  var OFF_ROLES = ['handler', 'wing', 'post'];
  var DEF_ROLES = ['top', 'wingd', 'middle'];

  // Court coordinates: x = % of width, y = % of length (0 = half-court line, 100 = baseline).
  var FORMATIONS = {
    off: {
      '5out': { name: '5-Out', desc: 'Everyone spaced around the arc. Best for learning spacing.', spots: [[50, 35, 'handler', 'Point'], [17, 52, 'wing', 'Left wing'], [83, 52, 'wing', 'Right wing'], [9, 88, 'wing', 'Left corner'], [91, 88, 'wing', 'Right corner']] },
      '4out': { name: '4-Out 1-In', desc: 'Four on the outside, one player down low.', spots: [[50, 35, 'handler', 'Point'], [18, 54, 'wing', 'Left wing'], [82, 54, 'wing', 'Right wing'], [10, 88, 'wing', 'Left corner'], [62, 82, 'post', 'Low block']] },
      '212': { name: '2-1-2', desc: 'Two guards, a high post and two low posts. Easy spots to remember.', spots: [[35, 40, 'handler', 'Left guard'], [65, 40, 'wing', 'Right guard'], [50, 60, 'post', 'High post'], [34, 83, 'post', 'Left block'], [66, 83, 'post', 'Right block']] },
      '131': { name: '1-3-1', desc: 'Point up top, wings at the free-throw line, a high post, and one player running the baseline. Great against a 2-3 zone.', spots: [[50, 35, 'handler', 'Point'], [14, 60, 'wing', 'Left wing'], [86, 60, 'wing', 'Right wing'], [50, 62, 'post', 'High post'], [34, 89, 'post', 'Baseline']] }
    },
    def: {
      '23': { name: '2-3 Zone', desc: 'Two up top, three across the paint. Protects the basket.', spots: [[37, 60, 'top', 'Top left'], [63, 60, 'top', 'Top right'], [16, 84, 'wingd', 'Low left'], [84, 84, 'wingd', 'Low right'], [50, 82, 'middle', 'Middle']] },
      '122': { name: '1-2-2 Zone', desc: 'One chaser up top, two at the elbows, two on the blocks.', spots: [[50, 50, 'top', 'Top'], [29, 67, 'wingd', 'Left elbow'], [71, 67, 'wingd', 'Right elbow'], [33, 88, 'middle', 'Left block'], [67, 88, 'middle', 'Right block']] },
      'man': { name: 'Man-to-Man', desc: 'Everyone guards one player. Teaches stance and effort.', spots: [[50, 45, 'top', 'On the ball'], [25, 61, 'wingd', 'Left wing'], [75, 61, 'wingd', 'Right wing'], [15, 86, 'wingd', 'Left corner'], [57, 80, 'middle', 'Post']] }
    }
  };

  var FORM_ORDER = { off: ['5out', '4out', '212', '131'], def: ['23', '122', 'man'] };

  var EVENTS = {
    fg2: { label: 'Made 2', pts: 2, team: 'us', kind: 'score' },
    fg3: { label: 'Made 3', pts: 3, team: 'us', kind: 'score' },
    ft: { label: 'Free throw', pts: 1, team: 'us', kind: 'score' },
    miss: { label: 'Missed shot', pts: 0, team: 'us', kind: 'shot' },
    reb: { label: 'Rebound', pts: 0, team: 'us', kind: 'good' },
    stl: { label: 'Steal', pts: 0, team: 'us', kind: 'good' },
    ast: { label: 'Assist', pts: 0, team: 'us', kind: 'good' },
    hus: { label: 'Hustle play', pts: 0, team: 'us', kind: 'good' },
    to: { label: 'Turnover', pts: 0, team: 'us', kind: 'learn' },
    opp1: { label: 'They scored 1', pts: 1, team: 'them', kind: 'opp' },
    opp2: { label: 'They scored 2', pts: 2, team: 'them', kind: 'opp' },
    opp3: { label: 'They scored 3', pts: 3, team: 'them', kind: 'opp' }
  };

  // ---------- small helpers ----------
  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  function latestEval(p) { return p && p.evals && p.evals.length ? p.evals[p.evals.length - 1] : null; }
  function firstEval(p) { return p && p.evals && p.evals.length ? p.evals[0] : null; }
  function rating(p, k) { var e = latestEval(p); var v = e && e.r ? e.r[k] : null; return typeof v === 'number' ? v : 2; }
  function isEvaluated(p) { return !!latestEval(p); }
  function strength(p) { var t = 0; for (var i = 0; i < SKILLS.length; i++) t += rating(p, SKILLS[i].k); return t / SKILLS.length; }
  function fit(p, roleKey) { var w = ROLES[roleKey].w, t = 0; for (var k in w) t += w[k] * rating(p, k); return t; }
  function bestRoles(p) {
    var off = OFF_ROLES.map(function (r) { return { r: r, f: fit(p, r) }; }).sort(function (a, b) { return b.f - a.f; });
    var def = DEF_ROLES.map(function (r) { return { r: r, f: fit(p, r) }; }).sort(function (a, b) { return b.f - a.f; });
    return { off: off, def: def };
  }
  function topSkill(p) {
    var best = null, bv = -1;
    SKILLS.forEach(function (s) { var v = rating(p, s.k); if (v > bv) { bv = v; best = s.k; } });
    return best;
  }

  function nShifts(game) { return (game.quarters || 4) * (game.spq || 2); }
  function shiftLabel(game, i, long) {
    var spq = game.spq || 2, q = Math.floor(i / spq) + 1, part = i % spq;
    var qn = (game.quarters || 4) === 2 ? 'H' + q : 'Q' + q;
    if (spq === 1) return qn;
    var parts = spq === 2 ? (long ? ['1st half', '2nd half'] : ['a', 'b']) : (long ? ['1st third', '2nd third', '3rd third'] : ['a', 'b', 'c']);
    return long ? qn + ' · ' + parts[part] : qn + parts[part];
  }
  function lineupOf(game, i) { var s = game.shifts[i]; if (!s) return []; return (s.actual && s.actual.length ? s.actual : s.lineup) || []; }

  // ---------- positions ----------
  function permutations(arr) {
    if (arr.length <= 1) return [arr.slice()];
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var rest = arr.slice(0, i).concat(arr.slice(i + 1));
      var ps = permutations(rest);
      for (var j = 0; j < ps.length; j++) out.push([arr[i]].concat(ps[j]));
    }
    return out;
  }
  // Put each kid on the spot whose role suits them best (maximum total fit).
  function assignSpots(lineupPlayers, side, formKey) {
    var form = FORMATIONS[side][formKey] || FORMATIONS[side][FORM_ORDER[side][0]];
    var spots = form.spots.slice(0, Math.max(lineupPlayers.length, 0));
    var result = {};
    if (!lineupPlayers.length) return result;
    var n = Math.min(lineupPlayers.length, form.spots.length);
    var players = lineupPlayers.slice(0, n);
    var idx = []; for (var i = 0; i < n; i++) idx.push(i);
    var best = null, bestScore = -1;
    var perms = permutations(idx);
    for (var pi = 0; pi < perms.length; pi++) {
      var perm = perms[pi], sc = 0;
      for (var s = 0; s < n; s++) sc += fit(players[perm[s]], spots[s][2]);
      if (sc > bestScore + 1e-9) { bestScore = sc; best = perm; }
    }
    for (var s2 = 0; s2 < n; s2++) {
      var sp = spots[s2];
      result[players[best[s2]].id] = { x: sp[0], y: sp[1], role: sp[2], spot: sp[3] };
    }
    // Extra players beyond 5 (rare) get stacked near half court.
    for (var e = n; e < lineupPlayers.length; e++) result[lineupPlayers[e].id] = { x: 20 + e * 12, y: 20, role: null, spot: 'Extra' };
    return result;
  }
  function positionsFor(game, i, side, roster) {
    var byId = indexRoster(roster);
    var ids = lineupOf(game, i).filter(function (id) { return byId[id]; });
    var formKey = side === 'off' ? game.offForm : game.defForm;
    var base = assignSpots(ids.map(function (id) { return byId[id]; }), side, formKey);
    var shift = game.shifts[i] || {};
    var ov = (side === 'off' ? shift.offPos : shift.defPos) || {};
    ids.forEach(function (id) { if (ov[id]) { base[id] = Object.assign({}, base[id] || {}, { x: ov[id][0], y: ov[id][1], moved: true }); } });
    return base;
  }
  function indexRoster(roster) { var m = {}; (roster || []).forEach(function (p) { m[p.id] = p; }); return m; }

  // ---------- fairness ----------
  function shiftCounts(game, presentIds, useActual) {
    var c = {}; presentIds.forEach(function (id) { c[id] = 0; });
    for (var i = 0; i < nShifts(game); i++) {
      var l = useActual ? lineupOf(game, i) : ((game.shifts[i] || {}).lineup || []);
      l.forEach(function (id) { if (c[id] !== undefined) c[id]++; });
    }
    return c;
  }
  function fairness(game, presentIds, onCourt) {
    var counts = shiftCounts(game, presentIds, false);
    var vals = presentIds.map(function (id) { return counts[id]; });
    var total = nShifts(game) * Math.min(onCourt, presentIds.length);
    var target = presentIds.length ? total / presentIds.length : 0;
    var min = vals.length ? Math.min.apply(null, vals) : 0, max = vals.length ? Math.max.apply(null, vals) : 0;
    var filled = 0, complete = true;
    for (var i = 0; i < nShifts(game); i++) { var len = ((game.shifts[i] || {}).lineup || []).length; filled += len; if (len !== Math.min(onCourt, presentIds.length)) complete = false; }
    return { counts: counts, min: min, max: max, target: target, fair: max - min <= 1, complete: complete, filled: filled, total: total };
  }

  // ---------- rotation builder ----------
  function combos(arr, k, mustSet, cb) {
    var n = arr.length, pick = [];
    function rec(start) {
      if (pick.length === k) { cb(pick); return; }
      for (var i = start; i <= n - (k - pick.length); i++) { pick.push(arr[i]); rec(i + 1); pick.pop(); }
    }
    // put must-play players first and only choose the rest
    var must = arr.filter(function (p) { return mustSet[p.id]; });
    var rest = arr.filter(function (p) { return !mustSet[p.id]; });
    if (must.length >= k) { cb(must.slice(0, k)); return; }
    pick = must.slice();
    var need = k - must.length, m = rest.length, sel = [];
    function rec2(start) {
      if (sel.length === need) { cb(must.concat(sel)); return; }
      for (var i = start; i <= m - (need - sel.length); i++) { sel.push(rest[i]); rec2(i + 1); sel.pop(); }
    }
    rec2(0);
  }

  /* Build a fair rotation.
     players: present roster players. history: {id: shiftsPlayedRecently} (fewer => gets any extra shift).
     Rules: everyone's shift count differs by at most 1; every shift tries to have a ball handler and a rebounder;
     shift strength stays close to the team average so the strongest kids are not stacked; nobody sits twice in a row if avoidable. */
  function buildRotation(players, total, onCourt, history, seed) {
    var n = players.length, k = Math.min(onCourt, n);
    var shifts = [];
    if (!n) { for (var z = 0; z < total; z++) shifts.push([]); return shifts; }
    if (n <= onCourt) { for (var a = 0; a < total; a++) shifts.push(players.map(function (p) { return p.id; })); return shifts; }
    var rand = rng(seed || 7);
    var slots = total * k, base = Math.floor(slots / n), extra = slots - base * n;
    var order = players.slice().sort(function (p, q) {
      var hp = (history && history[p.id]) || 0, hq = (history && history[q.id]) || 0;
      if (hp !== hq) return hp - hq;
      return hashStr(p.id + seed) - hashStr(q.id + seed);
    });
    var quota = {}; order.forEach(function (p, i) { quota[p.id] = base + (i < extra ? 1 : 0); });
    var rem = Object.assign({}, quota);
    var teamStr = players.reduce(function (t, p) { return t + strength(p); }, 0) / n;
    var hf = {}, pf = {}; players.forEach(function (p) { hf[p.id] = fit(p, 'handler'); pf[p.id] = Math.max(fit(p, 'post'), fit(p, 'middle')); });
    var hfSorted = players.map(function (p) { return hf[p.id]; }).sort(function (x, y) { return y - x; });
    var handlerBar = hfSorted[Math.min(hfSorted.length - 1, Math.max(1, Math.round(n / 3)))];
    var sat = {}; // id -> sat previous shift
    for (var s = 0; s < total; s++) {
      var left = total - s;
      var cands = players.filter(function (p) { return rem[p.id] > 0; });
      var must = {}; cands.forEach(function (p) { if (rem[p.id] >= left) must[p.id] = true; });
      var best = null, bestScore = -Infinity;
      combos(cands, Math.min(k, cands.length), must, function (pick) {
        var sc = 0, str = 0, maxH = 0, maxP = 0, ids = {}, nH = 0;
        for (var i = 0; i < pick.length; i++) {
          var p = pick[i]; ids[p.id] = true; if (hf[p.id] >= handlerBar) nH++;
          sc += 3 * (rem[p.id] / left);
          str += strength(p); if (hf[p.id] > maxH) maxH = hf[p.id]; if (pf[p.id] > maxP) maxP = pf[p.id];
        }
        str /= pick.length;
        sc -= 4 * Math.abs(str - teamStr);
        sc += maxH >= handlerBar ? 2.5 : 0;
        if (nH > 1) sc -= 0.8 * (nH - 1); // spread the ball handlers out
        sc += 0.6 * maxP;
        cands.forEach(function (p) { if (!ids[p.id] && sat[p.id]) sc -= 2.0; });
        sc += rand() * 0.05;
        if (sc > bestScore) { bestScore = sc; best = pick.slice(); }
      });
      if (!best) best = cands.slice(0, k);
      var chosen = {}; best.forEach(function (p) { chosen[p.id] = true; rem[p.id]--; });
      players.forEach(function (p) { sat[p.id] = !chosen[p.id]; });
      shifts.push(best.map(function (p) { return p.id; }));
    }
    return shifts;
  }

  // ---------- game math ----------
  function emptyLine() { return { pts: 0, fgm: 0, fga: 0, ftm: 0, fta: 0, reb: 0, stl: 0, ast: 0, hus: 0, to: 0, shifts: 0, pm: 0, onUs: 0, onThem: 0 }; }
  function analyzeGame(game) {
    var N = nShifts(game);
    var shiftScore = []; for (var i = 0; i < N; i++) shiftScore.push({ us: 0, them: 0 });
    var players = {}, teamUnassigned = 0;
    function P(id) { if (!players[id]) players[id] = emptyLine(); return players[id]; }
    (game.events || []).forEach(function (e) {
      var def = EVENTS[e.t]; if (!def) return;
      var ss = shiftScore[e.s] || (shiftScore[e.s] = { us: 0, them: 0 });
      if (def.team === 'them') { ss.them += def.pts; return; }
      ss.us += def.pts;
      if (!e.p) { if (def.pts) teamUnassigned += def.pts; return; }
      var l = P(e.p);
      if (e.t === 'fg2' || e.t === 'fg3') { l.fgm++; l.fga++; l.pts += def.pts; }
      else if (e.t === 'ft') { l.ftm++; l.fta++; l.pts += 1; }
      else if (e.t === 'miss') { l.fga++; }
      else if (l[e.t] !== undefined) l[e.t]++;
    });
    var lineups = {}, pairs = {};
    var played = 0;
    for (var s = 0; s < N; s++) {
      var ids = lineupOf(game, s);
      var sc = shiftScore[s];
      var hasPlay = game.status === 'final' || (game.status === 'live' && s <= (game.cur || 0));
      if (!ids.length || !hasPlay) continue;
      played++;
      var diff = sc.us - sc.them;
      ids.forEach(function (id) { var l = P(id); l.shifts++; l.pm += diff; l.onUs += sc.us; l.onThem += sc.them; });
      var key = ids.slice().sort().join('|');
      var L = lineups[key] || (lineups[key] = { ids: ids.slice().sort(), shifts: [], us: 0, them: 0, pm: 0 });
      L.shifts.push(s); L.us += sc.us; L.them += sc.them; L.pm += diff;
      for (var a = 0; a < ids.length; a++) for (var b = a + 1; b < ids.length; b++) {
        var pk = [ids[a], ids[b]].sort().join('|');
        var PR = pairs[pk] || (pairs[pk] = { ids: [ids[a], ids[b]].sort(), shifts: 0, us: 0, them: 0, pm: 0 });
        PR.shifts++; PR.us += sc.us; PR.them += sc.them; PR.pm += diff;
      }
    }
    var us = 0, them = 0; shiftScore.forEach(function (x) { us += x.us; them += x.them; });
    var byQuarter = []; var spq = game.spq || 2;
    for (var q = 0; q < (game.quarters || 4); q++) { var u = 0, t = 0; for (var j = 0; j < spq; j++) { var x = shiftScore[q * spq + j]; if (x) { u += x.us; t += x.them; } } byQuarter.push({ us: u, them: t }); }
    return { shiftScore: shiftScore, players: players, lineups: Object.keys(lineups).map(function (k) { return lineups[k]; }), pairs: Object.keys(pairs).map(function (k) { return pairs[k]; }), us: us, them: them, byQuarter: byQuarter, teamUnassigned: teamUnassigned, shiftsPlayed: played };
  }

  function analyzeSeason(games) {
    var finals = games.filter(function (g) { return g.status === 'final'; }).sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); });
    var players = {}, pairs = {}, lineups = {}, record = { w: 0, l: 0, t: 0 }, pf = 0, pa = 0;
    var perGame = [];
    finals.forEach(function (g) {
      var A = analyzeGame(g); perGame.push({ game: g, a: A });
      pf += A.us; pa += A.them;
      if (A.us > A.them) record.w++; else if (A.us < A.them) record.l++; else record.t++;
      Object.keys(A.players).forEach(function (id) {
        var src = A.players[id], dst = players[id] || (players[id] = Object.assign(emptyLine(), { games: 0, gameLines: [] }));
        for (var k in src) if (typeof src[k] === 'number') dst[k] += src[k];
        dst.games++; dst.gameLines.push({ gameId: g.id, date: g.date, opp: g.opponent, line: src });
      });
      (g.present || []).forEach(function (id) { var d = players[id] || (players[id] = Object.assign(emptyLine(), { games: 0, gameLines: [] })); d.attended = (d.attended || 0) + 1; });
      A.pairs.forEach(function (p) { var k = p.ids.join('|'); var d = pairs[k] || (pairs[k] = { ids: p.ids, shifts: 0, us: 0, them: 0, pm: 0 }); d.shifts += p.shifts; d.us += p.us; d.them += p.them; d.pm += p.pm; });
      A.lineups.forEach(function (p) { var k = p.ids.join('|'); var d = lineups[k] || (lineups[k] = { ids: p.ids, shifts: 0, us: 0, them: 0, pm: 0 }); d.shifts += p.shifts.length; d.us += p.us; d.them += p.them; d.pm += p.pm; });
    });
    return { games: finals, perGame: perGame, players: players, pairs: Object.keys(pairs).map(function (k) { return pairs[k]; }), lineups: Object.keys(lineups).map(function (k) { return lineups[k]; }), record: record, pf: pf, pa: pa };
  }

  // Badges kids can earn in a single game (positive only).
  var BADGES = [
    { k: 'glass', name: 'Glass Cleaner', test: function (l) { return l.reb >= 3; }, desc: '3+ rebounds in a game' },
    { k: 'pick', name: 'Pickpocket', test: function (l) { return l.stl >= 2; }, desc: '2+ steals in a game' },
    { k: 'mate', name: 'Great Teammate', test: function (l) { return l.ast >= 2; }, desc: '2+ assists in a game' },
    { k: 'hustle', name: 'Hustle Hero', test: function (l) { return l.hus >= 2; }, desc: '2+ hustle plays in a game' },
    { k: 'bucket', name: 'Bucket Getter', test: function (l) { return l.fgm >= 2; }, desc: '2+ baskets in a game' },
    { k: 'shooter', name: 'Brave Shooter', test: function (l) { return l.fga >= 3; }, desc: 'Took 3+ shots in a game' }
  ];
  function badgesFor(seasonLine) {
    var out = {};
    if (!seasonLine) return [];
    (seasonLine.gameLines || []).forEach(function (gl) { BADGES.forEach(function (b) { if (b.test(gl.line)) out[b.k] = (out[b.k] || 0) + 1; }); });
    if (seasonLine.gameLines && seasonLine.gameLines.some(function (gl) { return gl.line.fgm > 0; })) out.first = out.first || 1;
    return BADGES.filter(function (b) { return out[b.k]; }).map(function (b) { return { k: b.k, name: b.name, desc: b.desc, n: out[b.k] }; });
  }

  // Practice focus: lowest skill, nudged by what the stats show.
  function practiceFocus(p, seasonLine) {
    var scores = {};
    SKILLS.forEach(function (s) { scores[s.k] = rating(p, s.k); });
    if (seasonLine && seasonLine.games) {
      var g = seasonLine.games;
      if (seasonLine.to / g >= 2) scores.drib -= 0.6, scores.pass -= 0.3;
      if (seasonLine.fga / g < 1) scores.conf -= 0.4;
      if (seasonLine.fga >= 4 && seasonLine.fgm / Math.max(1, seasonLine.fga) < 0.2) scores.shoot -= 0.4;
      if (seasonLine.reb / g < 0.5) scores.reb -= 0.2;
    }
    var ks = SKILLS.map(function (s) { return s.k; }).sort(function (a, b) { return scores[a] - scores[b]; });
    return ks[0];
  }
  function teamFocus(roster, season) {
    var avg = {};
    SKILLS.forEach(function (s) { var t = 0; roster.forEach(function (p) { t += rating(p, s.k); }); avg[s.k] = roster.length ? t / roster.length : 2; });
    var adj = Object.assign({}, avg);
    if (season && season.games.length) {
      var G = season.games.length, tot = emptyLine();
      Object.keys(season.players).forEach(function (id) { var l = season.players[id]; for (var k in tot) if (typeof l[k] === 'number') tot[k] += l[k]; });
      if (tot.to / G >= 8) { adj.drib -= 0.4; adj.pass -= 0.3; }
      if (tot.ast / G < 3) { adj.pass -= 0.2; adj.space -= 0.2; }
      if (tot.reb / G < 10) adj.reb -= 0.3;
      if (tot.fga && tot.fgm / tot.fga < 0.25) adj.shoot -= 0.2;
    }
    var order = SKILLS.map(function (s) { return s.k; }).sort(function (a, b) { return adj[a] - adj[b]; });
    return { avg: avg, order: order };
  }

  // Example data generator so the app opens in a realistic working state.
  function exampleState() {
    var r = rng(20261114);
    var names = [['Harper', '1', 'girl-1'], ['Nora', '4', 'girl-5'], ['Quinn', '7', 'girl-2'], ['Gemma', '10', 'girl-3'], ['Rose', '12', 'girl-4'], ['Lila', '15', 'girl-2'], ['Maya', '22', 'girl-3'], ['Ava', '24', 'girl-1'], ['Zoe', '30', 'girl-5']];
    var profiles = [
      { drib: 4, pass: 3, shoot: 3, def: 2, reb: 2, space: 3, hustle: 3, conf: 4 },
      { drib: 3, pass: 3, shoot: 2, def: 3, reb: 2, space: 3, hustle: 4, conf: 3 },
      { drib: 2, pass: 2, shoot: 3, def: 2, reb: 3, space: 2, hustle: 2, conf: 2 },
      { drib: 2, pass: 2, shoot: 2, def: 3, reb: 4, space: 2, hustle: 3, conf: 2 },
      { drib: 1, pass: 2, shoot: 2, def: 2, reb: 3, space: 1, hustle: 3, conf: 1 },
      { drib: 2, pass: 3, shoot: 2, def: 3, reb: 2, space: 3, hustle: 2, conf: 2 },
      { drib: 1, pass: 1, shoot: 1, def: 2, reb: 2, space: 2, hustle: 4, conf: 2 },
      { drib: 3, pass: 2, shoot: 3, def: 2, reb: 2, space: 2, hustle: 2, conf: 3 },
      { drib: 2, pass: 2, shoot: 1, def: 4, reb: 3, space: 2, hustle: 3, conf: 2 }
    ];
    var early = '2026-10-04', recent = '2026-11-08';
    var roster = names.map(function (n, i) {
      var later = profiles[i], before = {};
      Object.keys(later).forEach(function (k) { before[k] = Math.max(1, later[k] - (r() < 0.35 ? 1 : 0)); });
      return { id: 'ex' + i, name: n[0], number: n[1], avatarId: n[2], evals: [{ date: early, r: before }, { date: recent, r: later }] };
    });
    var team = { name: 'Wildcats', season: 'Winter 2026', settings: { onCourt: 5, quarters: 4, spq: 2 }, roster: roster, updatedAt: 1 };
    function mkGame(id, opp, date, seed, present) {
      var g = { id: id, opponent: opp, date: date, status: 'plan', quarters: 4, spq: 2, offForm: '5out', defForm: '23', present: present, shifts: [], tips: {}, events: [], cur: 0, notes: '', updatedAt: 1 };
      var ps = roster.filter(function (p) { return present.indexOf(p.id) >= 0; });
      var rot = buildRotation(ps, 8, 5, {}, seed);
      g.shifts = rot.map(function (l) { return { lineup: l, note: '' }; });
      return g;
    }
    function simulate(g, seed, oppStrength) {
      var rr = rng(seed), t = 0;
      var byId = indexRoster(roster);
      for (var s = 0; s < 8; s++) {
        var ids = g.shifts[s].lineup, ps = ids.map(function (id) { return byId[id]; });
        var str = ps.reduce(function (a, p) { return a + strength(p); }, 0) / ps.length;
        var poss = 4;
        for (var k = 0; k < poss; k++) {
          // our possession
          var hander = ps[Math.floor(rr() * ps.length)];
          if (rr() < 0.32 - 0.05 * (rating(hander, 'drib') - 2)) { g.events.push({ id: 'e' + (t++), s: s, p: hander.id, t: 'to', at: t }); }
          else {
            var shooter = ps.slice().sort(function (a, b) { return (rating(b, 'conf') + rr() * 2.2) - (rating(a, 'conf') + rr() * 2.2); })[0];
            var makeP = 0.24 + 0.08 * (rating(shooter, 'shoot') - 1) + 0.04 * (str - 2.2);
            if (rr() < makeP) {
              g.events.push({ id: 'e' + (t++), s: s, p: shooter.id, t: 'fg2', at: t });
              if (rr() < 0.4) { var passer = ps[Math.floor(rr() * ps.length)]; if (passer.id !== shooter.id) g.events.push({ id: 'e' + (t++), s: s, p: passer.id, t: 'ast', at: t }); }
            } else {
              g.events.push({ id: 'e' + (t++), s: s, p: shooter.id, t: 'miss', at: t });
              var reb = ps.slice().sort(function (a, b) { return (rating(b, 'reb') + rr() * 2) - (rating(a, 'reb') + rr() * 2); })[0];
              if (rr() < 0.45) g.events.push({ id: 'e' + (t++), s: s, p: reb.id, t: 'reb', at: t });
            }
          }
          // their possession
          var stopP = 0.64 + 0.07 * (str - 2.2) - oppStrength;
          if (rr() > stopP) g.events.push({ id: 'e' + (t++), s: s, p: null, t: rr() < 0.15 ? 'opp1' : 'opp2', at: t });
          else {
            var d = ps.slice().sort(function (a, b) { return (rating(b, 'def') + rating(b, 'hustle') + rr() * 3) - (rating(a, 'def') + rating(a, 'hustle') + rr() * 3); })[0];
            var roll = rr();
            if (roll < 0.25) g.events.push({ id: 'e' + (t++), s: s, p: d.id, t: 'stl', at: t });
            else if (roll < 0.6) g.events.push({ id: 'e' + (t++), s: s, p: d.id, t: 'reb', at: t });
            else if (roll < 0.72) g.events.push({ id: 'e' + (t++), s: s, p: d.id, t: 'hus', at: t });
          }
        }
      }
      g.status = 'final'; g.cur = 7;
      return g;
    }
    var all = roster.map(function (p) { return p.id; });
    var g1 = simulate(mkGame('exg1', 'Eagles', '2026-10-25', 11, all.filter(function (id) { return id !== 'ex8'; })), 101, -0.15);
    var g2 = simulate(mkGame('exg2', 'Tigers', '2026-11-01', 23, all), 202, 0.0);
    var g3 = simulate(mkGame('exg3', 'Comets', '2026-11-08', 37, all.filter(function (id) { return id !== 'ex5'; })), 303, -0.1);
    var g4 = mkGame('exg4', 'Falcons', '2026-11-15', 41, all);
    g4.tips = { ex4: 'Hands up on defense!', ex6: 'Sprint back after every shot' };
    g4.shifts[0].note = 'Start in the 2-3 zone. Talk on defense.';
    var games = {}; [g1, g2, g3, g4].forEach(function (g) { games[g.id] = g; });
    return { team: team, games: games };
  }

  return {
    SKILLS: SKILLS, LEVELS: LEVELS, SUPERPOWER: SUPERPOWER, MISSION: MISSION, DRILLS: DRILLS, ROLES: ROLES, OFF_ROLES: OFF_ROLES, DEF_ROLES: DEF_ROLES,
    FORMATIONS: FORMATIONS, FORM_ORDER: FORM_ORDER, EVENTS: EVENTS, BADGES: BADGES,
    uid: uid, clamp: clamp, hashStr: hashStr, rng: rng,
    latestEval: latestEval, firstEval: firstEval, rating: rating, isEvaluated: isEvaluated, strength: strength, fit: fit, bestRoles: bestRoles, topSkill: topSkill,
    nShifts: nShifts, shiftLabel: shiftLabel, lineupOf: lineupOf, assignSpots: assignSpots, positionsFor: positionsFor, indexRoster: indexRoster,
    shiftCounts: shiftCounts, fairness: fairness, buildRotation: buildRotation,
    analyzeGame: analyzeGame, analyzeSeason: analyzeSeason, badgesFor: badgesFor, practiceFocus: practiceFocus, teamFocus: teamFocus,
    exampleState: exampleState, emptyLine: emptyLine
  };
})();
if (typeof module !== 'undefined') module.exports = CC;
