import { useEffect, useRef, useState } from 'react';
import type { StoredChar } from '../core/types';
import { CharStorage } from '../core/storage';
import {
  connectDrive,
  disconnectDrive,
  getDriveState,
  hasValidToken,
  syncPull,
  syncPush,
  DriveAuthError,
  type DriveState,
} from './drive-sync';

type SyncStatus = 'idle' | 'syncing' | 'error' | 'pending';

const PULL_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes — prevent spam on every roster mount

interface Props {
  clientId: string;
  onRosterChange: (roster: StoredChar[]) => void;
}

export function DrivePanel({ clientId, onRosterChange }: Props) {
  const [state, setState] = useState<DriveState>(getDriveState);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clientIdUnconfigured = clientId.startsWith('YOUR_CLIENT_ID');

  // Pull on mount if already connected — skip if no live token (avoids account-chooser popup)
  // or if synced recently (avoids spam on every roster visit)
  useEffect(() => {
    if (!state.connected || clientIdUnconfigured) return;
    if (!hasValidToken()) return;
    if (state.lastSyncMs && Date.now() - state.lastSyncMs < PULL_COOLDOWN_MS) return;
    doPull();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced auto-push on roster changes — skip if no live token
  useEffect(() => {
    if (!state.connected) return;
    const handler = () => {
      if (!hasValidToken()) return;
      setStatus('pending');
      if (pushTimer.current) clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(() => doPush(), 10_000);
    };
    window.addEventListener('bg3:roster-changed', handler);
    return () => {
      window.removeEventListener('bg3:roster-changed', handler);
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.connected]);

  // Flush pending push then navigate — triggered by nav buttons on the roster
  useEffect(() => {
    if (!state.connected) return;
    const handler = async (e: Event) => {
      const { href } = (e as CustomEvent<{ href: string }>).detail;
      if (pushTimer.current) { clearTimeout(pushTimer.current); pushTimer.current = null; }
      // No live token — navigate immediately, skip push to avoid popup
      if (!hasValidToken()) { window.location.href = href; return; }
      setStatus('syncing');
      try {
        await syncPush(clientId, CharStorage.getRoster());
        setState(getDriveState());
        setStatus('idle');
      } catch (err) {
        handleError(err);
      } finally {
        window.location.href = href;
      }
    };
    window.addEventListener('bg3:sync-then-navigate', handler);
    return () => window.removeEventListener('bg3:sync-then-navigate', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.connected]);

  async function doPull() {
    setStatus('syncing');
    setError(null);
    try {
      const local = CharStorage.getRoster();
      const merged = await syncPull(clientId, local);
      CharStorage.saveRoster(merged);
      onRosterChange(CharStorage.getRoster());
      setState(getDriveState());
      setStatus('idle');
    } catch (e) {
      handleError(e);
    }
  }

  async function doPush() {
    setStatus('syncing');
    setError(null);
    try {
      await syncPush(clientId, CharStorage.getRoster());
      setState(getDriveState());
      setStatus('idle');
    } catch (e) {
      handleError(e);
    }
  }

  async function handleConnect() {
    setStatus('syncing');
    setError(null);
    try {
      await connectDrive(clientId);
      setState(getDriveState());
      await doPull();
    } catch (e) {
      if (e instanceof DriveAuthError) {
        setError('Connect cancelled');
        setState(getDriveState());
        setStatus('idle');
      } else {
        handleError(e);
      }
    }
  }

  function handleDisconnect() {
    disconnectDrive();
    setState(getDriveState());
    setStatus('idle');
    setError(null);
  }

  async function handleSyncNow() {
    if (pushTimer.current) { clearTimeout(pushTimer.current); pushTimer.current = null; }
    await doPull();
    if (status !== 'error') await doPush();
  }

  function handleError(e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    setError(msg);
    setStatus('error');
  }

  function formatLastSync(ms: number | null) {
    if (!ms) return 'never';
    return new Date(ms).toLocaleString();
  }

  if (clientIdUnconfigured) {
    return (
      <div className="drive-panel drive-panel--setup">
        <p className="drive-panel__title">Google Drive Sync</p>
        <p className="drive-panel__hint">
          Client ID not configured. See <code>docs/google-drive-admin-setup.md</code>.
        </p>
      </div>
    );
  }

  if (!state.connected) {
    return (
      <div className="drive-panel">
        <button
          className="btn-drive"
          onClick={handleConnect}
          disabled={status === 'syncing'}
        >
          {status === 'syncing' ? 'Connecting…' : '☁ CONNECT GOOGLE DRIVE'}
        </button>
        {error && <p className="drive-panel__error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="drive-panel drive-panel--connected">
      <span className="drive-panel__status">
        {status === 'syncing' && '↻ Syncing…'}
        {status === 'pending' && '● Pending sync'}
        {status === 'idle' && `☁ Synced ${formatLastSync(state.lastSyncMs)}`}
        {status === 'error' && '✕ Sync error'}
      </span>
      <button
        className="btn-drive btn-drive--sm"
        onClick={handleSyncNow}
        disabled={status === 'syncing'}
      >
        SYNC NOW
      </button>
      <button
        className="btn-drive btn-drive--ghost btn-drive--sm"
        onClick={handleDisconnect}
      >
        Disconnect
      </button>
      {error && <p className="drive-panel__error">{error}</p>}
    </div>
  );
}
