export type Knockout = { killer_id: number | null; victim_id: number | null };
export type GameEntry = {
  season_id: number;
  season_game: number;
  played_on: string;
  players: number[];
  knockouts: Knockout[];
};
export type Finish = { player_id: number; place: number; points: number };
export const POINTS = [100, 80, 65, 55, 50, 45, 40, 35];

export function londonToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Client preview only; the database independently validates and scores every save. */
export function calculateResults(entry: GameEntry): Finish[] {
  if (!Number.isInteger(entry.season_id) || entry.season_id < 7)
    throw new Error('Choose Season 7 or a later season.');
  if (
    !Number.isInteger(entry.season_game) ||
    entry.season_game < 1 ||
    entry.season_game > 10000
  )
    throw new Error('Enter a valid game number.');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(entry.played_on) ||
    !Number.isFinite(Date.parse(entry.played_on)) ||
    new Date(entry.played_on).toISOString().slice(0, 10) !== entry.played_on ||
    entry.played_on > londonToday()
  )
    throw new Error('Choose a valid date on or before today.');
  if (
    entry.players.length < 2 ||
    new Set(entry.players).size !== entry.players.length ||
    entry.players.some((id) => !Number.isInteger(id) || id <= 0)
  )
    throw new Error('Select at least two different players.');
  if (entry.knockouts.length !== entry.players.length - 1)
    throw new Error(
      'Record every knockout, starting with the first player out.',
    );
  const alive = new Set(entry.players);
  const results: Finish[] = [];
  entry.knockouts.forEach((ko, index) => {
    if (
      !ko.killer_id ||
      !ko.victim_id ||
      ko.killer_id === ko.victim_id ||
      !alive.has(ko.killer_id) ||
      !alive.has(ko.victim_id)
    )
      throw new Error(
        `Knockout ${index + 1}: select two different players who are still in the game.`,
      );
    const place = entry.players.length - index;
    results.push({
      player_id: ko.victim_id,
      place,
      points: POINTS[place - 1] ?? 0,
    });
    alive.delete(ko.victim_id);
  });
  results.push({ player_id: [...alive][0], place: 1, points: 100 });
  return results.sort((a, b) => a.place - b.place);
}

export function availablePlayers(entry: GameEntry, row: number) {
  const out = new Set(entry.knockouts.slice(0, row).map((ko) => ko.victim_id));
  return entry.players.filter((id) => !out.has(id));
}
