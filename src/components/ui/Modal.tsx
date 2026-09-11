import { useEffect, type ReactNode } from 'react';
import { IconButton } from './IconButton';
import styles from './Modal.module.css';
interface ModalProps {
    title: string;
    open: boolean;
    onClose: () => void;
    wide?: boolean;
    footer?: ReactNode;
    children: ReactNode;
}
export function Modal({ title, open, onClose, wide, footer, children }: ModalProps) {
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);
    if (!open)
        return null;
    return (<div className={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget)
        onClose(); }}>
      <div className={[styles.modal, wide && styles.wide].filter(Boolean).join(' ')} role="dialog" aria-label={title}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <IconButton label="Close" onClick={onClose}>✕</IconButton>
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>);
}
