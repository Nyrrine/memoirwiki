import { useCallback, useRef, useState } from 'react';
import type { Skill, SinType, DamageType, CoinType } from '../../types/project';
import type { SkillSlot } from '../../lib/skillFrames';
import type { Descendant } from 'slate';
import { SIN_LABELS, DAMAGE_LABELS } from '../../lib/sinHelpers';
import { frameBorderPath, frameMaskPath, resolveSlot } from '../../lib/skillFrames';
import { SlateEditor } from './SlateEditor';
import styles from './SkillEditor.module.css';
const BUILT_IN_COINS: {
    type: CoinType;
    src: string;
    label: string;
}[] = [
    { type: 'normal', src: '/icons/coins/coin.png', label: 'Normal' },
    { type: 'unbreakable', src: '/icons/coins/coin_unbreakable.png', label: 'Unbreakable' },
    { type: 'excision', src: '/icons/coins/coin_excision.webp', label: 'Excision' },
];
const ALL_SINS: SinType[] = ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy'];
const ALL_DAMAGE_TYPES: DamageType[] = ['slash', 'pierce', 'blunt'];
const ALL_SLOTS: SkillSlot[] = [1, 2, 3];
function createEmptyDesc(): Descendant[] {
    return [{ type: 'paragraph', children: [{ text: '' }] }];
}
interface SkillEditorProps {
    skill: Skill;
    index: number;
    onUpdate: (patch: Partial<Skill>) => void;
    onBrowseArt: () => void;
}
function syncCoinEffects(skill: Skill, newCount: number) {
    const effects = [...skill.coinEffects];
    for (let i = effects.length; i < newCount; i++) {
        effects.push({ coinIndex: i, coinType: 'normal', description: createEmptyDesc() });
    }
    if (effects.length > newCount)
        effects.length = newCount;
    return effects;
}
export function SkillEditor({ skill, index, onUpdate, onBrowseArt }: SkillEditorProps) {
    const artFileRef = useRef<HTMLInputElement>(null);
    const coinFileRef = useRef<HTMLInputElement>(null);
    const [coinUploadIdx, setCoinUploadIdx] = useState<number | null>(null);
    const slot = resolveSlot(skill.skillSlot, index);
    const maskUrl = frameMaskPath(slot);
    const handleArtUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file)
            onUpdate({ skillIconUrl: URL.createObjectURL(file) });
    }, [onUpdate]);
    const handleCoinUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && coinUploadIdx !== null) {
            const updated = [...skill.coinEffects];
            updated[coinUploadIdx] = {
                ...updated[coinUploadIdx],
                coinType: 'custom',
                coinIconUrl: URL.createObjectURL(file),
            };
            onUpdate({ coinEffects: updated });
        }
        setCoinUploadIdx(null);
        if (coinFileRef.current)
            coinFileRef.current.value = '';
    }, [onUpdate, skill.coinEffects, coinUploadIdx]);
    return (<div className={styles.editor}>
      
      <div className={styles.previewRow}>
        <div className={styles.artPreview}>
          <div className={styles.artMask} style={{
            maskImage: `url(${maskUrl})`,
            WebkitMaskImage: `url(${maskUrl})`,
        }}>
            {skill.skillIconUrl ? (<img src={skill.skillIconUrl} alt="" className={styles.artImg}/>) : (<div className={styles.artPlaceholder} style={{ backgroundColor: `var(--sin-${skill.sinType})`, opacity: 0.15 }}/>)}
          </div>
          <img src={frameBorderPath(skill.sinType, slot)} alt="" className={styles.frameOverlay}/>
        </div>
        <div className={styles.previewInfo}>
          <span className={styles.previewLabel}>S{slot}</span>
          <span className={styles.previewName} style={{ color: `var(--sin-${skill.sinType})` }}>
            {skill.name || 'Unnamed Skill'}
          </span>
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Name</span>
        <input className={styles.textInput} type="text" value={skill.name} onChange={(e) => onUpdate({ name: e.target.value })} placeholder="Skill name"/>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Label</span>
        <input className={styles.textInput} type="text" value={skill.skillLabel || ''} onChange={(e) => onUpdate({ skillLabel: e.target.value })} placeholder={`Skill ${index + 1}`}/>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Sin</span>
        <div className={styles.sinPicker}>
          {ALL_SINS.map((sin) => (<img key={sin} className={`${styles.sinIcon} ${sin === skill.sinType ? styles.sinIconActive : ''}`} src={`/icons/sins/${sin}.png`} alt={sin} title={SIN_LABELS[sin]} onClick={() => onUpdate({ sinType: sin })}/>))}
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Damage</span>
        <div className={styles.damagePicker}>
          {ALL_DAMAGE_TYPES.map((dt) => (<img key={dt} className={`${styles.damageIcon} ${dt === skill.damageType ? styles.damageIconActive : ''}`} src={`/icons/attack/${dt}.png`} alt={dt} title={DAMAGE_LABELS[dt]} onClick={() => onUpdate({ damageType: dt })}/>))}
        </div>
      </div>

      <div className={styles.field}>
        <div className={styles.olLabel}>
          <img className={styles.olIcon} src="/icons/stats/offense-level.webp" alt="OL"/>
          <span className={styles.fieldLabel}>Offense Level</span>
        </div>
        <input className={styles.olInput} type="text" value={skill.offenseLevel} onChange={(e) => onUpdate({ offenseLevel: e.target.value })} placeholder="30"/>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statField}>
          <span className={styles.statLabel}>Base</span>
          <span className={styles.statDisplay}>{skill.basePower}</span>
          <div className={styles.statControls}>
            <button className={styles.atkBtn} type="button" onClick={() => onUpdate({ basePower: Math.max(0, skill.basePower - 1) })}>-</button>
            <button className={styles.atkBtn} type="button" onClick={() => onUpdate({ basePower: Math.min(99, skill.basePower + 1) })}>+</button>
          </div>
        </div>
        <div className={styles.statField}>
          <span className={styles.statLabel}>Coin Pwr</span>
          <span className={styles.statDisplay}>{skill.coinPower}</span>
          <div className={styles.statControls}>
            <button className={styles.atkBtn} type="button" onClick={() => onUpdate({ coinPower: Math.max(0, skill.coinPower - 1) })}>-</button>
            <button className={styles.atkBtn} type="button" onClick={() => onUpdate({ coinPower: Math.min(99, skill.coinPower + 1) })}>+</button>
          </div>
        </div>
        <div className={styles.statField}>
          <span className={styles.statLabel}>Coins</span>
          <span className={styles.statDisplay}>{skill.coinCount}</span>
          <div className={styles.statControls}>
            <button className={styles.atkBtn} type="button" onClick={() => {
            const newCount = Math.max(1, skill.coinCount - 1);
            const coinEffects = syncCoinEffects(skill, newCount);
            onUpdate({ coinCount: newCount, coinEffects });
        }}>-</button>
            <button className={styles.atkBtn} type="button" onClick={() => {
            const newCount = Math.min(8, skill.coinCount + 1);
            const coinEffects = syncCoinEffects(skill, newCount);
            onUpdate({ coinCount: newCount, coinEffects });
        }}>+</button>
          </div>
        </div>
        <div className={styles.statField}>
          <span className={styles.statLabel}>Atk Wt.</span>
          <span className={styles.statDisplay}>
            {skill.atkWeight >= 8 ? '7+' : skill.atkWeight}
          </span>
          <div className={styles.statControls}>
            <button className={styles.atkBtn} type="button" onClick={() => onUpdate({ atkWeight: Math.max(1, skill.atkWeight - 1) })}>-</button>
            <button className={styles.atkBtn} type="button" onClick={() => onUpdate({ atkWeight: skill.atkWeight + 1 })}>+</button>
          </div>
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Art</span>
        <div className={styles.artActions}>
          <button className={styles.btn} onClick={onBrowseArt} type="button">Browse</button>
          <button className={styles.btn} onClick={() => artFileRef.current?.click()} type="button">Upload</button>
          {skill.skillIconUrl && (<button className={styles.btnDanger} onClick={() => onUpdate({ skillIconUrl: undefined })} type="button">Clear</button>)}
          <input ref={artFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleArtUpload}/>
          <input ref={coinFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoinUpload}/>
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Frame</span>
        <div className={styles.slotPicker}>
          {ALL_SLOTS.map((s) => (<button key={s} className={`${styles.slotBtn} ${slot === s ? styles.slotBtnActive : ''}`} style={slot === s ? { borderColor: `var(--sin-${skill.sinType})`, color: `var(--sin-${skill.sinType})` } : undefined} onClick={() => onUpdate({ skillSlot: s })} type="button">
              S{s}
            </button>))}
        </div>
      </div>

      <div className={styles.descSection}>
        <span className={styles.fieldLabel}>Effect</span>
        <SlateEditor value={skill.skillEffect} onChange={(val: Descendant[]) => onUpdate({ skillEffect: val })} placeholder="Skill effect text..."/>
      </div>

      {skill.coinEffects.length > 0 && (<div className={styles.descSection}>
          <span className={styles.fieldLabel}>Coin Effects</span>
          {skill.coinEffects.map((ce, ci) => (<div key={ci} className={styles.coinEffectRow}>
              <div className={styles.coinEffectHeader}>
                <span className={styles.coinEffectLabel} style={{ color: `var(--sin-${skill.sinType})` }}>
                  Coin {ce.coinIndex + 1}
                </span>
                <div className={styles.coinTypePicker}>
                  {BUILT_IN_COINS.map((bc) => (<img key={bc.type} className={`${styles.coinTypeIcon} ${ce.coinType === bc.type ? styles.coinTypeIconActive : ''}`} src={bc.src} alt={bc.label} title={bc.label} onClick={() => {
                        const updated = [...skill.coinEffects];
                        updated[ci] = { ...ce, coinType: bc.type as CoinType, coinIconUrl: undefined };
                        onUpdate({ coinEffects: updated });
                    }}/>))}
                  {ce.coinType === 'custom' && ce.coinIconUrl && (<img className={`${styles.coinTypeIcon} ${styles.coinTypeIconActive}`} src={ce.coinIconUrl} alt="Custom" title="Custom"/>)}
                  <button className={styles.coinUploadBtn} onClick={() => {
                    setCoinUploadIdx(ci);
                    coinFileRef.current?.click();
                }} type="button" title="Upload custom coin">+</button>
                </div>
              </div>
              {ce.coinType === 'custom' && (<input className={styles.coinLabelInput} type="text" value={ce.coinLabel || ''} onChange={(e) => {
                        const updated = [...skill.coinEffects];
                        updated[ci] = { ...ce, coinLabel: e.target.value };
                        onUpdate({ coinEffects: updated });
                    }} placeholder="Custom coin name..."/>)}
              <SlateEditor value={ce.description} onChange={(val: Descendant[]) => {
                    const updated = [...skill.coinEffects];
                    updated[ci] = { ...ce, description: val };
                    onUpdate({ coinEffects: updated });
                }} placeholder={`Coin ${ce.coinIndex + 1} effect...`}/>
            </div>))}
        </div>)}
    </div>);
}
