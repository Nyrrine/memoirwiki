import { useState, useEffect, useMemo, useRef } from 'react';
import { listCategories, createCategory } from '../../lib/wikiPersistence';
import type { WikiCategory } from '../../types/wiki';
import styles from './CategoryPicker.module.css';
function slugify(text: string): string {
    const base = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (base)
        return base;
    let hash = 0;
    for (let i = 0; i < text.length; i++)
        hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    return `category-${Math.abs(hash).toString(36)}`;
}
interface CategoryPickerProps {
    selected: string[];
    onChange: (slugs: string[]) => void;
}
export function CategoryPicker({ selected, onChange }: CategoryPickerProps) {
    const [categories, setCategories] = useState<WikiCategory[]>([]);
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        listCategories().then(setCategories).catch(() => { });
    }, []);
    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
                setOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, []);
    const chosen = useMemo(() => selected.map((slug) => categories.find((c) => c.slug === slug) ?? { slug, name: slug, description: null }), [selected, categories]);
    const trimmed = query.trim();
    const matches = useMemo(() => {
        const q = trimmed.toLowerCase();
        return categories
            .filter((c) => !selected.includes(c.slug))
            .filter((c) => !q || c.name.toLowerCase().includes(q) || c.slug.includes(q))
            .slice(0, 8);
    }, [categories, selected, trimmed]);
    const exact = categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase() || c.slug === slugify(trimmed));
    const canCreate = trimmed.length > 0 && !exact;
    const rows = canCreate ? matches.length + 1 : matches.length;
    const alreadyPicked = trimmed.length > 0 && rows === 0
        && chosen.some((c) => c.name.toLowerCase() === trimmed.toLowerCase() || c.slug === slugify(trimmed));
    const pick = (slug: string) => {
        onChange([...selected, slug]);
        setQuery('');
        setActive(0);
    };
    const create = async () => {
        if (!canCreate || busy)
            return;
        setBusy(true);
        setError(null);
        try {
            const cat = await createCategory(slugify(trimmed), trimmed);
            setCategories((prev) => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)));
            onChange([...selected, cat.slug]);
            setQuery('');
            setActive(0);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Could not create that category');
        }
        finally {
            setBusy(false);
        }
    };
    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, rows - 1));
        }
        else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
        }
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (active < matches.length)
                pick(matches[active].slug);
            else if (canCreate)
                void create();
        }
        else if (e.key === 'Escape') {
            setOpen(false);
            setQuery('');
        }
        else if (e.key === 'Backspace') {
            if (query)
                return;
            if (e.repeat)
                return;
            if (selected.length > 0)
                onChange(selected.slice(0, -1));
        }
    };
    return (<div className={styles.picker} ref={wrapRef}>
      {chosen.length > 0 && (<div className={styles.chips}>
          {chosen.map((c) => (<span key={c.slug} className={styles.chip}>
              {c.name}
              <button type="button" className={styles.chipRemove} aria-label={`Remove ${c.name}`} onClick={() => onChange(selected.filter((s) => s !== c.slug))}>
                &#215;
              </button>
            </span>))}
        </div>)}

      <div className={styles.inputWrap}>
        <input className={styles.input} value={query} placeholder={selected.length ? 'Add another...' : 'Search categories, or type a new one'} maxLength={100} onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }} onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onKeyDown={onKeyDown} role="combobox" aria-expanded={open} aria-controls="category-options"/>
      </div>

      {open && rows > 0 && (<ul className={styles.options} id="category-options" role="listbox">
          {matches.map((c, i) => (<li key={c.slug}>
              <button type="button" role="option" aria-selected={i === active} className={`${styles.option} ${i === active ? styles.optionActive : ''}`} onMouseEnter={() => setActive(i)} onClick={() => pick(c.slug)}>
                <span className={styles.optionName}>{c.name}</span>
                {c.description && <span className={styles.optionDesc}>{c.description}</span>}
              </button>
            </li>))}
          {canCreate && (<li>
              <button type="button" role="option" aria-selected={active === matches.length} className={`${styles.option} ${styles.optionCreate} ${active === matches.length ? styles.optionActive : ''}`} onMouseEnter={() => setActive(matches.length)} onClick={() => { void create(); }} disabled={busy}>
                {busy ? 'Creating...' : <>Create &ldquo;<strong>{trimmed}</strong>&rdquo;</>}
              </button>
            </li>)}
        </ul>)}

      {open && alreadyPicked && (<p className={styles.hint}>Already added to this page.</p>)}
      {open && rows === 0 && !trimmed && categories.length === 0 && (<p className={styles.hint}>No categories yet - type a name to make the first one.</p>)}
      {error && <span className={styles.error}>{error}</span>}
    </div>);
}
