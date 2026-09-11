import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import type { ProjectData, Skill, DefenseSkill, Passive, SinType } from '../../types/project';
import styles from './EntryList.module.css';
type EntryType = 'skill' | 'defense' | 'combat' | 'support' | 'custom';
interface EntryRef {
    type: EntryType;
    id: string;
}
interface EntryListProps {
    project: ProjectData;
    selectedEntry: EntryRef | null;
    onSelect: (entry: EntryRef | null) => void;
    onAddSkill: (skill: Skill) => void;
    onRemoveSkill: (id: string) => void;
    onAddDefense: (skill: DefenseSkill) => void;
    onRemoveDefense: (id: string) => void;
    onAddPassive: (type: 'combat' | 'support' | 'custom', passive: Passive) => void;
    onRemovePassive: (type: 'combat' | 'support' | 'custom', id: string) => void;
}
const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
    skill: 'Offensive Skill',
    defense: 'Defense Skill',
    combat: 'Combat Passive',
    support: 'Support Passive',
    custom: 'Custom Effect',
};
function emptySlate() {
    return [{ type: 'paragraph' as const, children: [{ text: '' }] }];
}
function createDefaultSkill(sinType: SinType = 'wrath'): Skill {
    return {
        id: uuid(),
        name: '',
        sinType,
        damageType: 'slash',
        basePower: 3,
        coinCount: 1,
        coinPower: 4,
        offenseLevel: '30',
        atkWeight: 1,
        amount: 1,
        skillEffect: emptySlate(),
        coinEffects: [{ coinIndex: 0, coinType: 'normal', description: emptySlate() }],
    };
}
function createDefaultDefense(sinType: SinType = 'wrath'): DefenseSkill {
    return {
        id: uuid(),
        name: '',
        sinType,
        damageType: 'slash',
        basePower: 3,
        coinCount: 1,
        coinPower: 5,
        offenseLevel: '30',
        atkWeight: 1,
        amount: 1,
        skillEffect: emptySlate(),
        coinEffects: [{ coinIndex: 0, coinType: 'normal', description: emptySlate() }],
    };
}
function createDefaultPassive(sinType: SinType = 'wrath'): Passive {
    return {
        id: uuid(),
        name: '',
        sinType,
        cost: [{ sinType, amount: 3 }],
        condition: 'Owned',
        description: emptySlate(),
    };
}
export function EntryList({ project, selectedEntry, onSelect, onAddSkill, onRemoveSkill, onAddDefense, onRemoveDefense, onAddPassive, onRemovePassive, }: EntryListProps) {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const handleAdd = (type: EntryType) => {
        const sinType = project.sinAffinity;
        let newId: string;
        switch (type) {
            case 'skill': {
                const s = createDefaultSkill(sinType);
                newId = s.id;
                onAddSkill(s);
                break;
            }
            case 'defense': {
                const d = createDefaultDefense(sinType);
                newId = d.id;
                onAddDefense(d);
                break;
            }
            case 'combat':
            case 'support':
            case 'custom': {
                const p = createDefaultPassive(sinType);
                newId = p.id;
                onAddPassive(type, p);
                break;
            }
        }
        setDropdownOpen(false);
        onSelect({ type, id: newId! });
    };
    const handleRemove = (type: EntryType, id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (type === 'skill')
            onRemoveSkill(id);
        else if (type === 'defense')
            onRemoveDefense(id);
        else
            onRemovePassive(type as 'combat' | 'support' | 'custom', id);
        if (selectedEntry?.id === id)
            onSelect(null);
    };
    const isSelected = (type: EntryType, id: string) => selectedEntry?.type === type && selectedEntry?.id === id;
    const sections: {
        type: EntryType;
        label: string;
        items: {
            id: string;
            name: string;
            sinType: SinType;
        }[];
    }[] = [
        { type: 'skill', label: 'Skills', items: project.skills.map((s) => ({ id: s.id, name: s.name, sinType: s.sinType })) },
        { type: 'defense', label: 'Defense', items: project.defenseSkills.map((d) => ({ id: d.id, name: d.name, sinType: d.sinType })) },
        { type: 'combat', label: 'Combat Passives', items: project.combatPassives.map((p) => ({ id: p.id, name: p.name, sinType: p.sinType })) },
        { type: 'support', label: 'Support Passives', items: project.supportPassives.map((p) => ({ id: p.id, name: p.name, sinType: p.sinType })) },
        { type: 'custom', label: 'Custom', items: project.customEffects.map((p) => ({ id: p.id, name: p.name, sinType: p.sinType })) },
    ];
    return (<div className={styles.entryList}>
      
      <div className={styles.addRow}>
        <button className={styles.addBtn} onClick={() => setDropdownOpen(!dropdownOpen)} type="button">
          + Add Entry
        </button>
        {dropdownOpen && (<div className={styles.dropdown}>
            {(Object.keys(ENTRY_TYPE_LABELS) as EntryType[]).map((type) => (<button key={type} className={styles.dropdownItem} onClick={() => handleAdd(type)} type="button">
                {ENTRY_TYPE_LABELS[type]}
              </button>))}
          </div>)}
      </div>

      {sections.map((section) => {
            if (section.items.length === 0)
                return null;
            return (<div key={section.type} className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>{section.label}</span>
              <span className={styles.sectionCount}>{section.items.length}</span>
            </div>
            {section.items.map((item, idx) => (<div key={item.id} className={`${styles.entryRow} ${isSelected(section.type, item.id) ? styles.entryRowActive : ''}`} onClick={() => onSelect({ type: section.type, id: item.id })}>
                <span className={styles.entryDot} style={{ backgroundColor: `var(--sin-${item.sinType})` }}/>
                {section.type === 'skill' && (<span className={styles.entryIndex}>S{idx + 1}</span>)}
                <span className={styles.entryName}>
                  {item.name || `Unnamed ${ENTRY_TYPE_LABELS[section.type]}`}
                </span>
                <button className={styles.removeBtn} onClick={(e) => handleRemove(section.type, item.id, e)} type="button">
                  x
                </button>
              </div>))}
          </div>);
        })}
    </div>);
}
export type { EntryRef };
