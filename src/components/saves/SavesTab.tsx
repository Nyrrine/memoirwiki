import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { listUserProjects, type SavedProjectMeta } from '../../lib/projectPersistence';
import { IdentityCard } from './IdentityCard';
import styles from './SavesTab.module.css';
interface SavesTabProps {
    onViewProject: (projectId: string) => void;
    refreshKey?: number;
}
export function SavesTab({ onViewProject, refreshKey = 0 }: SavesTabProps) {
    const user = useAuth((s) => s.user);
    const session = useAuth((s) => s.session);
    const [projects, setProjects] = useState<SavedProjectMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const refresh = useCallback(async () => {
        if (!user || !session)
            return;
        setLoading(true);
        setError(null);
        try {
            const list = await listUserProjects(user.id);
            setProjects(list);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load');
        }
        finally {
            setLoading(false);
        }
    }, [user, session]);
    useEffect(() => { refresh(); }, [refresh, refreshKey]);
    if (loading) {
        return (<div className={styles.grid}>
        {Array.from({ length: 6 }).map((_, i) => (<div key={i} className={styles.skeleton}>
            <div className={styles.skeletonFrame}/>
            <div className={styles.skeletonName}/>
          </div>))}
      </div>);
    }
    if (error) {
        return (<div className={styles.center}>
        <span className={styles.errorText}>{error}</span>
        <button className={styles.retryBtn} onClick={refresh} type="button">Retry</button>
      </div>);
    }
    if (projects.length === 0) {
        return (<div className={styles.center}>
        <span className={styles.emptyText}>No saved identities yet</span>
        <span className={styles.emptyHint}>Create an identity in the Maker tab and click Save</span>
      </div>);
    }
    return (<div className={styles.grid}>
      {projects.map((p) => (<IdentityCard key={p.id} project={p} onClick={() => onViewProject(p.id)}/>))}
    </div>);
}
