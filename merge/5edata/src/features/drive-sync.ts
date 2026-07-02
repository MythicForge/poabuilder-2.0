import type { StoredChar } from '../core/types';
import { getTombstones, saveTombstones } from '../core/storage';

const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
const ROSTER_FILENAME = 'roster.json';
const DRIVE_STATE_KEY = 'bg3_drive_sync';
const FILES_API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';

export class DriveAuthError extends Error {
  constructor(msg?: string) { super(msg ?? 'Auth cancelled'); this.name = 'DriveAuthError'; }
}
export class DriveNetworkError extends Error {
  constructor(msg?: string) { super(msg ?? 'Network error'); this.name = 'DriveNetworkError'; }
}
export class DriveQuotaError extends Error {
  constructor(msg?: string) { super(msg ?? 'Drive quota exceeded'); this.name = 'DriveQuotaError'; }
}

export interface DriveState {
  connected: boolean;
  fileId: string | null;
  lastSyncMs: number | null;
}

export function getDriveState(): DriveState {
  try {
    return JSON.parse(localStorage.getItem(DRIVE_STATE_KEY) ?? 'null')
      ?? { connected: false, fileId: null, lastSyncMs: null };
  } catch {
    return { connected: false, fileId: null, lastSyncMs: null };
  }
}

export function saveDriveState(patch: Partial<DriveState>): void {
  localStorage.setItem(DRIVE_STATE_KEY, JSON.stringify({ ...getDriveState(), ...patch }));
}

// Token stored in module variable only — never persisted
let _token: string | null = null;
let _tokenExpiresAt = 0;

function setToken(accessToken: string, expiresIn: number): void {
  _token = accessToken;
  _tokenExpiresAt = Date.now() + expiresIn * 1000 - 60_000;
}

function isTokenValid(): boolean {
  return !!_token && Date.now() < _tokenExpiresAt;
}

/** True only if an in-memory token exists and hasn't expired. Use to guard
 *  background syncs — avoids triggering the Google account-chooser popup. */
export function hasValidToken(): boolean {
  return isTokenValid();
}

export function connectDrive(clientId: string, prompt = 'consent'): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new DriveAuthError(response.error));
          return;
        }
        setToken(response.access_token, response.expires_in ?? 3600);
        saveDriveState({ connected: true });
        resolve();
      },
    });
    client.requestAccessToken({ prompt });
  });
}

export function disconnectDrive(): void {
  if (_token) window.google.accounts.oauth2.revoke(_token, () => {});
  _token = null;
  _tokenExpiresAt = 0;
  localStorage.removeItem(DRIVE_STATE_KEY);
}

export async function ensureValidToken(clientId: string): Promise<string> {
  if (isTokenValid()) return _token!;
  try {
    await connectDrive(clientId, '');
  } catch {
    await connectDrive(clientId, 'select_account');
  }
  if (!_token) throw new DriveAuthError();
  return _token;
}

export async function findOrCreateRosterFile(token: string): Promise<string> {
  const search = await fetch(
    `${FILES_API}?spaces=appDataFolder&q=name%3D'${ROSTER_FILENAME}'&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!search.ok) throw new DriveNetworkError(`Search failed: ${search.status}`);
  const { files } = await search.json() as { files: { id: string }[] };
  if (files.length > 0) {
    saveDriveState({ fileId: files[0].id });
    return files[0].id;
  }

  const metadata = { name: ROSTER_FILENAME, parents: ['appDataFolder'] };
  const body = new FormData();
  body.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  body.append('file', new Blob(['[]'], { type: 'application/json' }));

  const create = await fetch(`${UPLOAD_API}?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  if (!create.ok) throw new DriveNetworkError(`Create failed: ${create.status}`);
  const { id } = await create.json() as { id: string };
  saveDriveState({ fileId: id });
  return id;
}

interface DrivePayload {
  v: 2;
  roster: StoredChar[];
  tombstones: Record<string, number>;
}

function parsePayload(data: unknown): DrivePayload {
  if (Array.isArray(data)) {
    // v1 format — plain array, no tombstones
    return { v: 2, roster: data as StoredChar[], tombstones: {} };
  }
  const d = data as Record<string, unknown>;
  if (d?.v === 2 && Array.isArray(d.roster)) {
    return { v: 2, roster: d.roster as StoredChar[], tombstones: (d.tombstones as Record<string, number>) ?? {} };
  }
  return { v: 2, roster: [], tombstones: {} };
}

export async function downloadRoster(token: string, fileId: string): Promise<DrivePayload> {
  const res = await fetch(`${FILES_API}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) throw new DriveNetworkError('FILE_NOT_FOUND');
  if (!res.ok) {
    if (res.status === 429 || res.status === 403) throw new DriveQuotaError();
    throw new DriveNetworkError(`Download failed: ${res.status}`);
  }
  try {
    return parsePayload(await res.json());
  } catch {
    throw new DriveNetworkError('PARSE_ERROR');
  }
}

export async function uploadRoster(
  token: string,
  fileId: string | null,
  roster: StoredChar[],
  tombstones: Record<string, number> = {}
): Promise<string> {
  const payload: DrivePayload = { v: 2, roster, tombstones };
  const metadata = fileId
    ? {}
    : { name: ROSTER_FILENAME, parents: ['appDataFolder'] };
  const body = new FormData();
  body.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  body.append('file', new Blob([JSON.stringify(payload)], { type: 'application/json' }));

  const url = fileId
    ? `${UPLOAD_API}/${fileId}?uploadType=multipart&fields=id`
    : `${UPLOAD_API}?uploadType=multipart&fields=id`;
  const method = fileId ? 'PATCH' : 'POST';

  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    body,
  });

  if (res.status === 404) {
    saveDriveState({ fileId: null });
    throw new DriveNetworkError('FILE_NOT_FOUND');
  }
  if (res.status === 429 || res.status === 403) throw new DriveQuotaError();
  if (!res.ok) throw new DriveNetworkError(`Upload failed: ${res.status}`);

  const { id } = await res.json() as { id: string };
  saveDriveState({ fileId: id });
  return id;
}

export function mergeRosters(
  local: StoredChar[],
  remote: StoredChar[],
  localTombstones: Record<string, number> = {},
  remoteTombstones: Record<string, number> = {}
): { roster: StoredChar[]; tombstones: Record<string, number> } {
  // Union tombstones — if either side deleted it, it stays deleted
  const tombstones: Record<string, number> = { ...remoteTombstones };
  for (const [id, ts] of Object.entries(localTombstones)) {
    tombstones[id] = Math.max(tombstones[id] ?? 0, ts);
  }

  const localMap = new Map(local.map(c => [c.id, c]));
  const remoteMap = new Map(remote.map(c => [c.id, c]));
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);
  const roster: StoredChar[] = [];

  for (const id of allIds) {
    if (id in tombstones) continue; // explicitly deleted — never resurface
    const l = localMap.get(id);
    const r = remoteMap.get(id);
    if (l && r) {
      roster.push((l._lastModified ?? 0) >= (r._lastModified ?? 0) ? l : r);
    } else {
      roster.push((l ?? r)!);
    }
  }

  return {
    roster: roster.sort((a, b) => (b._lastModified ?? 0) - (a._lastModified ?? 0)),
    tombstones,
  };
}

export async function syncPull(
  clientId: string,
  localRoster: StoredChar[]
): Promise<StoredChar[]> {
  const token = await ensureValidToken(clientId);
  let { fileId } = getDriveState();
  if (!fileId) fileId = await findOrCreateRosterFile(token);
  let remote: { roster: StoredChar[]; tombstones: Record<string, number> } = { roster: [], tombstones: {} };
  try {
    remote = await downloadRoster(token, fileId);
  } catch (e) {
    if (e instanceof DriveNetworkError && e.message === 'FILE_NOT_FOUND') {
      saveDriveState({ fileId: null });
      fileId = await findOrCreateRosterFile(token);
    } else throw e;
  }
  const { roster, tombstones } = mergeRosters(
    localRoster, remote.roster, getTombstones(), remote.tombstones
  );
  saveTombstones(tombstones);
  return roster;
}

export async function syncPush(clientId: string, roster: StoredChar[]): Promise<void> {
  const token = await ensureValidToken(clientId);
  let { fileId } = getDriveState();
  if (!fileId) fileId = await findOrCreateRosterFile(token);
  const tombstones = getTombstones();
  try {
    await uploadRoster(token, fileId, roster, tombstones);
  } catch (e) {
    if (e instanceof DriveNetworkError && e.message === 'FILE_NOT_FOUND') {
      await uploadRoster(token, null, roster, tombstones);
    } else throw e;
  }
  saveDriveState({ lastSyncMs: Date.now() });
}
