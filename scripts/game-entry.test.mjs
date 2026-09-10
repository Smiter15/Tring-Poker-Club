import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateResults,
  availablePlayers,
  londonToday,
} from '../src/utils/gameEntry.ts';
const entry = (count = 10) => ({
  season_id: 7,
  season_game: 1,
  played_on: '2026-09-09',
  players: Array.from({ length: count }, (_, i) => i + 1),
  knockouts: Array.from({ length: count - 1 }, (_, i) => ({
    killer_id: 1,
    victim_id: count - i,
  })),
});
test('ten players finish in knockout order with zero beyond eighth', () => {
  const result = calculateResults(entry());
  assert.deepEqual(
    result.map((r) => r.points),
    [100, 80, 65, 55, 50, 45, 40, 35, 0, 0],
  );
  assert.deepEqual(
    result.map((r) => r.player_id),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
});
test('heads up game awards 100 and 80', () =>
  assert.deepEqual(
    calculateResults(entry(2)).map((r) => r.points),
    [100, 80],
  ));
test('a knocked out player cannot eliminate someone later', () => {
  const data = entry(3);
  data.knockouts[1].killer_id = 3;
  assert.throws(() => calculateResults(data), /Knockout 2/);
  assert.deepEqual(availablePlayers(data, 1), [1, 2]);
});
test('reject invalid, incomplete and historic entries', () => {
  for (const change of [
    { players: [1, 1] },
    { knockouts: [] },
    { season_id: 6 },
    { season_game: 0 },
    { played_on: '2026-02-30' },
    { played_on: '2099-01-01' },
  ])
    assert.throws(() => calculateResults({ ...entry(), ...change }));
  const data = entry(2);
  data.knockouts[0].victim_id = 1;
  assert.throws(() => calculateResults(data), /Knockout 1/);
});
test('game date uses London midnight including daylight saving', () => {
  assert.equal(londonToday(new Date('2026-09-09T23:30:00Z')), '2026-09-10');
  assert.equal(londonToday(new Date('2026-12-09T23:30:00Z')), '2026-12-09');
});
