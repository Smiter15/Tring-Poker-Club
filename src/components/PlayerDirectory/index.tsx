import { useDeferredValue, useState } from 'react';
import PlayerAvatar from '@components/PlayerAvatar';
import styles from './PlayerDirectory.module.css';

type Player = {
  slug: string;
  firstName: string;
  lastName: string;
  nickname?: string | null;
  imageUrl?: string | null;
  gamesPlayed: number;
  wins: number;
  seasonWins: number;
};

type Props = { players: Player[] };
type Filter = 'all' | 'season-champions' | 'game-winners';
type Sort = 'name' | 'games' | 'wins' | 'season-wins';

export default function PlayerDirectory({ players }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('name');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const visiblePlayers = players
    .filter((player) => {
      const searchableName =
        `${player.firstName} ${player.lastName} ${player.nickname ?? ''}`.toLowerCase();
      const matchesSearch = searchableName.includes(deferredQuery);
      const matchesFilter =
        filter === 'all' ||
        (filter === 'season-champions' && player.seasonWins > 0) ||
        (filter === 'game-winners' && player.wins > 0);
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      if (sort === 'games') return b.gamesPlayed - a.gamesPlayed;
      if (sort === 'wins') return b.wins - a.wins;
      if (sort === 'season-wins') return b.seasonWins - a.seasonWins;
      return `${a.firstName} ${a.lastName}`.localeCompare(
        `${b.firstName} ${b.lastName}`,
      );
    });

  return (
    <div>
      <div className={styles.controls}>
        <div className={styles.field}>
          <label htmlFor="player-search">Search players</label>
          <input
            id="player-search"
            className={styles.search}
            type="search"
            placeholder="Search by name or nickname"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <span className={styles.searchIcon} aria-hidden="true">
            ⌕
          </span>
        </div>

        <div className={styles.field}>
          <label htmlFor="player-filter">Filter players</label>
          <select
            id="player-filter"
            className={styles.select}
            value={filter}
            onChange={(event) => setFilter(event.target.value as Filter)}
          >
            <option value="all">All players</option>
            <option value="season-champions">Season champions</option>
            <option value="game-winners">Game winners</option>
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="player-sort">Sort players</label>
          <select
            id="player-sort"
            className={styles.select}
            value={sort}
            onChange={(event) => setSort(event.target.value as Sort)}
          >
            <option value="name">Sort: name</option>
            <option value="games">Sort: games</option>
            <option value="wins">Sort: game wins</option>
            <option value="season-wins">Sort: season titles</option>
          </select>
        </div>
      </div>

      <p className={styles.summary} aria-live="polite">
        Showing {visiblePlayers.length} of {players.length} players
      </p>

      {visiblePlayers.length ? (
        <div className={styles.grid}>
          {visiblePlayers.map((player) => {
            const fullName = `${player.firstName} ${player.lastName}`.trim();
            return (
              <a
                className={`card card-link ${styles.card}`}
                href={`/players/${player.slug}`}
                key={player.slug}
              >
                <PlayerAvatar
                  firstName={player.firstName}
                  lastName={player.lastName}
                  imageUrl={player.imageUrl}
                  size="lg"
                  champion={player.seasonWins > 0}
                />
                <h2>{fullName}</h2>
                <span className={styles.nickname}>
                  {player.nickname ? `“${player.nickname}”` : 'TPC player'}
                </span>
                {player.seasonWins > 0 && (
                  <span className={styles.championBadge}>
                    ♛ {player.seasonWins}{' '}
                    {player.seasonWins === 1 ? 'season title' : 'season titles'}
                  </span>
                )}
                <div className={styles.stats}>
                  <div>
                    <strong>{player.gamesPlayed}</strong>
                    <span>Games</span>
                  </div>
                  <div>
                    <strong>{player.wins}</strong>
                    <span>Game wins</span>
                  </div>
                  <div>
                    <strong>{player.seasonWins}</strong>
                    <span>Titles</span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        <div className={`card ${styles.empty}`}>
          <strong>No matching players</strong>
          <span>Try a different search or filter.</span>
        </div>
      )}
    </div>
  );
}
