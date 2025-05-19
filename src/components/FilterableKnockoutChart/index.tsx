import { useState, useMemo } from 'react';

import PlayerKnockoutChart from '../PlayerKnockoutChart';

import styles from './FilterableKnockoutChart.module.css';

interface KORecord {
  season_id: number;
  killer_id: number;
  victim_id: number;
  killer: { first_name: string; nickname: string; prefer_nickname: boolean };
  victim: { first_name: string; nickname: string; prefer_nickname: boolean };
}

interface Props {
  rawKOs: KORecord[];
  playerId: number;
}

export default function FilterableKnockoutChart({ rawKOs, playerId }: Props) {
  const seasons = useMemo(
    () => Array.from(new Set(rawKOs.map((k) => k.season_id))).sort(),
    [rawKOs],
  );
  const [season, setSeason] = useState<string | number>('all');
  const filtered = useMemo(
    () =>
      season === 'all'
        ? rawKOs
        : rawKOs.filter((k: any) => k.season_id === Number(season)),
    [season, rawKOs],
  );

  const stats = useMemo(() => {
    const map: Record<string, { kills: number; deaths: number }> = {};
    filtered.forEach((k) => {
      const iAmKiller = k.killer_id === playerId;
      const other = iAmKiller ? k.victim : k.killer;
      const name = other.prefer_nickname ? other.nickname : other.first_name;
      if (!map[name]) map[name] = { kills: 0, deaths: 0 };
      if (iAmKiller) map[name].kills++;
      else map[name].deaths++;
    });
    return Object.entries(map).map(([opponentName, c]) => ({
      opponentName,
      kills: c.kills,
      deaths: c.deaths,
    }));
  }, [filtered, playerId]);

  return (
    <>
      <div className={styles.controls}>
        <label>
          Season:&nbsp;
          <select value={season} onChange={(e) => setSeason(e.target.value)}>
            <option value="all">All seasons</option>
            {seasons.map((s) => (
              <option key={s} value={s}>{`Season ${s}`}</option>
            ))}
          </select>
        </label>
      </div>

      {stats.length > 0 ? (
        <PlayerKnockoutChart data={stats} />
      ) : (
        <p>
          No knockouts for{' '}
          {season === 'all' ? 'any season' : `Season ${season}`}.
        </p>
      )}
    </>
  );
}
