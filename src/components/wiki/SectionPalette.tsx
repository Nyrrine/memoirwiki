import { SECTION_TEMPLATES, type WikiSectionType } from '../../types/wiki';
import styles from './SectionPalette.module.css';
interface SectionPaletteProps {
    onAdd: (type: WikiSectionType) => void;
}
export function SectionPalette({ onAdd }: SectionPaletteProps) {
    return (<div className={styles.palette}>
      <h3 className={styles.title}>Add Section</h3>
      <p className={styles.hint}>Click to add, or drag to the preview</p>
      <div className={styles.grid}>
        {SECTION_TEMPLATES.map((tpl) => (<button key={tpl.type} type="button" className={styles.card} onClick={() => onAdd(tpl.type)} draggable onDragStart={(e) => {
                e.dataTransfer.setData('wiki-section-type', tpl.type);
                e.dataTransfer.effectAllowed = 'copy';
            }}>
            <span className={styles.icon}>{tpl.icon}</span>
            <span className={styles.label}>{tpl.label}</span>
            <span className={styles.desc}>{tpl.description}</span>
          </button>))}
      </div>
    </div>);
}
