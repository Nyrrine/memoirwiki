import styles from './Tabs.module.css';
export interface TabDef<T extends string = string> {
    id: T;
    label: string;
}
interface TabsProps<T extends string> {
    tabs: TabDef<T>[];
    active: T;
    onChange: (id: T) => void;
    className?: string;
}
export function Tabs<T extends string>({ tabs, active, onChange, className }: TabsProps<T>) {
    return (<div className={[styles.tabs, className].filter(Boolean).join(' ')} role="tablist">
      {tabs.map((t) => (<button key={t.id} type="button" role="tab" aria-selected={t.id === active} className={[styles.tab, t.id === active && styles.active].filter(Boolean).join(' ')} onClick={() => onChange(t.id)}>
          {t.label}
        </button>))}
    </div>);
}
