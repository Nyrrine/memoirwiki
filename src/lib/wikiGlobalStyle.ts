import type { CSSProperties } from 'react';
export function wikiGlobalStyle(page: {
    global_bg_color?: string | null;
    global_text_color?: string | null;
    global_font?: string | null;
    global_accent_color?: string | null;
}): CSSProperties {
    return {
        ...(page.global_bg_color && { '--wiki-bg': page.global_bg_color }),
        ...(page.global_text_color && { '--wiki-text': page.global_text_color }),
        ...(page.global_font && { '--wiki-font': `'${page.global_font}', var(--font-body)` }),
        ...(page.global_accent_color && { '--wiki-accent': page.global_accent_color }),
    } as CSSProperties;
}
