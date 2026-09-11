import type { ButtonHTMLAttributes } from 'react';
import styles from './IconButton.module.css';
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    danger?: boolean;
    label: string;
}
export function IconButton({ danger, label, className, type = 'button', ...rest }: IconButtonProps) {
    const cls = [styles.iconBtn, danger && styles.danger, className].filter(Boolean).join(' ');
    return <button type={type} className={cls} aria-label={label} title={label} {...rest}/>;
}
