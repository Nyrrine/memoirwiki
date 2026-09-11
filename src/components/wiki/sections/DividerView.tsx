import type { DividerSection } from '../../../types/wiki';
import styles from './DividerView.module.css';
interface DividerViewProps {
    section: DividerSection;
}
const STYLE_MAP: Record<string, string> = {
    gold: styles.gold,
    thin: styles.thin,
    ornamental: styles.ornamental,
};
export function DividerView({ section }: DividerViewProps) {
    return <hr className={`${styles.divider} ${STYLE_MAP[section.style] || styles.gold}`} style={section.color ? { background: section.color } : undefined}/>;
}
