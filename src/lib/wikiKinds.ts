import type { WikiPageKind } from '../types/wiki';
export type KindFilter = 'all' | WikiPageKind;
export const KINDS: {
    id: KindFilter;
    label: string;
}[] = [
    { id: 'all', label: 'Everything' },
    { id: 'lore', label: 'Lore' },
    { id: 'character', label: 'Characters' },
    { id: 'guide', label: 'Guides' },
];
export function wikiSearchPlaceholder(kind: KindFilter): string {
    return kind === 'all'
        ? 'Search the wiki...'
        : `Search ${KINDS.find((k) => k.id === kind)?.label.toLowerCase()}...`;
}
