import type { Passive, SinType } from '../../types/project';
import type { Descendant } from 'slate';
import { SlateEditor } from './SlateEditor';
import styles from './SkillEditor.module.css';
import pStyles from './PassiveEditor.module.css';
const ALL_SINS: SinType[] = ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy'];
interface PassiveEditorProps {
    passive: Passive;
    type: 'combat' | 'support' | 'custom';
    onUpdate: (patch: Partial<Passive>) => void;
}
export function PassiveEditor({ passive, type, onUpdate }: PassiveEditorProps) {
    return (<div className={styles.editor}>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>Name</span>
        <input className={styles.textInput} type="text" value={passive.name} onChange={(e) => onUpdate({ name: e.target.value })} placeholder="Passive name"/>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Label</span>
        <input className={styles.textInput} type="text" value={passive.label || ''} onChange={(e) => onUpdate({ label: e.target.value || undefined })} placeholder={`${type === 'combat' ? 'Combat Passive' : type === 'support' ? 'Support Passive' : 'Custom'} X`}/>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Condition</span>
        <input className={styles.textInput} type="text" value={passive.condition} onChange={(e) => onUpdate({ condition: e.target.value })} placeholder="e.g. Owned, Resonance"/>
      </div>

      <div className={styles.descSection}>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>Sin Cost</span>
          <button className={styles.btnSmall} onClick={() => onUpdate({ cost: [...passive.cost, { sinType: 'wrath', amount: 1 }] })} type="button">
            + Add
          </button>
        </div>
        {passive.cost.map((c, ci) => (<div key={ci} className={pStyles.costRow}>
            <div className={styles.sinPicker}>
              {ALL_SINS.map((sin) => (<img key={sin} className={`${styles.sinIcon} ${sin === c.sinType ? styles.sinIconActive : ''}`} src={`/icons/sins/${sin}.png`} alt={sin} onClick={() => {
                    const updated = [...passive.cost];
                    updated[ci] = { ...c, sinType: sin };
                    onUpdate({ cost: updated });
                }}/>))}
            </div>
            <input className={pStyles.costNum} type="number" value={c.amount} onChange={(e) => {
                const updated = [...passive.cost];
                updated[ci] = { ...c, amount: Number(e.target.value) || 1 };
                onUpdate({ cost: updated });
            }} min={1} max={9}/>
            <button className={styles.btnDangerSmall} onClick={() => onUpdate({ cost: passive.cost.filter((_, i) => i !== ci) })} type="button">
              x
            </button>
          </div>))}
      </div>

      <div className={styles.descSection}>
        <span className={styles.fieldLabel}>Description</span>
        <SlateEditor value={passive.description} onChange={(val: Descendant[]) => onUpdate({ description: val })} placeholder="Passive description..."/>
      </div>
    </div>);
}
