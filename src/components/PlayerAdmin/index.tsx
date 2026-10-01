import { useEffect, useState } from 'react';
import { AdminError, login } from '../ResultsAdmin/api';
import { supabase } from '../../db/supabase';
import styles from './PlayerAdmin.module.css';

type PlayerEntry = {
  first_name: string;
  last_name: string;
  nickname: string;
  prefer_nickname: boolean;
  image_url: string;
  bio: string;
};
type Pending = { request_id: string; entry: PlayerEntry };
type Rebuild = { status: string; detail?: string };
const SESSION = 'tpc-admin-session-v1';
const DRAFT = 'tpc-player-draft-v1';
const PENDING = 'tpc-player-pending-v1';
const emptyEntry = (): PlayerEntry => ({
  first_name: '',
  last_name: '',
  nickname: '',
  prefer_nickname: false,
  image_url: '',
  bio: '',
});
function readStored(key: string, session = false) {
  try {
    return JSON.parse(
      (session ? sessionStorage : localStorage).getItem(key) || 'null',
    );
  } catch {
    return null;
  }
}
function writeStored(key: string, value: unknown, session = false) {
  try {
    const storage = session ? sessionStorage : localStorage;
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(value));
  } catch {
    /* The form still works without browser storage. */
  }
}

export default function PlayerAdmin() {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [entry, setEntry] = useState<PlayerEntry>(emptyEntry);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{
    slug: string;
    name: string;
    rebuild?: Rebuild;
  } | null>(null);

  useEffect(() => {
    const saved = readStored(SESSION, true);
    if (saved?.token && Date.parse(saved.expiresAt) > Date.now())
      setToken(saved.token);
    const draft = readStored(DRAFT);
    if (draft) setEntry({ ...emptyEntry(), ...draft });
    setPending(readStored(PENDING));
    setReady(true);
  }, []);

  function change<K extends keyof PlayerEntry>(key: K, value: PlayerEntry[K]) {
    const next = { ...entry, [key]: value };
    setEntry(next);
    setError('');
    writeStored(DRAFT, next);
  }

  async function unlock(event: { preventDefault(): void }) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const session = await login(password);
      writeStored(SESSION, session, true);
      setToken(session.token);
      setPassword('');
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save(event: { preventDefault(): void }) {
    event.preventDefault();
    if (entry.prefer_nickname && !entry.nickname.trim()) {
      setError('Enter a nickname to use it as the display name.');
      return;
    }
    const request = pending || {
      request_id: crypto.randomUUID(),
      entry: { ...entry },
    };
    setPending(request);
    writeStored(PENDING, request);
    setBusy(true);
    setError('');
    try {
      const { data, error: rpcError } = await Promise.resolve(
        supabase.rpc('club_admin_create_player', {
          p_token: token,
          p_payload: { ...request.entry, request_id: request.request_id },
        }),
      ).catch(() => {
        throw new AdminError(
          'The connection was interrupted. Retry the same request to confirm whether the player was saved.',
          true,
        );
      });
      if (rpcError) {
        if (rpcError.code === '28000') {
          setToken('');
          writeStored(SESSION, null, true);
          throw new Error(
            'Your session has expired. Unlock the page again; your player details are saved.',
          );
        }
        throw new Error(
          rpcError.message || 'Could not add the player. Please try again.',
        );
      }
      setCreated({
        slug: data.slug,
        name: [request.entry.first_name.trim(), request.entry.last_name.trim()]
          .filter(Boolean)
          .join(' '),
        rebuild: data.rebuild,
      });
      setEntry(emptyEntry());
      setPending(null);
      writeStored(DRAFT, null);
      writeStored(PENDING, null);
    } catch (cause) {
      if (!(cause instanceof AdminError && cause.uncertain)) {
        setPending(null);
        writeStored(PENDING, null);
      }
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <p>Loading player entry…</p>;
  if (!token)
    return (
      <section className={styles.card}>
        <span className={styles.suit} aria-hidden="true">
          ♠
        </span>
        <h2>Club players</h2>
        <p>Enter the shared club password to add a player.</p>
        <form onSubmit={unlock} className={styles.form}>
          <label htmlFor="player-password">Club password</label>
          <input
            id="player-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={72}
            required
          />
          <button disabled={busy}>
            {busy ? 'Unlocking…' : 'Unlock player entry'}
          </button>
        </form>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </section>
    );

  return (
    <div className={styles.stack}>
      {created && (
        <section className={styles.success} role="status">
          <strong>{created.name} was added.</strong>
          <p>
            {created.rebuild?.status === 'failed'
              ? `The player is saved, but the website rebuild needs attention: ${created.rebuild.detail || 'Please check the deployment.'}`
              : 'The player is saved. Their public profile will appear after the website rebuild finishes.'}
          </p>
          <p>
            <a href={`/players/${created.slug}`}>
              View player profile after the rebuild →
            </a>
          </p>
        </section>
      )}
      <section className={styles.card}>
        <div className={styles.heading}>
          <div>
            <h2>New player</h2>
            <p>Add someone to the club roster and results picker.</p>
          </div>
          <a href="/add/game">Manage results →</a>
        </div>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <form onSubmit={save} className={styles.form}>
          <div className={styles.twoColumns}>
            <label>
              First name{' '}
              <input
                required
                maxLength={80}
                autoComplete="given-name"
                value={entry.first_name}
                onChange={(e) => change('first_name', e.target.value)}
                disabled={busy || !!pending}
              />
            </label>
            <label>
              Last name <span className={styles.hint}>Optional</span>
              <input
                maxLength={80}
                autoComplete="family-name"
                value={entry.last_name}
                onChange={(e) => change('last_name', e.target.value)}
                disabled={busy || !!pending}
              />
            </label>
          </div>
          <label>
            Nickname <span className={styles.hint}>Optional</span>
            <input
              maxLength={80}
              value={entry.nickname}
              onChange={(e) => change('nickname', e.target.value)}
              disabled={busy || !!pending}
            />
          </label>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={entry.prefer_nickname}
              onChange={(e) => change('prefer_nickname', e.target.checked)}
              disabled={busy || !!pending}
            />{' '}
            Use nickname in results and leaderboards
          </label>
          <label>
            Photo URL or site image path{' '}
            <span className={styles.hint}>
              Optional — HTTPS URL or /images/players/filename.jpg
            </span>
            <input
              type="text"
              maxLength={500}
              value={entry.image_url}
              onChange={(e) => change('image_url', e.target.value)}
              disabled={busy || !!pending}
              placeholder="/images/players/avatar.jpg"
            />
          </label>
          <label>
            Bio <span className={styles.hint}>Optional</span>
            <textarea
              rows={4}
              maxLength={2000}
              value={entry.bio}
              onChange={(e) => change('bio', e.target.value)}
              disabled={busy || !!pending}
            />
          </label>
          <div className={styles.actions}>
            <button disabled={busy}>
              {busy
                ? 'Saving…'
                : pending
                  ? 'Confirm saved player'
                  : 'Add player'}
            </button>
            {pending && (
              <span className={styles.hint}>
                Retrying will check the same save request.
              </span>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
