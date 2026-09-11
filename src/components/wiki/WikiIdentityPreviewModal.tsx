import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CardRenderer } from '../card/CardRenderer';
import { loadProject } from '../../lib/projectPersistence';
import { ExportDropdown } from '../ui/ExportDropdown';
import type { ProjectData } from '../../types/project';
import styles from './WikiIdentityPreviewModal.module.css';
interface WikiIdentityPreviewModalProps {
    projectId: string;
    onClose: () => void;
    detailUrl?: string;
}
export function WikiIdentityPreviewModal({ projectId, onClose, detailUrl }: WikiIdentityPreviewModalProps) {
    const navigate = useNavigate();
    const [data, setData] = useState<ProjectData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        let cancelled = false;
        loadProject(projectId)
            .then((result) => {
            if (cancelled)
                return;
            if (result)
                setData(result.data);
            else
                setError('Project not found');
            setLoading(false);
        })
            .catch((err) => {
            if (cancelled)
                return;
            setError(err instanceof Error ? err.message : 'Failed to load');
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, [projectId]);
    return (<div className={styles.backdrop} onClick={onClose}>
      <div className={styles.container}>
        {loading && <div className={styles.status}>Loading...</div>}
        {error && <div className={styles.statusError}>{error}</div>}
        {data && (<>
            <div className={styles.cardScale} onClick={(e) => e.stopPropagation()}>
              <CardRenderer data={data} leftTab="info"/>
            </div>
            <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
              {detailUrl && (<button className={styles.actionBtn} onClick={() => { onClose(); navigate(detailUrl); }} type="button">
                  View Details
                </button>)}
              <ExportDropdown data={data} buttonClassName={styles.actionBtn}/>
              <button className={styles.closeBtn} onClick={onClose} type="button">
                Close
              </button>
            </div>
          </>)}
      </div>
    </div>);
}
