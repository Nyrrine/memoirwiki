import { useState } from 'react';
import type { CollapsibleSection } from '../../../types/wiki';
import { CardRichText } from '../../card/CardRichText';
import styles from './CollapsibleView.module.css';
interface CollapsibleViewProps {
    section: CollapsibleSection;
}
export function CollapsibleView({ section }: CollapsibleViewProps) {
    const [open, setOpen] = useState(false);
    return (<div className={styles.section}>
      <button type="button" className={styles.toggle} onClick={() => setOpen(!open)}>
        <span className={styles.icon}>{open ? '▾' : '▸'}</span>
        <span className={styles.heading} style={section.headingColor ? { color: section.headingColor } : undefined}>{section.heading || 'Details'}</span>
      </button>
      {open && (<div className={styles.content}>
          <CardRichText content={section.content}/>
        </div>)}
    </div>);
}
