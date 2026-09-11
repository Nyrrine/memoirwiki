import { Link } from 'react-router-dom';
import type { WikiPageMeta } from '../../types/wiki';
import styles from './WikiPageCard.module.css';
interface WikiPageCardProps {
    page: WikiPageMeta;
    onEdit?: () => void;
    onDelete?: () => void;
    showStatus?: boolean;
    onNavigate?: () => boolean;
}
const STATUS_LABEL: Record<string, string> = {
    draft: 'Draft', in_review: 'In review', archived: 'Archived',
};
const KIND_LABEL: Record<string, string> = {
    lore: 'Lore', character: 'Character', guide: 'Guide',
};
export function WikiPageCard({ page, onEdit, onDelete, showStatus, onNavigate }: WikiPageCardProps) {
    const title = page.title.trim() || 'Untitled';
    return (<div className={styles.card}>

      <div className={styles.badges} aria-hidden="true">
        {page.is_memoir && <span className={styles.memoir}>Memoir</span>}
        {showStatus && page.status !== 'published' && (<span className={`${styles.status} ${styles.draft}`}>
            {STATUS_LABEL[page.status] ?? page.status}
          </span>)}
      </div>
      <Link to={`/wiki/page/${page.slug}`} className={styles.body} onClick={(e) => { if (onNavigate && !onNavigate())
        e.preventDefault(); }}>
        <div className={styles.coverWrap}>
          {page.cover_image ? (<img src={page.cover_image} alt="" className={styles.cover} loading="lazy"/>) : (<div className={styles.coverPlaceholder} aria-hidden="true">
              <span className={styles.monogram}>{title[0]}</span>
            </div>)}
          <div className={styles.coverScrim} aria-hidden="true"/>
        </div>
        <div className={styles.info}>
          <span className={styles.kind} aria-hidden="true">{KIND_LABEL[page.kind] ?? page.kind}</span>
          <span className={styles.title}>{title}</span>
          {page.subtitle && <p className={styles.subtitle}>{page.subtitle}</p>}
        </div>
      </Link>
      {(onEdit || onDelete) && (<div className={styles.actions}>
          {onEdit && <button type="button" className={styles.editBtn} onClick={onEdit}>Edit</button>}
          {onDelete && <button type="button" className={styles.deleteBtn} onClick={onDelete}>Delete</button>}
        </div>)}
    </div>);
}
