import type { SinType } from '../../types/project';
import styles from './SinIcon.module.css';
interface SinIconProps {
    sinType: SinType;
    size?: 'sm' | 'md' | 'lg';
}
export function SinIcon({ sinType, size = 'md' }: SinIconProps) {
    return (<img className={`${styles.icon} ${styles[size]}`} src={`/icons/sins/${sinType}.png`} alt={sinType}/>);
}
