const DB_NAME = 'memoir-drafts';
const DB_VERSION = 1;
const STORE = 'drafts';
const MAX_DRAFT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export interface DraftRecord<T = unknown> {
    key: string;
    payload: T;
    savedAt: number;
    baseUpdatedAt: string | null;
    droppedImages: boolean;
}
let dbPromise: Promise<IDBDatabase | null> | null = null;
function openDb(): Promise<IDBDatabase | null> {
    if (dbPromise)
        return dbPromise;
    const attempt = new Promise<IDBDatabase | null>((resolve) => {
        try {
            if (typeof indexedDB === 'undefined') {
                resolve(null);
                return;
            }
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    db.createObjectStore(STORE, { keyPath: 'key' });
                }
            };
            req.onsuccess = () => {
                const db = req.result;
                db.onclose = () => { dbPromise = null; };
                resolve(db);
            };
            req.onerror = () => resolve(null);
            req.onblocked = () => resolve(null);
        }
        catch {
            resolve(null);
        }
    });
    dbPromise = attempt.then((db) => {
        if (!db)
            dbPromise = null;
        return db;
    });
    return dbPromise;
}
function withStore<R>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<R | null> {
    return openDb().then((db) => {
        if (!db)
            return null;
        return new Promise<R | null>((resolve) => {
            try {
                const tx = db.transaction(STORE, mode);
                let result: R | null = null;
                const req = run(tx.objectStore(STORE));
                req.onsuccess = () => { result = req.result as R; };
                req.onerror = () => { result = null; };
                tx.oncomplete = () => resolve(result);
                tx.onabort = () => resolve(null);
                tx.onerror = () => resolve(null);
            }
            catch {
                dbPromise = null;
                resolve(null);
            }
        });
    });
}
let tabId: string | null = null;
function currentTab(): string {
    if (tabId)
        return tabId;
    try {
        let stored = sessionStorage.getItem('memoir-tab');
        if (!stored) {
            stored = crypto.randomUUID().slice(0, 8);
            sessionStorage.setItem('memoir-tab', stored);
        }
        tabId = stored;
    }
    catch {
        tabId = crypto.randomUUID().slice(0, 8);
    }
    return tabId;
}
export const draftKeys = {
    wikiPage: (pageId: string) => `wiki:${pageId}`,
    wikiIdentity: (linkId: string) => `identity:${linkId}`,
    card: (projectId: string | null) => (projectId ? `card:${projectId}` : `card:new:${currentTab()}`),
    live: (key: string) => `${key}#live`,
};
const OBJECT_URL = /^blob:https?:\/\//i;
function stripBlobUrls(input: unknown): {
    value: unknown;
    dropped: boolean;
} {
    let dropped = false;
    const walk = (node: unknown): unknown => {
        if (typeof node === 'string') {
            if (OBJECT_URL.test(node)) {
                dropped = true;
                return null;
            }
            return node;
        }
        if (Array.isArray(node))
            return node.map(walk);
        if (node && typeof node === 'object') {
            const out: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
                out[k] = walk(v);
            }
            return out;
        }
        return node;
    };
    return { value: walk(input), dropped };
}
export async function putDraft<T>(key: string, payload: T, baseUpdatedAt: string | null = null): Promise<boolean> {
    let record: DraftRecord<unknown>;
    try {
        const plain = JSON.parse(JSON.stringify(payload)) as unknown;
        const { value, dropped } = stripBlobUrls(plain);
        record = { key, payload: value, savedAt: Date.now(), baseUpdatedAt, droppedImages: dropped };
    }
    catch {
        return false;
    }
    return putRecord(record);
}
async function putRecord(record: DraftRecord<unknown>): Promise<boolean> {
    const ok = await withStore<IDBValidKey>('readwrite', (store) => store.put(record));
    return ok !== null;
}
export async function getDraft<T>(key: string): Promise<DraftRecord<T> | null> {
    const result = await withStore<DraftRecord<T> | undefined>('readonly', (store) => store.get(key));
    return result ?? null;
}
export async function deleteDraft(key: string): Promise<void> {
    await withStore('readwrite', (store) => store.delete(key));
}
export async function getNewestDraft<T>(key: string): Promise<DraftRecord<T> | null> {
    const liveKey = draftKeys.live(key);
    const [base, live] = await Promise.all([getDraft<T>(key), getDraft<T>(liveKey)]);
    if (!live)
        return base;
    await deleteDraft(liveKey);
    if (base && base.savedAt > live.savedAt)
        return base;
    const promoted = { ...live, key };
    await putRecord(promoted as DraftRecord<unknown>);
    return promoted;
}
export async function acceptDraft(key: string): Promise<void> {
    await deleteDraft(draftKeys.live(key));
}
export async function discardDraft(key: string): Promise<void> {
    const liveKey = draftKeys.live(key);
    const live = await getDraft(liveKey);
    if (live) {
        await deleteDraft(liveKey);
        await putRecord({ ...live, key });
    }
    else {
        await deleteDraft(key);
    }
}
export async function pruneDrafts(maxAgeMs = MAX_DRAFT_AGE_MS): Promise<void> {
    const all = await withStore<DraftRecord[]>('readonly', (store) => store.getAll());
    if (!all)
        return;
    const cutoff = Date.now() - maxAgeMs;
    await Promise.all(all.filter((d) => d.savedAt < cutoff).map((d) => deleteDraft(d.key)));
}
