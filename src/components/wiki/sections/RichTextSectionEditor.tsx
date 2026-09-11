import type { Descendant } from 'slate';
import type { RichTextSection } from '../../../types/wiki';
import { SlateEditor } from '../../editor/SlateEditor';
import styles from './EditorFields.module.css';
interface RichTextSectionEditorProps {
    section: RichTextSection;
    onUpdate: (patch: Partial<RichTextSection>) => void;
}
export function RichTextSectionEditor({ section, onUpdate }: RichTextSectionEditorProps) {
    return (<div className={styles.editorFields}>
      <label className={styles.label}>Heading</label>
      <input className={styles.input} value={section.heading} onChange={(e) => onUpdate({ heading: e.target.value })} placeholder="Section heading (optional)" maxLength={200}/>

      <label className={styles.label}>Heading Color</label>
      <div className={styles.fieldRow}>
        <input type="color" className={styles.colorInput} value={section.headingColor || '#d4af37'} onChange={(e) => onUpdate({ headingColor: e.target.value })}/>
        <input className={styles.inputSmall} value={section.headingColor || ''} onChange={(e) => onUpdate({ headingColor: e.target.value })} placeholder="#d4af37"/>
        {section.headingColor && <button type="button" className={styles.removeBtn} onClick={() => onUpdate({ headingColor: undefined })} title="Reset to default">↺</button>}
      </div>

      <label className={styles.label}>Content</label>
      <div className={styles.slateWrap}>
        <SlateEditor value={section.content} onChange={(value: Descendant[]) => onUpdate({ content: value })} placeholder="Write content..."/>
      </div>
    </div>);
}
