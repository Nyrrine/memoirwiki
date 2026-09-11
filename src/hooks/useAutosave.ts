import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteDraft, draftKeys, putDraft } from '../lib/draftCache';
export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'local-only' | 'error';
export interface SaveResult {
    ok: boolean;
    stillDirty: boolean;
    permanent?: boolean;
}
interface UseAutosaveOptions<T> {
    key: string | null;
    data: T;
    isDirty: boolean;
    baseUpdatedAt?: string | null;
    save: () => Promise<SaveResult>;
    holdRecovery?: boolean;
    enabled?: boolean;
    remote?: boolean;
    pauseAuto?: boolean;
    localDelayMs?: number;
    remoteDelayMs?: number;
    remoteMaxWaitMs?: number;
    maxRemoteBytes?: number;
}
export interface AutosaveState {
    status: AutosaveStatus;
    localOk: boolean;
    saveNow: () => Promise<boolean>;
    runExclusive: <R>(fn: () => Promise<R>) => Promise<R | null>;
}
const DEFAULT_LOCAL_DELAY = 800;
const DEFAULT_REMOTE_DELAY = 45000;
const DEFAULT_REMOTE_MAX_WAIT = 180000;
const DEFAULT_MAX_REMOTE_BYTES = 1500000;
export function useAutosave<T>({ key, data, isDirty, baseUpdatedAt = null, save, holdRecovery = false, enabled = true, remote = true, pauseAuto = false, localDelayMs = DEFAULT_LOCAL_DELAY, remoteDelayMs = DEFAULT_REMOTE_DELAY, remoteMaxWaitMs = DEFAULT_REMOTE_MAX_WAIT, maxRemoteBytes = DEFAULT_MAX_REMOTE_BYTES, }: UseAutosaveOptions<T>): AutosaveState {
    const [status, setStatus] = useState<AutosaveStatus>('idle');
    const [localOk, setLocalOk] = useState(true);
    const [retryTick, setRetryTick] = useState(0);
    const dataRef = useRef(data);
    const keyRef = useRef(key);
    const holdRef = useRef(holdRecovery);
    const baseRef = useRef(baseUpdatedAt);
    const dirtyRef = useRef(isDirty);
    const saveRef = useRef(save);
    const remoteRef = useRef(remote);
    const pauseAutoRef = useRef(pauseAuto);
    const inFlight = useRef(false);
    const mounted = useRef(true);
    const dirtySince = useRef<number | null>(null);
    const failures = useRef(0);
    const queuedManual = useRef(false);
    const runSaveRef = useRef<(force: boolean) => Promise<boolean>>(async () => false);
    const savedClean = useRef(false);
    dataRef.current = data;
    keyRef.current = key;
    holdRef.current = holdRecovery;
    baseRef.current = baseUpdatedAt;
    saveRef.current = save;
    remoteRef.current = remote;
    pauseAutoRef.current = pauseAuto;
    dirtyRef.current = isDirty;
    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);
    useEffect(() => {
        dirtySince.current = isDirty ? (dirtySince.current ?? Date.now()) : null;
        if (isDirty)
            savedClean.current = false;
    }, [isDirty]);
    const writeKey = useCallback((): string | null => {
        const k = keyRef.current;
        if (!k)
            return null;
        return holdRef.current ? draftKeys.live(k) : k;
    }, []);
    const drainQueuedManual = useCallback(() => {
        if (!queuedManual.current)
            return;
        queuedManual.current = false;
        if (dirtyRef.current)
            void runSaveRef.current(true);
    }, []);
    const writeLocal = useCallback(async () => {
        const k = writeKey();
        if (!k)
            return;
        const ok = await putDraft(k, dataRef.current, baseRef.current);
        if (mounted.current)
            setLocalOk(ok);
    }, [writeKey]);
    const runSave = useCallback(async (force: boolean): Promise<boolean> => {
        if (!remoteRef.current)
            return false;
        if (inFlight.current) {
            if (force)
                queuedManual.current = true;
            return false;
        }
        if (!dirtyRef.current && !force)
            return false;
        dirtySince.current = Date.now();
        if (!force && maxRemoteBytes > 0) {
            let size = 0;
            try {
                size = new Blob([JSON.stringify(dataRef.current)]).size;
            }
            catch {
                size = 0;
            }
            if (size > maxRemoteBytes) {
                if (mounted.current)
                    setStatus('local-only');
                return false;
            }
        }
        inFlight.current = true;
        if (mounted.current)
            setStatus('saving');
        try {
            const result = await saveRef.current();
            if (!result.ok) {
                failures.current += 1;
                if (mounted.current) {
                    setStatus('error');
                    if (!result.permanent)
                        setRetryTick((t) => t + 1);
                }
                return false;
            }
            failures.current = 0;
            dirtyRef.current = result.stillDirty;
            const target = writeKey();
            if (target) {
                if (result.stillDirty) {
                    await writeLocal();
                }
                else {
                    savedClean.current = true;
                    await deleteDraft(target);
                }
            }
            if (mounted.current)
                setStatus('saved');
            return true;
        }
        catch {
            failures.current += 1;
            if (mounted.current) {
                setStatus('error');
                setRetryTick((t) => t + 1);
            }
            return false;
        }
        finally {
            inFlight.current = false;
            drainQueuedManual();
        }
    }, [maxRemoteBytes, writeLocal, writeKey, drainQueuedManual]);
    runSaveRef.current = runSave;
    useEffect(() => {
        if (!enabled || !key || !isDirty)
            return;
        const t = setTimeout(() => { void writeLocal(); }, localDelayMs);
        return () => clearTimeout(t);
    }, [enabled, key, isDirty, data, localDelayMs, writeLocal]);
    useEffect(() => {
        if (!enabled || !remote || pauseAuto || !key || !isDirty)
            return;
        const since = dirtySince.current ?? Date.now();
        const ceiling = Math.max(Math.max(0, remoteMaxWaitMs - (Date.now() - since)), remoteDelayMs);
        const backoff = failures.current > 0
            ? Math.min(remoteDelayMs * 2 ** failures.current, 300000)
            : remoteDelayMs;
        const delay = Math.min(backoff, ceiling);
        const t = setTimeout(() => { void runSave(false); }, delay);
        return () => clearTimeout(t);
    }, [enabled, remote, pauseAuto, key, isDirty, data, retryTick, remoteDelayMs, remoteMaxWaitMs, runSave]);
    const saveNow = useCallback(() => runSave(true), [runSave]);
    const runExclusive = useCallback(async <R,>(fn: () => Promise<R>): Promise<R | null> => {
        if (inFlight.current)
            return null;
        inFlight.current = true;
        try {
            return await fn();
        }
        finally {
            inFlight.current = false;
            drainQueuedManual();
        }
    }, [drainQueuedManual]);
    useEffect(() => {
        if (!enabled)
            return;
        const onHide = () => {
            if (document.visibilityState !== 'hidden')
                return;
            if (!keyRef.current || !dirtyRef.current)
                return;
            void writeLocal();
            if (remoteRef.current && !pauseAutoRef.current)
                void runSave(false);
        };
        document.addEventListener('visibilitychange', onHide);
        return () => document.removeEventListener('visibilitychange', onHide);
    }, [enabled, writeLocal, runSave]);
    useEffect(() => () => {
        if (dirtyRef.current && !savedClean.current && keyRef.current) {
            void putDraft(holdRef.current ? draftKeys.live(keyRef.current) : keyRef.current, dataRef.current, baseRef.current);
        }
    }, []);
    return { status, localOk, saveNow, runExclusive };
}
