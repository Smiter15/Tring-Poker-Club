import { useEffect, useRef, useState } from 'react';
import { adminAction, AdminError, login } from './api';
import {
  availablePlayers,
  calculateResults,
  londonToday,
  type GameEntry,
  type Finish,
} from '../../utils/gameEntry';
import styles from './ResultsAdmin.module.css';

type Player = {
  id: number;
  first_name: string;
  last_name: string;
  nickname: string;
  prefer_nickname: boolean;
};
type SavedGame = {
  id: number;
  revision: number;
  removed: boolean;
  data: GameEntry;
  recorder: string;
  updatedAt: string;
};
type Rebuild = { id: number; status: string; detail?: string };
type Context = {
  seasons: { id: number; name: string; is_active: boolean }[];
  players: Player[];
  nextGames: Record<string, number>;
  games: SavedGame[];
  rebuild?: Rebuild;
};
type Change = {
  revision: number;
  action: string;
  recorder: string;
  createdAt: string;
  before: GameEntry | null;
  after: GameEntry | null;
};
type Mutation = { action: string; payload: Record<string, unknown> };
const DRAFT = 'tpc-game-draft-v1';
const SESSION = 'tpc-admin-session-v1';
const PENDING = 'tpc-admin-pending-v1';
const emptyEntry = (): GameEntry => ({
  season_id: 7,
  season_game: 1,
  played_on: londonToday(),
  players: [],
  knockouts: [],
});
const readStored = (key: string, session = false) => {
  try {
    return JSON.parse(
      (session ? sessionStorage : localStorage).getItem(key) || 'null',
    );
  } catch {
    return null;
  }
};
const writeStored = (key: string, value: unknown, session = false) => {
  try {
    const storage = session ? sessionStorage : localStorage;
    value === null
      ? storage.removeItem(key)
      : storage.setItem(key, JSON.stringify(value));
  } catch {
    /* Entry remains usable when browser storage is unavailable. */
  }
};
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(
    new Date(`${value}T12:00:00`),
  );

export default function ResultsAdmin() {
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const historyHeading = useRef<HTMLHeadingElement>(null);
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [context, setContext] = useState<Context | null>(null);
  const [entry, setEntry] = useState<GameEntry>(emptyEntry);
  const [edit, setEdit] = useState<{ id: number; revision: number } | null>(
    null,
  );
  const [recorder, setRecorder] = useState('');
  const [requestId, setRequestId] = useState('');
  const [pending, setPending] = useState<Mutation | null>(null);
  const [ready, setReady] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [view, setView] = useState<'entry' | 'games'>('entry');
  const [review, setReview] = useState<Finish[] | null>(null);
  const [history, setHistory] = useState<{
    game: SavedGame;
    changes: Change[];
  } | null>(null);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [rebuild, setRebuild] = useState<Rebuild | null>(null);

  useEffect(() => {
    if (review) reviewHeading.current?.focus();
  }, [review]);
  useEffect(() => {
    if (history) historyHeading.current?.focus();
  }, [history]);

  useEffect(() => {
    const draft = readStored(DRAFT);
    if (
      draft?.entry &&
      Array.isArray(draft.entry.players) &&
      Array.isArray(draft.entry.knockouts)
    ) {
      setEntry(draft.entry);
      setEdit(draft.edit);
      setRecorder(draft.recorder || '');
      setRequestId(draft.requestId || crypto.randomUUID());
      setHasDraft(true);
    } else setRequestId(crypto.randomUUID());
    setPending(readStored(PENDING));
    const session = readStored(SESSION, true);
    if (session?.token && Date.parse(session.expiresAt) > Date.now())
      setToken(session.token);
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready && hasDraft)
      writeStored(DRAFT, { entry, edit, recorder, requestId });
  }, [ready, hasDraft, entry, edit, recorder, requestId]);

  async function refresh(sessionToken = token) {
    const data: Context = await adminAction(sessionToken, 'context');
    setContext(data);
    setRebuild(data.rebuild || null);
    return data;
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    adminAction(token, 'context')
      .then((data: Context) => {
        if (cancelled) return;
        setContext(data);
        setRebuild(data.rebuild || null);
        if (!readStored(DRAFT)) {
          const season =
            data.seasons.find((s) => s.is_active) || data.seasons[0];
          if (season)
            setEntry({
              ...emptyEntry(),
              season_id: season.id,
              season_game: data.nextGames[season.id] || 1,
            });
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setToken('');
          writeStored(SESSION, null, true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !rebuild || rebuild.status !== 'queued') return;
    const timer = setTimeout(() => {
      adminAction(token, 'rebuild_status', { id: rebuild.id })
        .then(setRebuild)
        .catch(() =>
          setRebuild({
            ...rebuild,
            status: 'unknown',
            detail:
              'Could not check the rebuild request. Refresh the game list to check again.',
          }),
        );
    }, 2500);
    return () => clearTimeout(timer);
  }, [token, rebuild]);

  function changeEntry(next: GameEntry) {
    setEntry(next);
    setReview(null);
    setError('');
    setHasDraft(true);
    setRequestId(crypto.randomUUID());
  }
  function changeRecorder(value: string) {
    setRecorder(value);
    setRequestId(crypto.randomUUID());
    if (entry.players.length || edit) setHasDraft(true);
  }
  function reset(data = context) {
    const season = data?.seasons.find((s) => s.is_active) || data?.seasons[0];
    setEntry({
      ...emptyEntry(),
      season_id: season?.id || 7,
      season_game: data?.nextGames[season?.id || 7] || 1,
    });
    setEdit(null);
    setReview(null);
    setHasDraft(false);
    setRequestId(crypto.randomUUID());
    writeStored(DRAFT, null);
    setDiscard(false);
  }
  const name = (id: number) => {
    const p = context?.players.find((p) => p.id === id);
    return p
      ? p.prefer_nickname
        ? p.nickname
        : `${p.first_name} ${p.last_name || ''}`.trim()
      : `Player ${id}`;
  };

  async function unlock(event: { preventDefault(): void }) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const session = await login(password);
      writeStored(SESSION, session, true);
      setToken(session.token);
      setPassword('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function mutate(mutation: Mutation) {
    setBusy(true);
    setError('');
    setMessage('');
    setPending(mutation);
    writeStored(PENDING, mutation);
    try {
      const result = await adminAction(
        token,
        mutation.action,
        mutation.payload,
      );
      setPending(null);
      writeStored(PENDING, null);
      setRebuild(result.rebuild);
      if (mutation.action === 'save') {
        reset();
        setView('games');
      }
      setHistory(null);
      setConfirmUndo(false);
      setMessage(
        mutation.action === 'save'
          ? 'Results saved.'
          : mutation.action === 'undo'
            ? result.removed
              ? 'Game entry undone. It remains in history and can be restored.'
              : 'Previous results restored.'
            : 'Website rebuild requested.',
      );
      try {
        const data = await refresh();
        if (mutation.action === 'save') reset(data);
      } catch {
        setError(
          'Your change was saved, but the game list could not refresh. Refresh the list before making another change.',
        );
      }
    } catch (e) {
      if (!(e instanceof AdminError && e.uncertain)) {
        setPending(null);
        writeStored(PENDING, null);
      }
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function beginReview() {
    try {
      if (!recorder.trim())
        throw new Error(
          'Enter your name so the club knows who recorded these results.',
        );
      const results = calculateResults(entry);
      if (
        !entry.players.every((id) => context?.players.some((p) => p.id === id))
      )
        throw new Error(
          'A selected player is no longer available. Please select the attendees again.',
        );
      setReview(results);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function togglePlayer(id: number) {
    const players = entry.players.includes(id)
      ? entry.players.filter((p) => p !== id)
      : [...entry.players, id];
    const knockouts = entry.knockouts
      .slice(0, Math.max(0, players.length - 1))
      .map((ko) => ({
        killer_id: players.includes(ko.killer_id!) ? ko.killer_id : null,
        victim_id: players.includes(ko.victim_id!) ? ko.victim_id : null,
      }));
    while (knockouts.length < players.length - 1)
      knockouts.push({ killer_id: null, victim_id: null });
    changeEntry({ ...entry, players, knockouts });
  }

  async function openHistory(game: SavedGame, undo = false) {
    setBusy(true);
    setError('');
    try {
      const result = await adminAction(token, 'history', { game_id: game.id });
      setHistory({ game, changes: result.history });
      setConfirmUndo(undo);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const renderTable = (results: Finish[]) => (
    <div className={styles.tableScroll}>
      <table>
        <thead>
          <tr>
            <th>Place</th>
            <th>Player</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.player_id}>
              <td>{r.place === 1 ? '1 · Winner' : r.place}</td>
              <td>{name(r.player_id)}</td>
              <td>{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (!ready) return <p>Loading results entry…</p>;
  if (!token)
    return (
      <section className={styles.login}>
        <span className={styles.suit} aria-hidden="true">
          ♠
        </span>
        <h2>Club results</h2>
        <p>
          Enter the shared club password to record a game or correct a result.
        </p>
        <form onSubmit={unlock}>
          <label htmlFor="club-password">Club password</label>
          <input
            id="club-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            maxLength={72}
          />
          <button disabled={busy}>
            {busy ? 'Unlocking…' : 'Unlock results entry'}
          </button>
        </form>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </section>
    );
  if (!context) return <p>Loading seasons and players…</p>;

  return (
    <div className={styles.admin}>
      <div className={styles.toolbar}>
        <div className={styles.tabs}>
          <button
            className={view === 'entry' ? styles.active : styles.secondary}
            onClick={() => {
              setView('entry');
              setHistory(null);
            }}
            disabled={busy || !!pending}
          >
            Enter results
          </button>
          <button
            className={view === 'games' ? styles.active : styles.secondary}
            onClick={() => {
              setView('games');
              setHistory(null);
            }}
            disabled={busy || !!pending}
          >
            Saved games ({context.games.length})
          </button>
        </div>
        <button
          className={styles.textButton}
          disabled={busy || !!pending}
          onClick={async () => {
            setBusy(true);
            try {
              await adminAction(token, 'logout');
            } catch {
              /* The server session also expires automatically. */
            }
            writeStored(SESSION, null, true);
            setToken('');
            setContext(null);
            setBusy(false);
          }}
        >
          Lock
        </button>
      </div>
      {message && (
        <div className={styles.success} role="status">
          {message}
        </div>
      )}
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      {rebuild && (
        <div className={styles.publish} role="status">
          <strong>
            {rebuild.status === 'requested'
              ? 'Rebuild requested'
              : rebuild.status === 'queued'
                ? 'Requesting website rebuild…'
                : 'Website update needs attention'}
          </strong>
          <p>
            {rebuild.detail ||
              'Saved results are in the database. Public pages update when the website finishes rebuilding.'}
          </p>
          {['failed', 'unknown'].includes(rebuild.status) && (
            <button
              className={styles.secondary}
              disabled={busy || !!pending}
              onClick={() =>
                mutate({
                  action: 'retry_rebuild',
                  payload: { id: rebuild.id, request_id: crypto.randomUUID() },
                })
              }
            >
              Retry website update
            </button>
          )}
        </div>
      )}
      {pending && (
        <div className={styles.notice}>
          <strong>A request is waiting for confirmation.</strong>
          <p>
            Retrying the same request will not duplicate a game or undo a change
            twice.
          </p>
          <button disabled={busy} onClick={() => mutate(pending)}>
            {busy ? 'Working…' : 'Retry previous request'}
          </button>
        </div>
      )}
      <label className={styles.recorder}>
        Recorded by
        <input
          value={recorder}
          onChange={(e) => changeRecorder(e.target.value)}
          placeholder="Your name"
          autoComplete="name"
          maxLength={80}
          disabled={busy || !!pending}
        />
      </label>

      {view === 'entry' && (
        <>
          {hasDraft && !review && (
            <div className={styles.draft}>
              <span>
                {edit
                  ? 'Editing a saved game. Your changes are kept on this device until you save.'
                  : 'Draft saved on this device.'}
              </span>
              <button
                className={styles.textButton}
                onClick={() => setDiscard(true)}
                disabled={busy || !!pending}
              >
                Discard draft
              </button>
            </div>
          )}
          {discard && (
            <div className={styles.notice}>
              <p>Discard these unsaved details and start a new game?</p>
              <div className={styles.actions}>
                <button className={styles.danger} onClick={() => reset()}>
                  Discard draft
                </button>
                <button
                  className={styles.secondary}
                  onClick={() => setDiscard(false)}
                >
                  Keep editing
                </button>
              </div>
            </div>
          )}
          {!review ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                beginReview();
              }}
            >
              <fieldset disabled={busy || !!pending} className={styles.panel}>
                <legend>
                  <span>1</span> Game details
                </legend>
                <div className={styles.details}>
                  <label>
                    Played on
                    <input
                      type="date"
                      value={entry.played_on}
                      max={londonToday()}
                      required
                      onInput={(e) =>
                        changeEntry({
                          ...entry,
                          played_on: e.currentTarget.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Season
                    <select
                      value={entry.season_id}
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        changeEntry({
                          ...entry,
                          season_id: id,
                          season_game: context.nextGames[id] || 1,
                        });
                      }}
                    >
                      {context.seasons.map((s) => (
                        <option value={s.id} key={s.id}>
                          Season {s.id}
                          {s.is_active ? ' · Current' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Game number
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      required
                      value={entry.season_game || ''}
                      onChange={(e) =>
                        changeEntry({
                          ...entry,
                          season_game: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>
              </fieldset>
              <fieldset disabled={busy || !!pending} className={styles.panel}>
                <legend>
                  <span>2</span> Who played?
                </legend>
                <p className={styles.hint}>
                  Select everyone who took part. {entry.players.length}{' '}
                  selected.
                </p>
                <div className={styles.players}>
                  {context.players.map((p) => (
                    <label
                      key={p.id}
                      className={
                        entry.players.includes(p.id)
                          ? styles.selectedPlayer
                          : ''
                      }
                    >
                      <input
                        type="checkbox"
                        checked={entry.players.includes(p.id)}
                        onChange={() => togglePlayer(p.id)}
                      />
                      <span>{name(p.id)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset disabled={busy || !!pending} className={styles.panel}>
                <legend>
                  <span>3</span> Knockout order
                </legend>
                <p className={styles.hint}>
                  Start with the first player out and work towards the winner.
                  Only players still in the game can be selected.
                </p>
                {entry.players.length < 2 && (
                  <p>Select at least two players above to start.</p>
                )}
                {entry.knockouts.map((ko, i) => {
                  const alive = availablePlayers(entry, i);
                  return (
                    <div key={i} className={styles.knockout}>
                      <div className={styles.position}>
                        {entry.players.length - i}
                        <small>place</small>
                      </div>
                      <label>
                        Player out
                        <select
                          aria-label={`Knockout ${i + 1}: player out`}
                          value={ko.victim_id || ''}
                          onChange={(e) => {
                            const knockouts = entry.knockouts.map((k, j) =>
                              j === i
                                ? {
                                    ...k,
                                    victim_id: Number(e.target.value) || null,
                                  }
                                : k,
                            );
                            changeEntry({ ...entry, knockouts });
                          }}
                          required
                        >
                          <option value="">Choose player</option>
                          {alive
                            .filter((id) => id !== ko.killer_id)
                            .map((id) => (
                              <option key={id} value={id}>
                                {name(id)}
                              </option>
                            ))}
                          {ko.victim_id && !alive.includes(ko.victim_id) && (
                            <option value={ko.victim_id}>
                              {name(ko.victim_id)} · already out
                            </option>
                          )}
                        </select>
                      </label>
                      <label>
                        Knocked out by
                        <select
                          aria-label={`Knockout ${i + 1}: knocked out by`}
                          value={ko.killer_id || ''}
                          onChange={(e) => {
                            const knockouts = entry.knockouts.map((k, j) =>
                              j === i
                                ? {
                                    ...k,
                                    killer_id: Number(e.target.value) || null,
                                  }
                                : k,
                            );
                            changeEntry({ ...entry, knockouts });
                          }}
                          required
                        >
                          <option value="">Choose player</option>
                          {alive
                            .filter((id) => id !== ko.victim_id)
                            .map((id) => (
                              <option key={id} value={id}>
                                {name(id)}
                              </option>
                            ))}
                          {ko.killer_id && !alive.includes(ko.killer_id) && (
                            <option value={ko.killer_id}>
                              {name(ko.killer_id)} · already out
                            </option>
                          )}
                        </select>
                      </label>
                    </div>
                  );
                })}
              </fieldset>
              <div className={styles.actions}>
                <button
                  type="submit"
                  disabled={busy || !!pending || entry.players.length < 2}
                >
                  Review results
                </button>
                <p className={styles.hint}>
                  Points are calculated automatically. Ninth place onwards
                  receives 0.
                </p>
              </div>
            </form>
          ) : (
            <section className={styles.panel}>
              <p className={styles.eyebrow}>Check before saving</p>
              <h2 ref={reviewHeading} tabIndex={-1}>
                Season {entry.season_id} · Game {entry.season_game}
              </h2>
              <p>
                {dateLabel(entry.played_on)} · {entry.players.length} players ·
                Recorded by {recorder}
              </p>
              {renderTable(review)}
              <details>
                <summary>Review knockouts</summary>
                <ol>
                  {entry.knockouts.map((ko, i) => (
                    <li key={i}>
                      {name(ko.victim_id!)} knocked out by {name(ko.killer_id!)}
                    </li>
                  ))}
                </ol>
              </details>
              <div className={styles.actions}>
                <button
                  disabled={busy || !!pending}
                  onClick={() =>
                    mutate({
                      action: 'save',
                      payload: {
                        request_id: requestId,
                        game_id: edit?.id || null,
                        expected_revision: edit?.revision || null,
                        recorder: recorder.trim(),
                        data: entry,
                      },
                    })
                  }
                >
                  {busy
                    ? 'Saving…'
                    : edit
                      ? 'Save corrected results'
                      : 'Save game results'}
                </button>
                <button
                  className={styles.secondary}
                  disabled={busy || !!pending}
                  onClick={() => setReview(null)}
                >
                  Back to editing
                </button>
              </div>
              <p className={styles.hint}>
                Saving updates the standings and requests a website rebuild. You
                can undo this later.
              </p>
            </section>
          )}
        </>
      )}

      {view === 'games' && (
        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Season 7 onwards</p>
              <h2>Saved games</h2>
            </div>
            <button
              className={styles.secondary}
              disabled={busy || !!pending}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await refresh();
                  setHistory(null);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Refresh list
            </button>
          </div>
          {context.games.length === 0 && (
            <div className={styles.empty}>
              <span aria-hidden="true">♠</span>
              <h3>Ready for the new season</h3>
              <p>The first game will appear here after you save its results.</p>
              <button onClick={() => setView('entry')}>
                Enter the first game
              </button>
            </div>
          )}
          {context.games.map((game) => (
            <article key={game.id} className={styles.game}>
              <div>
                <h3>
                  Season {game.data.season_id} · Game {game.data.season_game}
                  {game.removed && <span className={styles.badge}>Undone</span>}
                </h3>
                <p>
                  {dateLabel(game.data.played_on)} · {game.data.players.length}{' '}
                  players
                </p>
                <small>
                  Last changed by {game.recorder} ·{' '}
                  {new Date(game.updatedAt).toLocaleString('en-GB')}
                </small>
              </div>
              <div className={styles.actions}>
                <button
                  className={styles.secondary}
                  disabled={busy || !!pending || game.removed || hasDraft}
                  onClick={() => {
                    setEntry(game.data);
                    setEdit({ id: game.id, revision: game.revision });
                    setHasDraft(true);
                    setRequestId(crypto.randomUUID());
                    setView('entry');
                    setReview(null);
                    setHistory(null);
                    setMessage('');
                  }}
                >
                  Edit
                </button>
                <button
                  className={styles.secondary}
                  disabled={busy || !!pending}
                  onClick={() => openHistory(game)}
                >
                  History
                </button>
                <button
                  className={styles.textButton}
                  disabled={busy || !!pending}
                  onClick={() => openHistory(game, true)}
                >
                  {game.removed ? 'Restore game' : 'Undo latest change'}
                </button>
              </div>
            </article>
          ))}
          {hasDraft && (
            <p className={styles.hint}>
              You have an unsaved draft. Save or discard it before editing a
              different game.
            </p>
          )}
        </section>
      )}

      {history && (
        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <h2 ref={historyHeading} tabIndex={-1}>
              {confirmUndo
                ? history.changes[0]?.before
                  ? 'Restore previous results?'
                  : 'Undo this game entry?'
                : 'Game history'}
            </h2>
            <button
              className={styles.textButton}
              onClick={() => setHistory(null)}
              disabled={busy}
            >
              Close
            </button>
          </div>
          {confirmUndo ? (
            <>
              <p>
                {history.changes[0]?.before
                  ? 'The game will return to the version below. Standings will be recalculated, and the change will remain in history.'
                  : 'This game will stop counting towards the standings. Its results will remain in history so you can restore it.'}
              </p>
              {history.changes[0]?.before && (
                <>
                  {renderTable(calculateResults(history.changes[0].before))}
                  <p>
                    {dateLabel(history.changes[0].before.played_on)} · Season{' '}
                    {history.changes[0].before.season_id} · Game{' '}
                    {history.changes[0].before.season_game}
                  </p>
                </>
              )}
              <div className={styles.actions}>
                <button
                  className={styles.danger}
                  disabled={busy || !!pending || !recorder.trim()}
                  onClick={() =>
                    mutate({
                      action: 'undo',
                      payload: {
                        request_id: crypto.randomUUID(),
                        game_id: history.game.id,
                        expected_revision: history.game.revision,
                        recorder: recorder.trim(),
                      },
                    })
                  }
                >
                  Confirm {history.changes[0]?.before ? 'restoration' : 'undo'}
                </button>
                <button
                  className={styles.secondary}
                  onClick={() => setHistory(null)}
                >
                  Cancel
                </button>
              </div>
              {!recorder.trim() && (
                <p className={styles.hint}>
                  Enter your name above to confirm the change.
                </p>
              )}
            </>
          ) : (
            history.changes.map((change) => (
              <details key={change.revision} className={styles.history}>
                <summary>
                  {change.action === 'create'
                    ? 'Game entered'
                    : change.action === 'edit'
                      ? 'Results edited'
                      : 'Change undone'}{' '}
                  · {change.recorder} ·{' '}
                  {new Date(change.createdAt).toLocaleString('en-GB')}
                </summary>
                {change.after ? (
                  <>
                    {renderTable(calculateResults(change.after))}
                    <ol>
                      {change.after.knockouts.map((ko, i) => (
                        <li key={i}>
                          {name(ko.victim_id!)} knocked out by{' '}
                          {name(ko.killer_id!)}
                        </li>
                      ))}
                    </ol>
                  </>
                ) : (
                  <p>
                    Game removed from the standings. Its earlier results are
                    retained below.
                  </p>
                )}
              </details>
            ))
          )}
        </section>
      )}
    </div>
  );
}
