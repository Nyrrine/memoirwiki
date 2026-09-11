import type { ReactNode } from 'react';
import styles from './Panel.module.css';
interface PanelProps {
    title?: string;
    actions?: ReactNode;
    raised?: boolean;
    flush?: boolean;
    className?: string;
    children: ReactNode;
}
export function Panel({ title, actions, raised, flush, className, children }: PanelProps) {
    const cls = [styles.panel, raised && styles.raised, flush && styles.flush, className]
        .filter(Boolean)
        .join(' ');
    return (<section className={cls}>
      {(title || actions) && (<div className={styles.header}>
          {title && <h3 className={styles.title}>{title}</h3>}
          {actions}
        </div>)}
      <div className={styles.body}>{children}</div>
    </section>);
}
