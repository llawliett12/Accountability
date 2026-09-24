// Tiny raw-IndexedDB wrapper. Deliberately dependency-free (no `idb`) since
// this repo has no other client-storage dependency — one object store, a
// handful of operations, doesn't warrant pulling in a library.

const DB_NAME = "accountability-offline";
const DB_VERSION = 1;
const STORE = "queue";

export interface QueuedAction {
  id: string; // == clientId, also used for idempotency server-side
  kind: OfflineActionKind;
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

export type OfflineActionKind =
  | "task_status"
  | "check_in"
  | "mood_log"
  | "focus_session_start"
  | "focus_pause_start"
  | "focus_pause_end";

function isSupported(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isSupported()) {
      reject(new Error("IndexedDB not supported in this environment"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueAction(action: QueuedAction): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(action);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listQueuedActions(): Promise<QueuedAction[]> {
  if (!isSupported()) return [];
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      // Insertion order matters (e.g. a focus session must sync before its
      // pauses) — IndexedDB's getAll on an auto-incrementing-free keyPath
      // store returns rows in primary-key order, not insertion order, so we
      // sort explicitly by createdAt to guarantee it.
      const rows = (req.result as QueuedAction[]).sort((a, b) => a.createdAt - b.createdAt);
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function removeQueuedAction(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateQueuedAction(action: QueuedAction): Promise<void> {
  return enqueueAction(action); // put() is an upsert
}
