type Game = { id: number; season_game: number; played_on: string };
type Result = { game_id: number; player_id: number; points: number };
type Player = { id: number; label: string; avatarUrl?: string };

/** Use game/player IDs to align scores, including absences and zero-point finishes. */
export function buildSeasonProgress(
  games: Game[],
  results: Result[],
  players: Player[],
) {
  const orderedGames = [...games].sort((a, b) => a.season_game - b.season_game);
  const gameIds = new Set(orderedGames.map((game) => game.id));
  const pointsByPlayer = new Map<number, Map<number, number>>();

  for (const result of results) {
    if (!gameIds.has(result.game_id)) {
      throw new Error(
        `Result references a game outside this season: ${result.game_id}`,
      );
    }
    if (!Number.isFinite(result.points)) {
      throw new Error(`Invalid points for player ${result.player_id}`);
    }
    const points =
      pointsByPlayer.get(result.player_id) ?? new Map<number, number>();
    if (points.has(result.game_id)) {
      throw new Error(
        `Duplicate result for game ${result.game_id}, player ${result.player_id}`,
      );
    }
    points.set(result.game_id, result.points);
    pointsByPlayer.set(result.player_id, points);
  }

  const playerIds = new Set(players.map((player) => player.id));
  for (const id of pointsByPlayer.keys()) {
    if (!playerIds.has(id)) throw new Error(`Missing player details for ${id}`);
  }

  return {
    labels: orderedGames.map((game) => {
      const [year, month, day] = game.played_on.slice(0, 10).split('-');
      return `${day}/${month}/${year}`;
    }),
    datasets: players.map((player) => {
      let total = 0;
      return {
        label: player.label,
        avatarUrl: player.avatarUrl,
        data: orderedGames.map((game) => {
          total += pointsByPlayer.get(player.id)?.get(game.id) ?? 0;
          return total;
        }),
      };
    }),
  };
}
