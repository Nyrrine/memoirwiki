import type { IdentityShowcaseSection } from '../../../types/wiki';
import styles from './EditorFields.module.css';
interface IdentityShowcaseEditorProps {
    section: IdentityShowcaseSection;
    onUpdate: (patch: Partial<IdentityShowcaseSection>) => void;
    onLinkIdentities?: () => void;
}
export function IdentityShowcaseEditor({ section, onUpdate, onLinkIdentities }: IdentityShowcaseEditorProps) {
    return (<div className={styles.editorFields}>
      <label className={styles.label}>Heading</label>
      <input className={styles.input} value={section.heading} onChange={(e) => onUpdate({ heading: e.target.value })} placeholder="e.g. Identities" maxLength={200}/>
      <label className={styles.label}>Heading Color</label>
      <div className={styles.fieldRow}>
        <input type="color" className={styles.colorInput} value={section.headingColor || '#d4af37'} onChange={(e) => onUpdate({ headingColor: e.target.value })}/>
        <input className={styles.inputSmall} value={section.headingColor || ''} onChange={(e) => onUpdate({ headingColor: e.target.value })} placeholder="#d4af37"/>
        {section.headingColor && <button type="button" className={styles.removeBtn} onClick={() => onUpdate({ headingColor: undefined })} title="Reset to default">↺</button>}
      </div>
      {onLinkIdentities && (<button type="button" className={styles.addBtn} onClick={onLinkIdentities}>
          Link Identities
        </button>)}
    </div>);
}
