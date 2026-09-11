import type { Descendant } from 'slate';
export const EMPTY_SLATE_VALUE: Descendant[] = [{ type: 'paragraph', children: [{ text: '' }] }];
export function isRichContent(value: unknown): value is Descendant[] {
    return Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null && ('type' in value[0] || 'text' in value[0]);
}
export function toSlateValue(value: string | Descendant[]): Descendant[] {
    if (isRichContent(value))
        return value;
    const text = typeof value === 'string' ? value : '';
    return [{ type: 'paragraph', children: [{ text }] }];
}
export function isSlateEmpty(value: Descendant[]): boolean {
    if (value.length === 0)
        return true;
    if (value.length > 1)
        return false;
    const first = value[0] as {
        type?: string;
        children?: {
            text?: string;
        }[];
    };
    if (first.type !== 'paragraph' || !first.children || first.children.length !== 1)
        return false;
    return first.children[0].text === '';
}
export function slateToPlainText(value: Descendant[]): string {
    const parts: string[] = [];
    for (const node of value) {
        extractText(node, parts);
    }
    return parts.join('');
}
function extractText(node: unknown, parts: string[]): void {
    if (!node || typeof node !== 'object')
        return;
    const n = node as Record<string, unknown>;
    if ('text' in n && typeof n.text === 'string') {
        parts.push(n.text);
        return;
    }
    if (n.type === 'token' && typeof n.tokenKey === 'string') {
        parts.push(n.tokenKey);
        return;
    }
    if (n.type === 'keyword' && typeof n.keywordText === 'string') {
        parts.push(`[${n.keywordText}]`);
        return;
    }
    if (Array.isArray(n.children)) {
        for (const child of n.children)
            extractText(child, parts);
    }
}
