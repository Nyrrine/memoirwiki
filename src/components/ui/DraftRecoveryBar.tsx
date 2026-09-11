import styles from './DraftRecoveryBar.module.css';
interface DraftRecoveryBarProps {
    savedAt: number;
    onRestore: () => void;
    onDiscard: () => void;
    label?: string;
    droppedImages?: boolean;
}
function relativeTime(then: number): string {
    const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
    if (seconds < 60)
        return 'less than a minute ago';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60)
        return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24)
        return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
}
export function DraftRecoveryBar({ savedAt, onRestore, onDiscard, label = 'page', droppedImages = false, }: DraftRecoveryBarProps) {
    return (<div className={styles.bar} role="status">
      <span className={styles.text}>
        Unsaved changes to this {label} from <span className={styles.when}>{relativeTime(savedAt)}</span>.
        {droppedImages && ' Images you had just added are not included - you will need to add them again.'}
      </span>
      <div className={styles.actions}>
        <button type="button" className={`${styles.action} ${styles.restore}`} onClick={onRestore}>
          Restore
        </button>
        <button type="button" className={styles.action} onClick={onDiscard}>
          Discard
        </button>
      </div>
    </div>);
}
