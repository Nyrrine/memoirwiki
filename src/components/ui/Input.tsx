import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import styles from './Input.module.css';
export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
    return <input className={[styles.input, className].filter(Boolean).join(' ')} {...rest}/>;
}
export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return <textarea className={[styles.input, className].filter(Boolean).join(' ')} {...rest}/>;
}
export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
    return <select className={[styles.input, className].filter(Boolean).join(' ')} {...rest}/>;
}
