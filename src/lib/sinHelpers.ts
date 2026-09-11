import type { SinType, DamageType, ResistanceLevel } from '../types/project';
export const SIN_LABELS: Record<SinType, string> = {
    wrath: 'Wrath',
    lust: 'Lust',
    sloth: 'Sloth',
    gluttony: 'Gluttony',
    gloom: 'Gloom',
    pride: 'Pride',
    envy: 'Envy',
};
export const DAMAGE_LABELS: Record<DamageType, string> = {
    slash: 'Slash',
    pierce: 'Pierce',
    blunt: 'Blunt',
};
export const RESISTANCE_LABELS: Record<ResistanceLevel, string> = {
    fatal: 'Fatal (x2.0)',
    weak: 'Weak (x1.5)',
    normal: 'Normal (x1.0)',
    endured: 'Endured (x0.75)',
    ineffective: 'Ineff. (x0.5)',
};
export const RESISTANCE_SHORT_LABELS: Record<ResistanceLevel, string> = {
    fatal: 'Fatal',
    weak: 'Weak',
    normal: 'Normal',
    endured: 'Endured',
    ineffective: 'Ineff.',
};
export const RESISTANCE_MULTIPLIERS: Record<ResistanceLevel, string> = {
    fatal: '×2',
    weak: '×1.5',
    normal: '×1',
    endured: '×0.75',
    ineffective: '×0.5',
};
export function sinColor(sin: SinType): string {
    return `var(--sin-${sin})`;
}
export function resistanceColor(res: ResistanceLevel): string {
    return `var(--res-${res})`;
}
