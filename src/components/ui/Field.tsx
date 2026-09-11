import type { ReactNode } from 'react';
import styles from './Field.module.css';
interface FieldProps {
    label?: string;
    hint?: string;
    error?: string | null;
    children: ReactNode;
}
export function Field({ label, hint, error, children }: FieldProps) {
    return (<div className={styles.field}>
      {label && <span className={styles.label}>{label}</span>}
      {children}
      {error ? (<span className={styles.error}>{error}</span>) : hint ? (<span className={styles.hint}>{hint}</span>) : null}
    </div>);
}
