import type { Passive } from '../../types/project';
import { CardRichText } from './CardRichText';
import styles from './CardPassivePanel.module.css';
interface CardPassivePanelProps {
    passive: Passive;
    type: 'combat' | 'support' | 'custom';
    index: number;
}
const TYPE_LABELS = {
    combat: 'PASSIVE',
    support: 'PASSIVE',
    custom: 'CUSTOM',
} as const;
export function CardPassivePanel({ passive, type, index }: CardPassivePanelProps) {
    const label = passive.label || `${TYPE_LABELS[type]} ${index + 1}`;
    return (<div className={styles.panel}>
      
      <div className={styles.header}>
        <span className={styles.name}>
          {passive.name || 'Unnamed Passive'}
        </span>

        {passive.cost.length > 0 && (<div className={styles.costInline}>
            {passive.cost.map((c, i) => (<div key={i} className={styles.costChip}>
                <img className={styles.costIcon} src={`/icons/sins/${c.sinType}.png`} alt={c.sinType}/>
                <span className={styles.costAmount}>&times;{c.amount}</span>
              </div>))}
            {passive.condition && (<span className={styles.condition}>{passive.condition}</span>)}
          </div>)}
      </div>

      <div className={styles.description}>
        <CardRichText content={passive.description}/>
      </div>

      <span className={styles.entryLabel}>{label}</span>
    </div>);
}
