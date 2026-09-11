import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
}
export function Button({ variant = 'secondary', size = 'md', className, type = 'button', ...rest }: ButtonProps) {
    const cls = [styles.btn, styles[variant], styles[size], className].filter(Boolean).join(' ');
    return <button type={type} className={cls} {...rest}/>;
}
