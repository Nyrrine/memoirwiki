import type { DividerSection, DividerStyle } from '../../../types/wiki';
import styles from './EditorFields.module.css';
const DIVIDER_STYLES: {
    value: DividerStyle;
    label: string;
}[] = [
    { value: 'gold', label: 'Gold Gradient' },
    { value: 'thin', label: 'Thin Line' },
    { value: 'ornamental', label: 'Ornamental' },
];
interface DividerEditorProps {
    section: DividerSection;
    onUpdate: (patch: Partial<DividerSection>) => void;
}
export function DividerEditor({ section, onUpdate }: DividerEditorProps) {
    return (<div className={styles.editorFields}>
      <label className={styles.label}>Style</label>
      <select className={styles.select} value={section.style} onChange={(e) => onUpdate({ style: e.target.value as DividerStyle })}>
        {DIVIDER_STYLES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
      </select>

      <label className={styles.label}>Color</label>
      <div className={styles.fieldRow}>
        <input type="color" className={styles.colorInput} value={section.color || '#d4af37'} onChange={(e) => onUpdate({ color: e.target.value })}/>
        <input className={styles.inputSmall} value={section.color || ''} onChange={(e) => onUpdate({ color: e.target.value })} placeholder="#d4af37"/>
        {section.color && <button type="button" className={styles.removeBtn} onClick={() => onUpdate({ color: undefined })} title="Reset to default">↺</button>}
      </div>
    </div>);
}
