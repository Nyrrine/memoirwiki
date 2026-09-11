import type { Descendant } from 'slate';
import type { InfoboxSection, InfoboxField } from '../../../types/wiki';
import { EMPTY_SLATE_VALUE, toSlateValue } from '../../../lib/slateHelpers';
import { SlateEditor } from '../../editor/SlateEditor';
import styles from './EditorFields.module.css';
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_FIELDS = 30;
const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/webp,image/gif';
interface InfoboxEditorProps {
    section: InfoboxSection;
    onUpdate: (patch: Partial<InfoboxSection>) => void;
}
export function InfoboxEditor({ section, onUpdate }: InfoboxEditorProps) {
    const handlePortrait = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        if (file.size > MAX_UPLOAD_BYTES) {
            alert('Image must be under 10 MB');
            return;
        }
        onUpdate({ portraitUrl: URL.createObjectURL(file) });
    };
    const updateField = (index: number, patch: Partial<InfoboxField>) => {
        const fields = [...section.fields];
        fields[index] = { ...fields[index], ...patch };
        onUpdate({ fields });
    };
    const addField = () => {
        onUpdate({ fields: [...section.fields, { label: '', value: EMPTY_SLATE_VALUE }] });
    };
    const addHeader = () => {
        onUpdate({ fields: [...section.fields, { label: '', value: '', isHeader: true }] });
    };
    const removeField = (index: number) => {
        onUpdate({ fields: section.fields.filter((_, i) => i !== index) });
    };
    return (<div className={styles.editorFields}>
      <label className={styles.label}>Character Name</label>
      <input className={styles.input} value={section.characterName} onChange={(e) => onUpdate({ characterName: e.target.value })} placeholder="Character name" maxLength={200}/>

      <label className={styles.label}>Subtitle</label>
      <input className={styles.input} value={section.subtitle || ''} onChange={(e) => onUpdate({ subtitle: e.target.value || undefined })} placeholder="Optional subtitle (shown below portrait)" maxLength={500}/>

      <label className={styles.label}>Portrait</label>
      <div className={styles.imageRow}>
        {section.portraitUrl && (<img src={section.portraitUrl} alt="" className={styles.preview}/>)}
        <input type="file" accept={ACCEPTED_IMAGE_TYPES} onChange={handlePortrait} className={styles.fileInput}/>
        {section.portraitUrl && (<button type="button" className={styles.clearBtn} onClick={() => onUpdate({ portraitUrl: null })}>Clear</button>)}
      </div>

      <label className={styles.label}>Fields</label>
      {section.fields.map((field, i) => (field.isHeader ? (<div key={i} className={styles.fieldRow}>
            <input className={styles.input} value={field.label} onChange={(e) => updateField(i, { label: e.target.value })} placeholder="Section Header" maxLength={100} style={{ fontWeight: 'bold', textAlign: 'center' }}/>
            <button type="button" className={styles.removeBtn} onClick={() => removeField(i)}>&#10005;</button>
          </div>) : (<div key={i} className={styles.fieldRow}>
            <input className={styles.inputSmall} value={field.label} onChange={(e) => updateField(i, { label: e.target.value })} placeholder="Label" maxLength={100}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <SlateEditor compact value={toSlateValue(field.value)} onChange={(val: Descendant[]) => updateField(i, { value: val })} placeholder="Value - :token: [keyword] {#hex:text}"/>
            </div>
            <button type="button" className={styles.removeBtn} onClick={() => removeField(i)}>&#10005;</button>
          </div>)))}
      {section.fields.length >= MAX_FIELDS ? (<p className={styles.hint}>Field limit reached ({MAX_FIELDS})</p>) : (<div className={styles.fieldRow}>
          <button type="button" className={styles.addBtn} onClick={addField} style={{ flex: 1 }}>+ Field</button>
          <button type="button" className={styles.addBtn} onClick={addHeader} style={{ flex: 1 }}>+ Section Header</button>
        </div>)}

      <label className={styles.label}>Border Color</label>
      <div className={styles.fieldRow}>
        <input type="color" className={styles.colorInput} value={section.borderColor || '#d4af37'} onChange={(e) => onUpdate({ borderColor: e.target.value })}/>
        <input className={styles.inputSmall} value={section.borderColor || ''} onChange={(e) => onUpdate({ borderColor: e.target.value })} placeholder="#d4af37"/>
        {section.borderColor && <button type="button" className={styles.removeBtn} onClick={() => onUpdate({ borderColor: undefined })} title="Reset to default">&#8634;</button>}
      </div>

      <label className={styles.label}>Name Color</label>
      <div className={styles.fieldRow}>
        <input type="color" className={styles.colorInput} value={section.nameColor || '#d4af37'} onChange={(e) => onUpdate({ nameColor: e.target.value })}/>
        <input className={styles.inputSmall} value={section.nameColor || ''} onChange={(e) => onUpdate({ nameColor: e.target.value })} placeholder="#d4af37"/>
        {section.nameColor && <button type="button" className={styles.removeBtn} onClick={() => onUpdate({ nameColor: undefined })} title="Reset to default">&#8634;</button>}
      </div>

      <label className={styles.label}>Label Color</label>
      <div className={styles.fieldRow}>
        <input type="color" className={styles.colorInput} value={section.labelColor || '#d4af37'} onChange={(e) => onUpdate({ labelColor: e.target.value })}/>
        <input className={styles.inputSmall} value={section.labelColor || ''} onChange={(e) => onUpdate({ labelColor: e.target.value })} placeholder="#d4af37"/>
        {section.labelColor && <button type="button" className={styles.removeBtn} onClick={() => onUpdate({ labelColor: undefined })} title="Reset to default">&#8634;</button>}
      </div>
    </div>);
}
