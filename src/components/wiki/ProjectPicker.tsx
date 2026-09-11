import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { listUserProjects, type SavedProjectMeta } from '../../lib/projectPersistence';
import styles from './ProjectPicker.module.css';
const GACHA_FRAME: Record<number, string> = {
    1: '/ui/gacha-frame-1.png',
    2: '/ui/gacha-frame-2.png',
    3: '/ui/gacha-frame-3.png',
};
interface ProjectPickerProps {
    selectedIds: string[];
    onConfirm: (selectedIds: string[]) => void;
    onClose: () => void;
}
export function ProjectPicker({ selectedIds, onConfirm, onClose }: ProjectPickerProps) {
    const user = useAuth((s) => s.user);
    const [projects, setProjects] = useState<SavedProjectMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));
    const userId = user?.id ?? null;
    const refresh = useCallback(async () => {
        if (!userId)
            return;
        setLoading(true);
        try {
            const list = await listUserProjects(userId);
            setProjects(list);
        }
        catch {
        }
        finally {
            setLoading(false);
        }
    }, [userId]);
    useEffect(() => { refresh(); }, [refresh]);
    const toggle = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id))
                next.delete(id);
            else
                next.add(id);
            return next;
        });
    };
    return (<div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Link Identities</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          {loading ? (<p className={styles.loading}>Loading projects...</p>) : projects.length === 0 ? (<p className={styles.empty}>No saved identities. Create one in the Maker tab first.</p>) : (<div className={styles.grid}>
              {projects.map((p) => {
                const isSelected = selected.has(p.id);
                const frameSrc = GACHA_FRAME[p.rarity] || GACHA_FRAME[1];
                return (<button key={p.id} type="button" className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`} onClick={() => toggle(p.id)}>
                    <div className={styles.frame}>
                      <div className={styles.portraitClip}>
                        {p.portrait_url ? (<img className={styles.portrait} src={p.portrait_url} alt={p.name}/>) : (<div className={styles.placeholder}>?</div>)}
                      </div>
                      <img className={styles.gachaFrame} src={frameSrc} alt=""/>
                    </div>
                    <div className={styles.nameGroup}>
                      <span className={styles.name}>{p.name || 'Untitled'}</span>
                      {p.character_name && p.character_name !== p.name && (<span className={styles.characterName}>{p.character_name}</span>)}
                    </div>
                    {isSelected && <span className={styles.check}>✓</span>}
                  </button>);
            })}
            </div>)}
        </div>

        <div className={styles.footer}>
          <span className={styles.count}>{selected.size} selected</span>
          <div className={styles.footerActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="button" className={styles.confirmBtn} onClick={() => onConfirm(Array.from(selected))}>
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>);
}
