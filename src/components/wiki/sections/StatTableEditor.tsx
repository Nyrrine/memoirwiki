import type { Descendant } from 'slate';
import type { StatTableSection, StatTableRow } from '../../../types/wiki';
import { EMPTY_SLATE_VALUE, toSlateValue } from '../../../lib/slateHelpers';
import { SlateEditor } from '../../editor/SlateEditor';
import styles from './EditorFields.module.css';
const MAX_ROWS = 50;
interface StatTableEditorProps {
    section: StatTableSection;
    onUpdate: (patch: Partial<StatTableSection>) => void;
}
export function StatTableEditor({ section, onUpdate }: StatTableEditorProps) {
    const updateRow = (index: number, patch: Partial<StatTableRow>) => {
        const rows = [...section.rows];
        rows[index] = { ...rows[index], ...patch };
        onUpdate({ rows });
    };
    const addRow = () => {
        onUpdate({ rows: [...section.rows, { label: '', value: EMPTY_SLATE_VALUE }] });
    };
    const removeRow = (index: number) => {
        onUpdate({ rows: section.rows.filter((_, i) => i !== index) });
    };
    return (<div className={styles.editorFields}>
      <label className={styles.label}>Heading</label>
      <input className={styles.input} value={section.heading} onChange={(e) => onUpdate({ heading: e.target.value })} placeholder="Table heading (optional)" maxLength={200}/>

      <label className={styles.label}>Rows</label>
      {section.rows.map((row, i) => (<div key={i} className={styles.fieldRow}>
          <input className={styles.inputSmall} value={row.label} onChange={(e) => updateRow(i, { label: e.target.value })} placeholder="Label" maxLength={100}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <SlateEditor compact value={toSlateValue(row.value)} onChange={(val: Descendant[]) => updateRow(i, { value: val })} placeholder="Value - :token: [keyword]"/>
          </div>
          <input type="color" className={styles.colorInput} value={row.color || '#e8e4dc'} onChange={(e) => updateRow(i, { color: e.target.value })} title="Value color"/>
          <button type="button" className={styles.removeBtn} onClick={() => removeRow(i)}>✕</button>
        </div>))}
      {section.rows.length >= MAX_ROWS ? (<p className={styles.hint}>Row limit reached ({MAX_ROWS})</p>) : (<button type="button" className={styles.addBtn} onClick={addRow}>+ Add Row</button>)}

      <label className={styles.label}>Heading Color</label>
      <div className={styles.fieldRow}>
        <input type="color" className={styles.colorInput} value={section.headingColor || '#d4af37'} onChange={(e) => onUpdate({ headingColor: e.target.value })}/>
        <input className={styles.inputSmall} value={section.headingColor || ''} onChange={(e) => onUpdate({ headingColor: e.target.value })} placeholder="#d4af37"/>
        {section.headingColor && <button type="button" className={styles.removeBtn} onClick={() => onUpdate({ headingColor: undefined })} title="Reset to default">↺</button>}
      </div>

      <label className={styles.label}>Label Color</label>
      <div className={styles.fieldRow}>
        <input type="color" className={styles.colorInput} value={section.labelColor || '#d4af37'} onChange={(e) => onUpdate({ labelColor: e.target.value })}/>
        <input className={styles.inputSmall} value={section.labelColor || ''} onChange={(e) => onUpdate({ labelColor: e.target.value })} placeholder="#d4af37"/>
        {section.labelColor && <button type="button" className={styles.removeBtn} onClick={() => onUpdate({ labelColor: undefined })} title="Reset to default">↺</button>}
      </div>

    </div>);
}
