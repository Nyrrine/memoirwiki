const GREEN = '#94f140';
const AQUA = '#26cfff';
const LUST = '#d48428';
export const KEYWORD_REGISTRY: Record<string, string> = {
    'On Hit': GREEN,
    'On Hit Without Cracking': GREEN,
    'On Hit Cracked': GREEN,
    'On Evade': GREEN,
    'On Kill': GREEN,
    'On Crit': GREEN,
    'On Crit Kill': GREEN,
    'On Crit - Heads Hit': GREEN,
    'After Attack': GREEN,
    'Before Attack': GREEN,
    'Combat Start': GREEN,
    'Reuse Coin': GREEN,
    'Reuse - Heads Hit': GREEN,
    'On Use': AQUA,
    'Clashable Counter': LUST,
};
const sortedKeys = Object.keys(KEYWORD_REGISTRY).sort((a, b) => b.length - a.length);
const escaped = sortedKeys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const KEYWORD_REGEX = new RegExp(`\\[(${escaped.join('|')})\\]`, 'g');
export function findKeywords(text: string): {
    start: number;
    end: number;
    keyword: string;
    color: string;
}[] {
    const matches: {
        start: number;
        end: number;
        keyword: string;
        color: string;
    }[] = [];
    KEYWORD_REGEX.lastIndex = 0;
    let m;
    while ((m = KEYWORD_REGEX.exec(text)) !== null) {
        matches.push({
            start: m.index,
            end: m.index + m[0].length,
            keyword: m[1],
            color: KEYWORD_REGISTRY[m[1]],
        });
    }
    return matches;
}
export function searchKeywords(query: string): {
    label: string;
    color: string;
}[] {
    const q = query.toLowerCase();
    const entries = Object.entries(KEYWORD_REGISTRY);
    if (!q) {
        return entries.map(([label, color]) => ({ label, color }));
    }
    return entries
        .filter(([label]) => label.toLowerCase().includes(q))
        .sort((a, b) => {
        const aStarts = a[0].toLowerCase().startsWith(q) ? 0 : 1;
        const bStarts = b[0].toLowerCase().startsWith(q) ? 0 : 1;
        return aStarts - bStarts || a[0].length - b[0].length;
    })
        .map(([label, color]) => ({ label, color }));
}
