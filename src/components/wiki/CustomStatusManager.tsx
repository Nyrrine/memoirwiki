import { useState, useEffect, useMemo } from 'react';
import { useAuth, roleAtLeast } from '../../hooks/useAuth';
import { useCustomStatusStore } from '../../hooks/useCustomStatusStore';
import { CLASSIFICATION_COLORS, CLASSIFICATION_LABELS } from '../../types/customStatus';
import { TOKEN_REGISTRY } from '../../lib/tokens';
import styles from './CustomStatusManager.module.css';
const MAX_ICON_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/webp,image/gif';
const BUILTIN_TOKEN_KEYS = new Set(Object.keys(TOKEN_REGISTRY));
function slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'custom';
}
export function CustomStatusManager() {
    const user = useAuth((s) => s.user);
    const profile = useAuth((s) => s.profile);
    const statuses = useCustomStatusStore((s) => s.statuses);
    const loading = useCustomStatusStore((s) => s.loading);
    const error = useCustomStatusStore((s) => s.error);
    const loadStatuses = useCustomStatusStore((s) => s.loadStatuses);
    const addStatus = useCustomStatusStore((s) => s.addStatus);
    const removeStatus = useCustomStatusStore((s) => s.removeStatus);
    const [scope, setScope] = useState<'mine' | 'all'>('mine');
    const [filter, setFilter] = useState('');
    const [adding, setAdding] = useState(false);
    const [name, setName] = useState('');
    const [key, setKey] = useState('');
    const [autoKey, setAutoKey] = useState(true);
    const [classification, setClassification] = useState<'standard' | 'neutral' | 'positive' | 'negative'>('standard');
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    useEffect(() => {
        loadStatuses();
    }, [loadStatuses]);
    const mine = useMemo(() => statuses.filter((st) => st.user_id === user?.id), [statuses, user?.id]);
    const shown = useMemo(() => {
        const list = scope === 'mine' ? mine : statuses;
        const q = filter.trim().toLowerCase();
        if (!q)
            return list;
        return list.filter((st) => st.name.toLowerCase().includes(q) || st.key.includes(q));
    }, [scope, mine, statuses, filter]);
    const handleNameChange = (val: string) => {
        setName(val);
        if (autoKey)
            setKey(slugify(val));
    };
    const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        if (file.size > MAX_ICON_BYTES) {
            alert('Icon must be under 10 MB');
            return;
        }
        setIconFile(file);
    };
    const handleCreate = async () => {
        if (!user || !name.trim() || !key.trim())
            return;
        if (BUILTIN_TOKEN_KEYS.has(key.trim())) {
            setSaveError('This key conflicts with a built-in status effect. Choose a different key.');
            return;
        }
        setSaving(true);
        setSaveError(null);
        try {
            await addStatus(user.id, name.trim(), key.trim(), classification, iconFile || undefined);
            setAdding(false);
            setName('');
            setKey('');
            setAutoKey(true);
            setClassification('standard');
            setIconFile(null);
        }
        catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Failed to create');
        }
        finally {
            setSaving(false);
        }
    };
    const handleDelete = async (id: string) => {
        if (!user)
            return;
        if (!window.confirm('Delete this custom status?'))
            return;
        try {
            await removeStatus(id, user.id);
        }
        catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete status');
        }
    };
    return (<div className={styles.manager}>
      <div className={styles.header}>
        <span className={styles.title}>Statuses</span>
        {!adding && (<button type="button" className={styles.addBtn} onClick={() => setAdding(true)}>+</button>)}
      </div>

      <div className={styles.scopeRow}>
        <button type="button" className={`${styles.scopeBtn} ${scope === 'mine' ? styles.scopeBtnOn : ''}`} onClick={() => { setScope('mine'); setFilter(''); }}>
          Mine ({mine.length})
        </button>
        <button type="button" className={`${styles.scopeBtn} ${scope === 'all' ? styles.scopeBtnOn : ''}`} onClick={() => setScope('all')}>
          Everyone ({statuses.length})
        </button>
      </div>

      {scope === 'all' && (<input className={styles.input} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search everyone's tokens..." aria-label="Search statuses"/>)}

      {loading && <p className={styles.hint}>Loading...</p>}
      {error && <p className={styles.error}>{error}</p>}

      {!loading && shown.length === 0 && (<p className={styles.hint}>
          {scope === 'mine'
                ? 'You have not made any yet. Use + to add one.'
                : 'Nothing matches that.'}
        </p>)}
      {shown.map((st) => (<div key={st.id} className={styles.item}>
          <div className={styles.itemLeft}>
            {st.icon_url ? (<img src={st.icon_url} alt="" className={styles.itemIcon}/>) : (<span className={styles.itemIconPlaceholder} style={{ background: CLASSIFICATION_COLORS[st.classification] }}/>)}
            <span className={styles.itemName}>{st.name}</span>
            <span className={styles.itemBadge} style={{ color: CLASSIFICATION_COLORS[st.classification] }}>
              {CLASSIFICATION_LABELS[st.classification]}
            </span>
            {scope === 'all' && (<span className={styles.itemKey}>:custom_{st.key}:</span>)}
          </div>
          {(st.user_id === user?.id || roleAtLeast(profile?.role, 'moderator')) && (<button type="button" className={styles.deleteBtn} onClick={() => handleDelete(st.id)} title="Delete">&#215;</button>)}
        </div>))}

      {adding && (<div className={styles.form}>
          <input className={styles.input} value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="Status name" maxLength={100}/>
          <div className={styles.keyRow}>
            <input className={styles.input} value={key} onChange={(e) => { setAutoKey(false); setKey(slugify(e.target.value)); }} placeholder="key_name" maxLength={50}/>
            <button type="button" className={styles.autoBtn} onClick={() => { setAutoKey(true); setKey(slugify(name)); }}>Auto</button>
          </div>
          <span className={styles.hint}>Use as :custom_{key}: in the editor</span>

          <div className={styles.classRow}>
            {(['standard', 'neutral', 'positive', 'negative'] as const).map((c) => (<button key={c} type="button" className={`${styles.classBtn} ${classification === c ? styles.classBtnActive : ''}`} style={{ borderColor: classification === c ? CLASSIFICATION_COLORS[c] : undefined }} onClick={() => setClassification(c)}>
                <span className={styles.classDot} style={{ background: CLASSIFICATION_COLORS[c] }}/>
                {CLASSIFICATION_LABELS[c]}
              </button>))}
          </div>

          <div className={styles.iconRow}>
            <span className={styles.iconLabel}>Icon (128x128 PNG recommended)</span>
            <input type="file" accept={ACCEPTED_IMAGE_TYPES} onChange={handleIconChange} className={styles.fileInput}/>
          </div>

          {saveError && <p className={styles.error}>{saveError}</p>}

          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => { setAdding(false); setSaveError(null); }}>Cancel</button>
            <button type="button" className={styles.createBtn} onClick={handleCreate} disabled={saving || !name.trim()}>
              {saving ? '...' : 'Create'}
            </button>
          </div>
        </div>)}
    </div>);
}
