import type { Descendant } from 'slate';
import type { QuoteSection } from '../../../types/wiki';
import { toSlateValue } from '../../../lib/slateHelpers';
import { SlateEditor } from '../../editor/SlateEditor';
import styles from './EditorFields.module.css';
interface QuoteEditorProps {
    section: QuoteSection;
    onUpdate: (patch: Partial<QuoteSection>) => void;
}
export function QuoteEditor({ section, onUpdate }: QuoteEditorProps) {
    return (<div className={styles.editorFields}>
      <label className={styles.label}>Quote Text</label>
      <div className={styles.slateWrap}>
        <SlateEditor value={toSlateValue(section.text)} onChange={(val: Descendant[]) => onUpdate({ text: val })} placeholder="Enter quote text... :token: [keyword] {#hex:text}"/>
      </div>

      <label className={styles.label}>Attribution</label>
      <input className={styles.input} value={section.attribution} onChange={(e) => onUpdate({ attribution: e.target.value })} placeholder="Who said this?" maxLength={200}/>

      <label className={styles.label}>Border Color</label>
      <div className={styles.fieldRow}>
        <input type="color" className={styles.colorInput} value={section.borderColor || '#d4af37'} onChange={(e) => onUpdate({ borderColor: e.target.value })}/>
        <input className={styles.inputSmall} value={section.borderColor || ''} onChange={(e) => onUpdate({ borderColor: e.target.value })} placeholder="#d4af37"/>
        {section.borderColor && <button type="button" className={styles.removeBtn} onClick={() => onUpdate({ borderColor: undefined })} title="Reset to default">↺</button>}
      </div>

      <label className={styles.label}>Text Color</label>
      <div className={styles.fieldRow}>
        <input type="color" className={styles.colorInput} value={section.textColor || '#e8e4dc'} onChange={(e) => onUpdate({ textColor: e.target.value })}/>
        <input className={styles.inputSmall} value={section.textColor || ''} onChange={(e) => onUpdate({ textColor: e.target.value })} placeholder="#e8e4dc"/>
        {section.textColor && <button type="button" className={styles.removeBtn} onClick={() => onUpdate({ textColor: undefined })} title="Reset to default">↺</button>}
      </div>

      <label className={styles.label}>Attribution Color</label>
      <div className={styles.fieldRow}>
        <input type="color" className={styles.colorInput} value={section.attributionColor || '#d4af37'} onChange={(e) => onUpdate({ attributionColor: e.target.value })}/>
        <input className={styles.inputSmall} value={section.attributionColor || ''} onChange={(e) => onUpdate({ attributionColor: e.target.value })} placeholder="#d4af37"/>
        {section.attributionColor && <button type="button" className={styles.removeBtn} onClick={() => onUpdate({ attributionColor: undefined })} title="Reset to default">↺</button>}
      </div>

    </div>);
}
