import { useState, useEffect } from 'react';
import { Button, Modal } from '../ui';
import { listRevisions, restoreRevision } from '../../lib/wikiPersistence';
import type { WikiPageData, WikiRevision } from '../../types/wiki';
import styles from './RevisionHistoryModal.module.css';
interface RevisionHistoryModalProps {
    pageId: string;
    open: boolean;
    onClose: () => void;
    onRestored: (page: WikiPageData) => void;
    runExclusive?: <R>(fn: () => Promise<R>) => Promise<R | null>;
    canRestore?: boolean;
}
export function RevisionHistoryModal({ pageId, open, onClose, onRestored, canRestore = true, runExclusive, }: RevisionHistoryModalProps) {
    const [revisions, setRevisions] = useState<WikiRevision[]>([]);
    const [loading, setLoading] = useState(false);
    const [restoring, setRestoring] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        if (!open)
            return;
        setLoading(true);
        setError(null);
        listRevisions(pageId)
            .then(setRevisions)
            .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load history'))
            .finally(() => setLoading(false));
    }, [open, pageId]);
    const handleRestore = async (rev: WikiRevision) => {
        if (!canRestore)
            return;
        if (!window.confirm('Restore this revision? The current state is kept in history.'))
            return;
        setRestoring(rev.id);
        setError(null);
        try {
            const run = () => restoreRevision(pageId, rev);
            const page = runExclusive ? await runExclusive(run) : await run();
            if (page === null) {
                setError('A save is already running - try again in a moment.');
                return;
            }
            onRestored(page);
            onClose();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Restore failed');
        }
        finally {
            setRestoring(null);
        }
    };
    return (<Modal title="Revision History" open={open} onClose={onClose} wide>
      {error && <p className={styles.error}>{error}</p>}
      {loading ? (<p className={styles.muted}>Loading...</p>) : revisions.length === 0 ? (<p className={styles.muted}>No revisions yet - they are recorded automatically on save.</p>) : (<ul className={styles.list}>
          {revisions.map((rev, i) => (<li key={rev.id} className={styles.item}>
              <div className={styles.itemInfo}>
                <span className={styles.itemTitle}>
                  {rev.title}
                  {i === 0 && <span className={styles.currentBadge}>current</span>}
                </span>
                <span className={styles.itemMeta}>
                  {rev.author_username || 'unknown'} · {new Date(rev.created_at).toLocaleString()}
                  {rev.comment ? ` · ${rev.comment}` : ''}
                </span>
              </div>
              {i > 0 && canRestore && (<Button size="sm" onClick={() => handleRestore(rev)} disabled={restoring !== null}>
                  {restoring === rev.id ? 'Restoring...' : 'Restore'}
                </Button>)}
            </li>))}
        </ul>)}
    </Modal>);
}
