import React, { useState, useEffect } from 'react';
import cn from 'classnames';

import { supabase } from 'src/db/supabase';

import { getOrdinal } from 'src/utils';

import styles from './AddGameForm.module.css';
import { saveAndDeploy } from 'src/pages/api/save-and-deploy';

type Player = {
  id: number;
  slug: string;
  first_name: string;
  last_name: string;
  image_url: string;
  nickname: string;
  prefer_nickname: boolean;
};

type KORecord = {
  killer: { id: string; name: string };
  victim: { id: string; name: string };
};

type AddGameFormProps = {
  players: Player[];
  activeSeasonId: number;
  seasonGameNumber: number;
  nextGameId: number;
};

type Result = { position: number; player_id: number; name: string };

const points = [100, 80, 65, 55, 50, 45, 40, 35];

export default function AddGameForm({
  players,
  activeSeasonId,
  seasonGameNumber,
  nextGameId,
}: AddGameFormProps) {
  const maxPlayers = players.length || 1;
  const [rawNoPlayers, setRawNoPlayers] = useState('1');
  const numericNoPlayers = Math.max(
    1,
    Math.min(maxPlayers, parseInt(rawNoPlayers, 10) || 1),
  );
  const numKnockouts = Math.max(0, numericNoPlayers - 1);

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState<string>(today);
  const [knockouts, setKnockouts] = useState<KORecord[]>([]);
  const [addGameErrors, setAddGameErrors] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);

  // Sync knockouts array length
  useEffect(() => {
    setKnockouts((prev) => {
      const next = prev.slice(0, numKnockouts);
      while (next.length < numKnockouts) {
        next.push({
          killer: { id: '', name: '' },
          victim: { id: '', name: '' },
        });
      }
      return next;
    });
  }, [numKnockouts]);

  const lookupName = (id: string) => {
    const p = players.find((pl) => String(pl.id) === id);
    return p ? (p.prefer_nickname ? p.nickname : p.first_name) : '';
  };

  const handleKillerChange = (i: number, pid: string) => {
    setKnockouts((prev) => {
      const c = [...prev];
      c[i] = { ...c[i], killer: { id: pid, name: lookupName(pid) } };
      return c;
    });
  };

  const handleVictimChange = (i: number, pid: string) => {
    setKnockouts((prev) => {
      const c = [...prev];
      c[i] = { ...c[i], victim: { id: pid, name: lookupName(pid) } };
      return c;
    });
  };

  const validate = (e: React.MouseEvent<HTMLButtonElement>) => {
    console.log('Validating form...', knockouts);
    e.preventDefault();
    const errors: string[] = [];
    const victimsSoFar = new Set<string>();

    knockouts.forEach((ko, idx) => {
      const row = idx + 1;
      if (!ko.killer.id || !ko.victim.id) {
        errors.push(`Row ${row}: both killer and victim must be selected.`);
      }
      if (ko.killer.id === ko.victim.id) {
        errors.push(
          `Row ${row}: killer and victim cannot match (${ko.killer.name}).`,
        );
      }
      if (victimsSoFar.has(ko.victim.id)) {
        errors.push(
          `Row ${row}: victim ${ko.victim.name} was already knocked out.`,
        );
      }
      if (victimsSoFar.has(ko.killer.id)) {
        errors.push(
          `Row ${row}: killer ${ko.killer.name} was already eliminated and cannot kill.`,
        );
      }
      victimsSoFar.add(ko.victim.id);
    });

    setAddGameErrors(errors);
    if (errors.length === 0) {
      setShowModal(true);
    }
  };

  const closeModal = () => setShowModal(false);

  // Precompute results ordering
  const results: Result[] = showModal
    ? (() => {
        const out: Result[] = [];
        knockouts.forEach((ko, idx) => {
          const pos = numericNoPlayers - idx;
          out.push({
            position: pos,
            player_id: parseInt(ko.victim.id, 10),
            name: ko.victim.name,
          });
        });
        if (knockouts.length > 0) {
          const last = knockouts[knockouts.length - 1];
          out.push({
            position: 1,
            player_id: parseInt(last.killer.id, 10),
            name: last.killer.name,
          });
        }
        return out.sort((a, b) => b.position - a.position);
      })()
    : [];

  const saveGame = async () => {
    setAddGameErrors([]);

    const winnerId = results?.find((r) => r.position === 1)?.player_id;
    // const { data: insertGameData, error: insertGameError } = await supabase
    //   .from('games')
    //   .insert([
    //     {
    //       id: nextGameId,
    //       slug: String(nextGameId),
    //       season_id: activeSeasonId,
    //       season_game: seasonGameNumber,
    //       played_on: date,
    //       no_of_players: numericNoPlayers,
    //       winner_id: winnerId,
    //     },
    //   ]);

    // if (insertGameError) {
    //   console.error('Error saving game:', insertGameError);
    //   setAddGameErrors((prev) => [
    //     ...prev,
    //     'Failed to save game details. Please try again.',
    //   ]);
    //   return;
    // }

    // const payload = results.map((r) => ({
    //   season_id: activeSeasonId,
    //   game_id: nextGameId,
    //   player_id: r.player_id,
    //   place: r.position,
    //   points: points[r.position - 1] ?? 0,
    // }));

    // const { data: insertResultsData, error: insertResultsError } =
    //   await supabase.from('game_results').insert(payload);

    // if (insertResultsError) {
    //   console.error('Error saving results:', insertResultsError);
    //   setAddGameErrors((prev) => [
    //     ...prev,
    //     'Failed to save game results. Please try again.',
    //   ]);
    //   return;
    // }

    // insert into game_knockouts

    // update points on season_results

    // trigger netlify deploy
    await saveAndDeploy({
      gameData: winnerId,
      // knockouts: results,
    });

    setShowModal(false);
  };

  return (
    <>
      <form className={styles.form}>
        <h2>Details</h2>
        <div className={styles.formGroup}>
          <label htmlFor="date" className={styles.label}>
            Played on:
          </label>
          <input
            className={styles.input}
            type="date"
            id="date"
            name="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="noPlayers" className={styles.label}>
            Number of players:
          </label>
          <input
            type="number"
            id="noPlayers"
            name="noPlayers"
            min={1}
            max={maxPlayers}
            className={styles.input}
            value={rawNoPlayers}
            onChange={(e) => setRawNoPlayers(e.target.value)}
            onBlur={() => setRawNoPlayers(String(numericNoPlayers))}
          />
        </div>

        <h2>Results</h2>
        {knockouts.map((ko, i) => (
          <div key={i} className={styles.formGroup}>
            <label className={styles.label}>Knockout {i + 1}:</label>
            <div className={styles.knockout}>
              <select
                className={cn(styles.select, styles.knockoutSelect)}
                value={ko.killer.id}
                onChange={(e) => handleKillerChange(i, e.target.value)}
              >
                <option value="">Select killer</option>
                {players.map((p) => {
                  const name = p.prefer_nickname ? p.nickname : p.first_name;
                  return (
                    <option key={p.id} value={String(p.id)}>
                      {name}
                    </option>
                  );
                })}
              </select>
              <span className={styles.flippedEmoji}>🥊</span>
              <select
                className={cn(styles.select, styles.knockoutSelect)}
                value={ko.victim.id}
                onChange={(e) => handleVictimChange(i, e.target.value)}
              >
                <option value="">Select victim</option>
                {players.map((p) => {
                  const name = p.prefer_nickname ? p.nickname : p.first_name;
                  return (
                    <option key={p.id} value={String(p.id)}>
                      {name}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        ))}

        {addGameErrors.length > 0 && (
          <div className={styles.errors}>
            <h3>Errors:</h3>
            <ul>
              {addGameErrors.map((err, j) => (
                <li key={j}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <button type="button" className={styles.button} onClick={validate}>
          Add Game
        </button>
      </form>

      {showModal && results && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalHeader}>Confirm Results</h3>
            <p className={styles.modalDate}>Date: {date}</p>
            <ul className={styles.modalList}>
              {results.reverse().map((r) => (
                <li key={r.position}>
                  {getOrdinal(r.position)}: {r.name}
                </li>
              ))}
            </ul>
            <div className={styles.modalFooter}>
              <button onClick={saveGame} className={styles.modalButton}>
                Confirm
              </button>
              <button onClick={closeModal} className={styles.modalButton}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
