/**
 * Keeps NewOrder sync running across dashboard unmount/remount and page refresh.
 * Sync orchestration lives here (module scope), not in React component state.
 */

import {
  fetchNewOrderStatus,
  runFullNewOrderSync,
  type NewOrderSyncCheckpoint,
  type NewOrderSyncResult,
} from "./client";

const STORAGE_KEY = "storyphone.neworder.sync.session";
const DEFAULT_HOURS = 24;
const STALE_MS = 45 * 60 * 1000;

export interface NewOrderSyncUIState {
  syncing: boolean;
  progress: string | null;
  error: string | null;
  lastResult: NewOrderSyncResult | null;
}

interface StoredSyncSession extends NewOrderSyncCheckpoint {
  progress: string;
  startedAt: number;
}

type SyncListener = (state: NewOrderSyncUIState) => void;

let uiState: NewOrderSyncUIState = {
  syncing: false,
  progress: null,
  error: null,
  lastResult: null,
};

let listeners = new Set<SyncListener>();
let syncPromise: Promise<NewOrderSyncResult> | null = null;

function notify() {
  for (const listener of listeners) {
    listener(uiState);
  }
}

function readStoredSession(): StoredSyncSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSyncSession;
    if (!parsed || typeof parsed !== "object") return null;
    if (!Number.isFinite(parsed.stepIndex) || parsed.stepIndex < 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredSession(session: StoredSyncSession) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function clearStoredSession() {
  sessionStorage.removeItem(STORAGE_KEY);
}

function toCheckpoint(session: StoredSyncSession): NewOrderSyncCheckpoint {
  return {
    runId: session.runId,
    hours: session.hours ?? DEFAULT_HOURS,
    stepIndex: session.stepIndex,
    productPage: session.productPage ?? 1,
    documentTaskOffset: session.documentTaskOffset ?? 0,
  };
}

function isSessionStale(session: StoredSyncSession): boolean {
  return Date.now() - session.startedAt > STALE_MS;
}

function checkpointFromStatus(
  pendingLineItems: number,
  runId: string,
  hours = DEFAULT_HOURS,
): NewOrderSyncCheckpoint {
  if (pendingLineItems > 0) {
    return {
      runId,
      hours,
      stepIndex: 3,
      productPage: 1,
      documentTaskOffset: 0,
    };
  }
  return {
    runId,
    hours,
    stepIndex: 0,
    productPage: 1,
    documentTaskOffset: 0,
  };
}

export function getNewOrderSyncUIState(): NewOrderSyncUIState {
  return uiState;
}

export function subscribeNewOrderSync(listener: SyncListener): () => void {
  listeners.add(listener);
  listener(uiState);
  return () => {
    listeners.delete(listener);
  };
}

export function hasActiveNewOrderSyncSession(): boolean {
  return readStoredSession() !== null || uiState.syncing;
}

async function resolveResumeCheckpoint(hours: number): Promise<NewOrderSyncCheckpoint | undefined> {
  const stored = readStoredSession();
  if (stored && !isSessionStale(stored)) {
    if (stored.hours === hours) {
      return toCheckpoint(stored);
    }
  }

  try {
    const status = await fetchNewOrderStatus();
    const last = status.last_sync;
    if (last?.status === "running" && last.id) {
      const started = Date.parse(last.started_at);
      if (Number.isFinite(started) && Date.now() - started < STALE_MS) {
        return checkpointFromStatus(status.pending_line_items ?? 0, last.id, hours);
      }
    }
  } catch {
    // ignore — start fresh
  }

  if (stored && !isSessionStale(stored)) {
    return toCheckpoint(stored);
  }

  return undefined;
}

async function runSyncJob(
  hours: number,
  checkpoint?: NewOrderSyncCheckpoint,
): Promise<NewOrderSyncResult> {
  const startedAt = checkpoint ? readStoredSession()?.startedAt ?? Date.now() : Date.now();
  let stepIndex = checkpoint?.stepIndex ?? 0;
  let productPage = checkpoint?.productPage ?? 1;
  let documentTaskOffset = checkpoint?.documentTaskOffset ?? 0;
  let runId = checkpoint?.runId;

  uiState = {
    syncing: true,
    progress: checkpoint ? "Resuming sync…" : "Starting…",
    error: null,
    lastResult: null,
  };
  notify();

  const persist = (progress: string) => {
    writeStoredSession({
      runId,
      hours,
      stepIndex,
      productPage,
      documentTaskOffset,
      progress,
      startedAt,
    });
    uiState = { ...uiState, progress };
    notify();
  };

  persist(uiState.progress ?? "Starting…");

  try {
    const result = await runFullNewOrderSync({
      hours,
      checkpoint: checkpoint
        ? { runId, hours, stepIndex, productPage, documentTaskOffset }
        : undefined,
      onProgress: (message) => {
        persist(message);
      },
      onCheckpoint: (next) => {
        stepIndex = next.stepIndex;
        productPage = next.productPage;
        documentTaskOffset = next.documentTaskOffset;
        runId = next.runId;
        persist(uiState.progress ?? "Syncing…");
      },
    });

    clearStoredSession();
    uiState = { syncing: false, progress: null, error: null, lastResult: result };
    notify();
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed.";
    uiState = { syncing: false, progress: null, error: message, lastResult: null };
    notify();
    throw error;
  }
}

/** Start sync or attach to an in-flight sync. Resumes from session unless forceNew. */
export function startNewOrderSync(
  hours = DEFAULT_HOURS,
  options?: { forceNew?: boolean },
): Promise<NewOrderSyncResult> {
  if (syncPromise) {
    return syncPromise;
  }

  syncPromise = (async () => {
    if (options?.forceNew) {
      clearStoredSession();
    }
    const resume = options?.forceNew ? undefined : await resolveResumeCheckpoint(hours);
    return runSyncJob(hours, resume);
  })().finally(() => {
    syncPromise = null;
  });

  return syncPromise;
}

/** Resume after navigation/refresh if a session or server-side running sync exists. */
export async function resumeNewOrderSyncIfNeeded(
  hours = DEFAULT_HOURS,
): Promise<NewOrderSyncResult | null> {
  if (syncPromise) {
    return syncPromise;
  }

  const stored = readStoredSession();
  if (stored && !isSessionStale(stored)) {
    return startNewOrderSync(hours);
  }

  try {
    const status = await fetchNewOrderStatus();
    if (status.last_sync?.status === "running") {
      const started = Date.parse(status.last_sync.started_at);
      if (Number.isFinite(started) && Date.now() - started < STALE_MS) {
        return startNewOrderSync(hours);
      }
    }
  } catch {
    // ignore
  }

  return null;
}
