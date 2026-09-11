import type { Descendant } from 'slate';
import { EMPTY_SLATE_VALUE } from '../lib/slateHelpers';
export type WikiSectionType = 'infobox' | 'richtext' | 'identity-showcase' | 'image-gallery' | 'collapsible' | 'divider' | 'quote' | 'stat-table';
export interface InfoboxField {
    label: string;
    value: string | Descendant[];
    isHeader?: boolean;
}
export interface InfoboxSection {
    id: string;
    type: 'infobox';
    portraitUrl: string | null;
    characterName: string;
    subtitle?: string;
    fields: InfoboxField[];
    borderColor?: string;
    nameColor?: string;
    labelColor?: string;
}
export interface RichTextSection {
    id: string;
    type: 'richtext';
    heading: string;
    content: Descendant[];
    headingColor?: string;
}
export interface IdentityShowcaseSection {
    id: string;
    type: 'identity-showcase';
    heading: string;
    headingColor?: string;
}
export interface GalleryImage {
    id?: string;
    url: string;
    caption: string | Descendant[];
}
export interface ImageGallerySection {
    id: string;
    type: 'image-gallery';
    heading: string;
    images: GalleryImage[];
}
export interface CollapsibleSection {
    id: string;
    type: 'collapsible';
    heading: string;
    content: Descendant[];
    headingColor?: string;
}
export type DividerStyle = 'gold' | 'thin' | 'ornamental';
export interface DividerSection {
    id: string;
    type: 'divider';
    style: DividerStyle;
    color?: string;
}
export interface QuoteSection {
    id: string;
    type: 'quote';
    text: string | Descendant[];
    attribution: string;
    borderColor?: string;
    textColor?: string;
    attributionColor?: string;
}
export interface StatTableRow {
    label: string;
    value: string | Descendant[];
    color?: string;
}
export interface StatTableSection {
    id: string;
    type: 'stat-table';
    heading: string;
    rows: StatTableRow[];
    headingColor?: string;
    labelColor?: string;
}
export type WikiSection = InfoboxSection | RichTextSection | IdentityShowcaseSection | ImageGallerySection | CollapsibleSection | DividerSection | QuoteSection | StatTableSection;
export type WikiPageKind = 'lore' | 'character' | 'guide';
export type WikiPageStatus = 'draft' | 'in_review' | 'published' | 'archived';
export interface WikiPageData {
    id: string;
    slug: string;
    title: string;
    subtitle: string | null;
    cover_image: string | null;
    sections: WikiSection[];
    kind: WikiPageKind;
    status: WikiPageStatus;
    is_memoir: boolean;
    created_by: string | null;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
    global_bg_color?: string;
    global_accent_color?: string;
    global_text_color?: string;
    global_font?: string;
}
export interface WikiPageMeta {
    id: string;
    slug: string;
    title: string;
    subtitle: string | null;
    cover_image: string | null;
    kind: WikiPageKind;
    status: WikiPageStatus;
    is_memoir?: boolean;
    created_at: string;
    updated_at: string;
    updated_by_username?: string | null;
}
export interface WikiRevision {
    id: string;
    page_id: string;
    title: string;
    subtitle: string | null;
    sections: WikiSection[];
    author_id: string | null;
    comment: string | null;
    created_at: string;
    author_username?: string | null;
}
export interface WikiCategory {
    slug: string;
    name: string;
    description: string | null;
}
export interface WikiBacklink {
    page_id: string;
    slug: string;
    title: string;
}
export interface WikiPageProject {
    id: string;
    wiki_page_id: string;
    project_id: string;
    display_order: number;
    detail_sections: WikiSection[];
}
export interface SectionTemplate {
    type: WikiSectionType;
    label: string;
    description: string;
    icon: string;
}
export const SECTION_TEMPLATES: SectionTemplate[] = [
    { type: 'infobox', label: 'Infobox', description: 'Character portrait and key info fields', icon: 'INFO' },
    { type: 'richtext', label: 'Text', description: 'Formatted text with tokens and keywords', icon: 'TEXT' },
    { type: 'identity-showcase', label: 'Identity Showcase', description: 'Grid of linked identity cards', icon: 'ID' },
    { type: 'image-gallery', label: 'Image Gallery', description: 'Image grid with captions', icon: 'IMG' },
    { type: 'collapsible', label: 'Collapsible', description: 'Expandable section for spoilers or details', icon: 'FOLD' },
    { type: 'divider', label: 'Divider', description: 'Visual separator line', icon: '---' },
    { type: 'quote', label: 'Quote', description: 'Styled quote with attribution', icon: '" "' },
    { type: 'stat-table', label: 'Stat Table', description: 'Key-value table with optional colors', icon: 'STAT' },
];
export function createDefaultSection(type: WikiSectionType): WikiSection {
    const id = crypto.randomUUID();
    switch (type) {
        case 'infobox':
            return { id, type: 'infobox', portraitUrl: null, characterName: '', fields: [] };
        case 'richtext':
            return { id, type: 'richtext', heading: '', content: [{ type: 'paragraph', children: [{ text: '' }] }] };
        case 'identity-showcase':
            return { id, type: 'identity-showcase', heading: 'Identities' };
        case 'image-gallery':
            return { id, type: 'image-gallery', heading: '', images: [] };
        case 'collapsible':
            return { id, type: 'collapsible', heading: '', content: [{ type: 'paragraph', children: [{ text: '' }] }] };
        case 'divider':
            return { id, type: 'divider', style: 'gold' };
        case 'quote':
            return { id, type: 'quote', text: EMPTY_SLATE_VALUE, attribution: '' };
        case 'stat-table':
            return { id, type: 'stat-table', heading: '', rows: [] };
    }
}
