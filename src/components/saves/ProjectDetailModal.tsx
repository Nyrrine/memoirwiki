import { useState, useEffect, useRef } from 'react';
import { CardRenderer } from '../card/CardRenderer';
import { loadProject, deleteProject } from '../../lib/projectPersistence';
import { ExportDropdown } from '../ui/ExportDropdown';
import type { ProjectData } from '../../types/project';
import styles from './ProjectDetailModal.module.css';
interface ProjectDetailModalProps {
    projectId: string;
    userId: string;
    onClose: () => void;
    onEdit: (data: ProjectData, projectId: string) => void;
    onDeleted: () => void;
}
export function ProjectDetailModal({ projectId, userId, onClose, onEdit, onDeleted }: ProjectDetailModalProps) {
    const [data, setData] = useState<ProjectData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        let cancelled = false;
        loadProject(projectId)
            .then((result) => {
            if (cancelled)
                return;
            if (result) {
                setData(result.data);
            }
            else {
                setError('Project not found');
            }
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
    const handleDelete = async () => {
        if (!confirmDelete) {
            setConfirmDelete(true);
            return;
        }
        setDeleting(true);
        try {
            await deleteProject(projectId, userId);
            onDeleted();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Delete failed');
            setDeleting(false);
            setConfirmDelete(false);
        }
    };
    const handleEdit = () => {
        if (data) {
            onEdit(data, projectId);
        }
    };
    return (<div className={styles.backdrop} onClick={onClose}>
      <div className={styles.container}>
        {loading && <div className={styles.status}>Loading...</div>}
        {error && <div className={styles.statusError}>{error}</div>}
        {data && (<>
            <div className={styles.cardScale} onClick={(e) => e.stopPropagation()}>
              <div ref={cardRef}>
                <CardRenderer data={data} leftTab="info"/>
              </div>
            </div>
            <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
              <button className={styles.editBtn} onClick={handleEdit} type="button">
                Edit
              </button>
              <ExportDropdown data={data} buttonClassName={styles.downloadBtn}/>
              <button className={`${styles.deleteBtn} ${confirmDelete ? styles.deleteBtnConfirm : ''}`} onClick={handleDelete} disabled={deleting} type="button">
                {deleting ? '...' : confirmDelete ? 'Confirm' : 'Delete'}
              </button>
            </div>
          </>)}
      </div>
    </div>);
}
