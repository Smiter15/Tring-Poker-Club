import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSeasonProgress } from '../src/utils/seasonProgress.ts';

test('orders games and carries points across absences and zero-point finishes', () => {
  const result = buildSeasonProgress(
    [
      { id: 90, season_game: 3, played_on: '2026-09-23' },
      { id: 70, season_game: 1, played_on: '2026-09-09' },
      { id: 80, season_game: 2, played_on: '2026-09-16' },
    ],
    [
      { game_id: 90, player_id: 1, points: 65 },
      { game_id: 70, player_id: 1, points: 100 },
      { game_id: 80, player_id: 2, points: 0 },
      { game_id: 90, player_id: 2, points: 80 },
      { game_id: 70, player_id: 3, points: 0 },
    ],
    [{ id: 1, label: 'Alex' }, { id: 2, label: 'Alex' }, { id: 3, label: 'Sam' }],
  );
  assert.deepEqual(result.labels, ['09/09/2026', '16/09/2026', '23/09/2026']);
  assert.deepEqual(result.datasets.map((row) => row.data), [[100, 100, 165], [0, 0, 80], [0, 0, 0]]);
});

test('supports an empty new season and preserves historical scoring', () => {
  assert.deepEqual(buildSeasonProgress([], [], []), { labels: [], datasets: [] });
  const result = buildSeasonProgress(
    [{ id: 1, season_game: 1, played_on: '2024-04-10' }],
    [{ game_id: 1, player_id: 1, points: 10 }],
    [{ id: 1, label: 'Player' }],
  );
  assert.deepEqual(result.datasets[0].data, [10]);
});

test('does not silently double-count or drop invalid results', () => {
  const games = [{ id: 1, season_game: 1, played_on: '2024-04-10' }];
  const players = [{ id: 1, label: 'Player' }];
  const row = { game_id: 1, player_id: 1, points: 10 };
  assert.throws(() => buildSeasonProgress(games, [row, row], players), /Duplicate/);
  assert.throws(() => buildSeasonProgress(games, [{ ...row, game_id: 2 }], players), /outside this season/);
  assert.throws(() => buildSeasonProgress(games, [row], []), /Missing player/);
  assert.throws(() => buildSeasonProgress(games, [{ ...row, points: NaN }], players), /Invalid points/);
});
