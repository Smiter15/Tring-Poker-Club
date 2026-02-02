import { useMemo, useState } from 'react';
import styles from './PlayerSeasonCard.module.css';

type Rival = {
  opponentName: string;
  opponentSlug?: string;
  opponentImage?: string;
  kills: number;
  deaths: number;
};

type KOStats = {
  kills: number;
  deaths: number;
  rivals: Rival[]; // already sorted desc by (kills+deaths)
};

export type PlayerSeasonCardSeason = {
  seasonId: number;
  seasonName?: string;
  seasonSlug?: string;
};

export type PlayerSeasonCardSeasonStats = {
  seasonId: number;

  // tie-aware final standings for that season (from season_results)
  place?: number;
  points?: number;

  gamesPlayed: number;
  avgPoints: number;

  gold: number;
  silver: number;
  bronze: number;
  bubble: number;
  poop: number;

  emojiTrail: string;

  ko?: KOStats; // omit if no KO tracking / no data
};

export interface PlayerSeasonCardProps {
  seasons: PlayerSeasonCardSeason[];
  statsBySeasonId: Record<number, PlayerSeasonCardSeasonStats>;
  defaultSeasonId?: number; // most recent season played
  seasonWeeks?: number; // optional display only
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

export default function PlayerSeasonCard({
  seasons,
  statsBySeasonId,
  defaultSeasonId,
  seasonWeeks,
}: PlayerSeasonCardProps) {
  const fallbackSeasonId = seasons[seasons.length - 1]?.seasonId;
  const [seasonId, setSeasonId] = useState<number>(
    defaultSeasonId ?? fallbackSeasonId ?? 0,
  );

  const season = useMemo(
    () => seasons.find((s) => s.seasonId === seasonId),
    [seasons, seasonId],
  );

  const stats = statsBySeasonId[seasonId];

  if (!seasons.length || !stats) return null;

  const placeText =
    typeof stats.place === 'number' ? ordinal(stats.place) : undefined;

  const seasonLabel = season?.seasonName
    ? `Season ${season.seasonName}`
    : `Season ${seasonId}`;

  const reviewHref =
    season?.seasonSlug != null ? `/seasons/${season.seasonSlug}/review` : null;

  return (
    <section className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.titleBlock}>
            <div className={styles.kicker}>Season snapshot</div>

            <div className={styles.titleRow}>
              <div className={styles.title}>{seasonLabel}</div>

              <select
                className={styles.select}
                value={seasonId}
                onChange={(e) => setSeasonId(Number(e.target.value))}
                aria-label="Choose season"
              >
                {seasons
                  .slice()
                  .sort((a, b) => b.seasonId - a.seasonId)
                  .map((s) => (
                    <option key={s.seasonId} value={s.seasonId}>
                      {s.seasonName
                        ? `Season ${s.seasonName}`
                        : `Season ${s.seasonId}`}
                    </option>
                  ))}
              </select>
            </div>

            {reviewHref ? (
              <a className={styles.reviewLink} href={reviewHref}>
                View season review →
              </a>
            ) : null}
          </div>

          <div className={styles.big}>
            <div className={styles.bigTop}>
              {placeText ? (
                <span className={styles.place}>{placeText}</span>
              ) : null}
              {typeof stats.points === 'number' ? (
                <span className={styles.points}>{stats.points} pts</span>
              ) : null}
            </div>

            <div className={styles.bigSub}>
              {stats.gamesPlayed} game{stats.gamesPlayed === 1 ? '' : 's'}
              {seasonWeeks ? (
                <span> · season is {seasonWeeks} weeks</span>
              ) : null}
              <span> · avg {stats.avgPoints}</span>
            </div>
          </div>
        </div>

        <div className={styles.medals}>
          <div className={styles.medalChip}>
            <span>🥇</span>
            <b>{stats.gold}</b>
          </div>
          <div className={styles.medalChip}>
            <span>🥈</span>
            <b>{stats.silver}</b>
          </div>
          <div className={styles.medalChip}>
            <span>🥉</span>
            <b>{stats.bronze}</b>
          </div>
          <div className={styles.medalChip}>
            <span>🫧</span>
            <b>{stats.bubble}</b>
          </div>
          <div className={styles.medalChip}>
            <span>💩</span>
            <b>{stats.poop}</b>
          </div>
        </div>

        {stats.ko ? (
          <div className={styles.koBlock}>
            <div className={styles.koHeader}>
              <div className={styles.koTitle}>Knockouts</div>
              <div className={styles.koMeta}>
                <span>🔪 {stats.ko.kills}</span>
                <span className={styles.dot}>·</span>
                <span>💀 {stats.ko.deaths}</span>
              </div>
            </div>

            {stats.ko.rivals?.length ? (
              <div className={styles.rivals}>
                {stats.ko.rivals.slice(0, 6).map((r) => {
                  const content = (
                    <>
                      {r.opponentImage ? (
                        <img
                          src={r.opponentImage}
                          alt=""
                          className={styles.rivalAvatar}
                        />
                      ) : (
                        <div className={styles.rivalAvatarPlaceholder} />
                      )}

                      <span className={styles.rivalName}>{r.opponentName}</span>

                      {/* NEW: clear kills vs deaths (bigger) */}
                      <span
                        className={styles.rivalKODuo}
                        aria-label="Knockouts vs deaths"
                      >
                        <span className={styles.rivalKO}>
                          <span className={styles.koIcon} aria-hidden="true">
                            🔪
                          </span>
                          <span className={styles.koNum}>{r.kills}</span>
                        </span>

                        <span className={styles.rivalSep} aria-hidden="true">
                          ·
                        </span>

                        <span className={styles.rivalDeath}>
                          <span className={styles.koIcon} aria-hidden="true">
                            💀
                          </span>
                          <span className={styles.koNum}>{r.deaths}</span>
                        </span>
                      </span>
                    </>
                  );

                  return r.opponentSlug ? (
                    <a
                      key={r.opponentName}
                      href={`/players/${r.opponentSlug}`}
                      className={styles.rivalChip}
                    >
                      {content}
                    </a>
                  ) : (
                    <div key={r.opponentName} className={styles.rivalChip}>
                      {content}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.koEmpty}>
                No rivals recorded this season.
              </div>
            )}
          </div>
        ) : null}

        {!stats.ko ? (
          <div className={styles.koNote}>
            Knockouts weren’t tracked (or weren’t recorded) for this season.
          </div>
        ) : null}
      </div>
    </section>
  );
}
