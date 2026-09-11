import type { Stats, Resistances, DamageType, ResistanceLevel } from '../../types/project';
import { RESISTANCE_SHORT_LABELS, RESISTANCE_MULTIPLIERS, resistanceColor } from '../../lib/sinHelpers';
import styles from './CardStatsBar.module.css';
interface CardStatsBarProps {
    stats: Stats;
    bgColor?: string;
}
const DAMAGE_TYPES: DamageType[] = ['slash', 'pierce', 'blunt'];
function ResistanceBadge({ type, level }: {
    type: DamageType;
    level: ResistanceLevel;
}) {
    return (<div className={styles.resBadge}>
      <img className={styles.resIcon} src={`/icons/attack/${type}.png`} alt={type}/>
      <span className={styles.resText} style={{ color: resistanceColor(level) }}>
        <span className={styles.resLevel}>{RESISTANCE_SHORT_LABELS[level]}</span>
        <span className={styles.resMultiplier}>{RESISTANCE_MULTIPLIERS[level]}</span>
      </span>
    </div>);
}
function HpIcon() {
    return <img className={styles.statIcon} src="/icons/stats/hp.webp" alt="HP"/>;
}
function SpeedIcon() {
    return <img className={styles.statIcon} src="/icons/stats/speed.webp" alt="Speed"/>;
}
function DefIcon() {
    return <img className={styles.statIcon} src="/icons/stats/defense.webp" alt="DEF"/>;
}
export function CardStatsBar({ stats, bgColor }: CardStatsBarProps) {
    return (<div className={styles.statsBar} style={bgColor ? { background: bgColor } : undefined}>
      <div className={styles.coreStats}>
        <div className={styles.stat}>
          <HpIcon />
          <span className={styles.statValue}>{stats.hp}</span>
          <span className={styles.statLabel}>HP</span>
        </div>
        <div className={styles.statDivider}/>
        <div className={styles.stat}>
          <SpeedIcon />
          <span className={styles.statValue}>{stats.speedMin}–{stats.speedMax}</span>
          <span className={styles.statLabel}>Speed</span>
        </div>
        <div className={styles.statDivider}/>
        <div className={styles.stat}>
          <DefIcon />
          <span className={styles.statValue}>{stats.defenseLevel}</span>
          <span className={styles.statLabel}>DEF</span>
        </div>
      </div>
      <div className={styles.resistances}>
        {DAMAGE_TYPES.map((dt) => (<ResistanceBadge key={dt} type={dt} level={stats.resistances[dt as keyof Resistances]}/>))}
      </div>
    </div>);
}
