import { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCrown } from '@fortawesome/free-solid-svg-icons';
import styles from './SeasonReplayLeaderboard.module.css';

export interface SeasonReplayLeaderboardProps {
  labels: string[]; // Game 1..N (played so far)
  datasets: { label: string; data: number[]; avatarUrl?: string }[]; // cumulative points
  initialGameIndex?: number; // default last game

  metaByLabel?: Record<
    string,
    {
      games?: number;
      avgPoints?: number;
      emojis?: string;
    }
  >;

  // tie-aware final standings place (e.g. 1,2,2,4...)
  placeByLabel?: Record<string, number | undefined>;
}

type Row = {
  label: string;
  points: number;
  rank: number; // computed rank for that game (dense ranking)
  deltaRank: number; // + means moved up (better), - means moved down
  avatarUrl?: string;
};

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

const SEASON_WEEKS = 15;

export default function SeasonReplayLeaderboard({
  labels,
  datasets,
  initialGameIndex,
  metaByLabel = {},
  placeByLabel = {},
}: SeasonReplayLeaderboardProps) {
  const playedGames = labels.length;
  const maxGameIndex = Math.max(0, playedGames - 1);

  const [gameIndex, setGameIndex] = useState<number>(
    initialGameIndex ?? maxGameIndex,
  );
  const [pinned, setPinned] = useState<string | null>(null);

  const { rowsByGame } = useMemo(() => {
    const numGames = labels.length;

    const pointsByGame: Array<
      Array<{ label: string; points: number; avatarUrl?: string }>
    > = Array.from({ length: numGames }, () => []);

    datasets.forEach((ds) => {
      for (let i = 0; i < numGames; i++) {
        pointsByGame[i].push({
          label: ds.label,
          points: ds.data[i] ?? 0,
          avatarUrl: ds.avatarUrl,
        });
      }
    });

    const ranksByGame: Array<Map<string, number>> = Array.from(
      { length: numGames },
      () => new Map(),
    );

    for (let i = 0; i < numGames; i++) {
      const sorted = pointsByGame[i]
        .slice()
        .sort((a, b) => b.points - a.points || a.label.localeCompare(b.label));

      sorted.forEach((p, idx) => {
        // dense ranking for replay; tie-aware only on final via placeByLabel
        ranksByGame[i].set(p.label, idx + 1);
      });
    }

    const rows: Row[][] = Array.from({ length: numGames }, (_, i) => {
      const sorted = pointsByGame[i]
        .slice()
        .sort((a, b) => b.points - a.points || a.label.localeCompare(b.label));

      return sorted.map((p) => {
        const rank = ranksByGame[i].get(p.label)!;
        const prevRank = i > 0 ? ranksByGame[i - 1].get(p.label)! : rank;
        const deltaRank = prevRank - rank;

        return {
          label: p.label,
          points: p.points,
          rank,
          deltaRank,
          avatarUrl: p.avatarUrl,
        };
      });
    });

    return { rowsByGame: rows };
  }, [datasets, labels.length]);

  const rows = rowsByGame[gameIndex] ?? [];
  const isFinalPlayedGame = gameIndex === playedGames - 1;

  const pinnedRow = pinned ? rows.find((r) => r.label === pinned) : undefined;
  const pinnedMeta = pinnedRow ? metaByLabel[pinnedRow.label] : undefined;

  const pinnedDisplayRank =
    pinnedRow && isFinalPlayedGame && placeByLabel[pinnedRow.label] != null
      ? (placeByLabel[pinnedRow.label] as number)
      : pinnedRow?.rank;

  const showSeasonHint = SEASON_WEEKS > playedGames;

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Replay the season</div>

          {/* Changed copy to avoid implying the season is finished */}
          <div className={styles.subTitle}>
            Week {gameIndex + 1} of {SEASON_WEEKS}
            {showSeasonHint ? (
              <span style={{ opacity: 0.8 }}>
                {' '}
                · {playedGames} played so far
              </span>
            ) : null}
          </div>
        </div>

        {pinnedRow ? (
          <div className={styles.pinnedSummary}>
            <div className={styles.pinnedNameRow}>
              {pinnedRow.avatarUrl ? (
                <img
                  src={pinnedRow.avatarUrl}
                  alt=""
                  className={styles.pinnedAvatar}
                />
              ) : null}
              <span>{pinnedRow.label}</span>
            </div>

            <div className={styles.pinnedMeta}>
              {pinnedDisplayRank ? ordinal(pinnedDisplayRank) : ''} ·{' '}
              {pinnedRow.points} pts
              {typeof pinnedMeta?.games === 'number' ? (
                <> · {pinnedMeta.games} games</>
              ) : null}
              {typeof pinnedMeta?.avgPoints === 'number' ? (
                <> · avg {pinnedMeta.avgPoints}</>
              ) : null}
              {gameIndex > 0 ? (
                <>
                  {' '}
                  ·{' '}
                  <DeltaBadge deltaRank={pinnedRow.deltaRank} compact={false} />
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className={styles.sliderBlock}>
        <input
          className={styles.slider}
          type="range"
          min={0}
          max={maxGameIndex}
          value={gameIndex}
          onChange={(e) => setGameIndex(Number(e.target.value))}
        />
        <div className={styles.sliderLabels}>
          <span>Week 1</span>
          <span>Week {playedGames}</span>
        </div>
      </div>

      <div className={styles.boardHeader}>
        <div className={styles.boardTitle}>Leaderboard</div>
        <div className={styles.boardMeta}>
          Click a player to pin · Showing all {rows.length}
        </div>
      </div>

      <div className={styles.colHeader}>
        <div className={styles.colRank}>#</div>
        <div className={styles.colPlayer}>Player</div>
        <div className={styles.colGames}>Games</div>
        <div className={styles.colAvg}>Avg</div>
        <div className={styles.colPts}>Pts</div>
        <div className={styles.colMove}>Move</div>
      </div>

      <div className={styles.board}>
        {rows.map((r) => {
          const isPinned = pinned === r.label;
          const meta = metaByLabel[r.label] ?? {};

          const displayRank =
            isFinalPlayedGame && placeByLabel[r.label] != null
              ? (placeByLabel[r.label] as number)
              : r.rank;

          return (
            <button
              key={r.label}
              onClick={() => setPinned(isPinned ? null : r.label)}
              className={`${styles.rowButton} ${
                isPinned ? styles.rowPinned : ''
              }`}
              type="button"
            >
              <div className={styles.rank}>{displayRank}</div>

              <div className={styles.playerCell}>
                <div className={styles.avatarWrap}>
                  {displayRank === 1 ? (
                    <FontAwesomeIcon
                      icon={faCrown}
                      className={styles.crownIcon}
                    />
                  ) : null}

                  {r.avatarUrl ? (
                    <img src={r.avatarUrl} alt="" className={styles.avatar} />
                  ) : (
                    <div className={styles.avatarPlaceholder} />
                  )}
                </div>

                <div className={styles.nameBlock}>
                  <div className={styles.name} title={r.label}>
                    {r.label}
                  </div>
                  {meta.emojis ? (
                    <div className={styles.emojis} aria-label="Placements">
                      {meta.emojis}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className={styles.games}>
                {typeof meta.games === 'number' ? meta.games : '—'}
              </div>

              <div className={styles.avg}>
                {typeof meta.avgPoints === 'number' ? meta.avgPoints : '—'}
              </div>

              <div className={styles.points}>{r.points}</div>

              <div className={styles.delta}>
                {gameIndex === 0 ? (
                  <span className={styles.deltaNeutral}>—</span>
                ) : (
                  <DeltaBadge deltaRank={r.deltaRank} compact />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {gameIndex > 0 ? (
        <div className={styles.legend}>
          <span className={styles.deltaUp}>▲</span> climbed places since Week{' '}
          {gameIndex} <span className={styles.dot}>·</span>{' '}
          <span className={styles.deltaDown}>▼</span> dropped places since Week{' '}
          {gameIndex} <span className={styles.dot}>·</span>{' '}
          <span className={styles.deltaNeutral}>—</span> no change
        </div>
      ) : null}
    </div>
  );
}

function DeltaBadge({
  deltaRank,
  compact,
}: {
  deltaRank: number;
  compact: boolean;
}) {
  if (deltaRank === 0) return <span className={styles.deltaNeutral}>—</span>;

  if (deltaRank > 0) {
    return (
      <span className={styles.deltaUp}>
        ▲{compact ? deltaRank : ` ${deltaRank}`}
      </span>
    );
  }

  return (
    <span className={styles.deltaDown}>
      ▼{compact ? Math.abs(deltaRank) : ` ${Math.abs(deltaRank)}`}
    </span>
  );
}
