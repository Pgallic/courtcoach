// Run with: node tests/logic.test.js
const assert = require('assert');
global.CC = require('../src/logic.js');
const CCP = require('../src/plays.js');

const state = CCP.decorateExample(CC.exampleState());
const roster = state.team.roster;
const byId = CC.indexRoster(roster);
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok -', name); }

test('fair rotation: shift counts differ by at most 1 and every shift is full', () => {
  for (const g of Object.values(state.games)) {
    const f = CC.fairness(g, g.present, 5);
    assert.ok(f.fair, g.opponent + ' is not fair');
    assert.ok(f.complete, g.opponent + ' has a short shift');
  }
});

test('rotation works for small and large rosters', () => {
  const four = CC.buildRotation(roster.slice(0, 4), 8, 5, {}, 1);
  assert.ok(four.every((l) => l.length === 4));
  const twelve = roster.concat(roster.slice(0, 3).map((p, i) => ({ ...p, id: 'x' + i })));
  const r = CC.buildRotation(twelve, 8, 5, {}, 2);
  assert.ok(r.every((l) => l.length === 5));
  const counts = twelve.map((p) => r.filter((l) => l.includes(p.id)).length);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
});

test('formations put five kids on five different spots', () => {
  const g = state.games.exg4;
  for (const off of CC.FORM_ORDER.off) {
    g.offForm = off;
    const pos = CC.positionsFor(g, 0, 'off', roster);
    assert.strictEqual(new Set(Object.values(pos).map((p) => p.spot)).size, 5, off);
  }
});

test('game analysis adds up', () => {
  const A = CC.analyzeGame(state.games.exg1);
  const shiftTotal = A.shiftScore.reduce((t, s) => t + s.us, 0);
  assert.strictEqual(shiftTotal, A.us);
  const playerPts = Object.values(A.players).reduce((t, l) => t + l.pts, 0);
  assert.strictEqual(playerPts + A.teamUnassigned, A.us);
});

test('every starter play is valid and fills five roles', () => {
  const five = CC.lineupOf(state.games.exg4, 0).map((id) => byId[id]);
  for (const p of CCP.STARTER) {
    p.roles.forEach((r) => assert.ok(p.start[r.key], p.id + ' missing start for ' + r.key));
    const cast = CCP.castPlay(p, five);
    assert.strictEqual(new Set(Object.values(cast).filter(Boolean)).size, 5, p.id);
    for (let k = 0; k < p.steps.length; k++) CCP.arrows(p, k).forEach((a) => assert.ok(['cut', 'screen', 'dribble', 'pass'].includes(a.kind)));
  }
});

test('plays from Claude are cleaned up safely', () => {
  const n = CCP.normalizePlay({ name: 'X', roles: [{ key: 'a', type: 'nope' }, { key: 'a' }], start: { a: [500, -9] }, steps: [{ say: 'go', moves: { a: [1, 1], zz: [2, 2] }, ball: 'q' }] });
  assert.strictEqual(n.roles.length, 1);
  assert.strictEqual(n.roles[0].type, 'cut');
  assert.deepStrictEqual(n.start.a, [104, 1]);
  assert.deepStrictEqual(Object.keys(n.steps[0].moves), ['a']);
  assert.strictEqual(n.steps[0].ball, null);
});

test('sub helper lists who comes out and goes in', () => {
  const ch = CCP.changeAt(state.games.exg4, 0);
  assert.strictEqual(ch.out.length, ch.inn.length);
  ch.inn.forEach((id) => assert.ok(!CC.lineupOf(state.games.exg4, 0).includes(id)));
});

test('weeks start on Monday', () => {
  assert.strictEqual(CCP.mondayOf('2026-11-14'), '2026-11-09');
  assert.strictEqual(CCP.mondayOf('2026-11-16'), '2026-11-16');
  assert.strictEqual(CCP.shiftWeek('2026-11-09', 1), '2026-11-16');
});

test('parent recap names every kid who played and skips turnovers', () => {
  const g = state.games.exg3;
  const txt = CCP.parentRecap(state.team, g, CC.analyzeGame(g), null, null, 'pass');
  g.present.forEach((id) => assert.ok(txt.includes(byId[id].name)));
  assert.ok(!/turnover/i.test(txt));
});

console.log(`\n${passed} tests passed`);
