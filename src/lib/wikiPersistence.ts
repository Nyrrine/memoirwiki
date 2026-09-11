import type { Descendant } from 'slate';
import { supabase } from './supabase';
import { isBlobUrl } from './imageUpload';
import type { WikiBacklink, WikiCategory, WikiPageData, WikiPageKind, WikiPageMeta, WikiPageProject, WikiPageStatus, WikiRevision, WikiSection, } from '../types/wiki';
const WIKI_BUCKET = 'wiki-images';
export class SaveConflictError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SaveConflictError';
    }
}
const META_COLUMNS = 'id, slug, title, subtitle, cover_image, kind, status, is_memoir, created_at, updated_at';
export async function createWikiPage(title: string, slug: string, kind: WikiPageKind = 'lore'): Promise<WikiPageData> {
    const { data, error } = await supabase
        .from('wiki_pages')
        .insert({ title, slug, kind, sections: [] })
        .select()
        .single();
    if (error) {
        if (error.code === '23505') {
            throw new Error('A page with this slug already exists.');
        }
        throw new Error(`Create wiki page failed: ${error.message}`);
    }
    return data as WikiPageData;
}
export interface WikiPageUpdates {
    title?: string;
    slug?: string;
    subtitle?: string | null;
    cover_image?: string | null;
    sections?: WikiSection[];
    kind?: WikiPageKind;
    is_memoir?: boolean;
    status?: WikiPageStatus;
    edit_comment?: string | null;
    global_bg_color?: string;
    global_accent_color?: string;
    global_text_color?: string;
    global_font?: string;
}
export async function saveWikiPage(pageId: string, updates: WikiPageUpdates, expectedUpdatedAt?: string): Promise<WikiPageData> {
    let sections = updates.sections;
    if (sections) {
        sections = await persistWikiSectionImages(sections, pageId);
    }
    let coverImage = updates.cover_image;
    if (coverImage && isBlobUrl(coverImage)) {
        coverImage = await uploadWikiBlobUrl(coverImage, pageId, 'cover');
    }
    let query = supabase
        .from('wiki_pages')
        .update({
        ...updates,
        ...(sections && { sections }),
        ...(coverImage !== undefined && { cover_image: coverImage }),
    })
        .eq('id', pageId);
    if (expectedUpdatedAt) {
        query = query.eq('updated_at', expectedUpdatedAt);
    }
    const { data, error } = await query.select().single();
    if (error) {
        if (error.code === '23505') {
            throw new SaveConflictError('This slug is already taken. Please choose a different one.');
        }
        if (error.code === 'PGRST116' && expectedUpdatedAt) {
            throw new SaveConflictError('This page changed since you opened it - reload to continue. Your unsaved work is kept locally.');
        }
        throw new Error(`Save wiki page failed: ${error.message}`);
    }
    if (sections) {
        await syncPageLinks(pageId, extractWikilinkSlugs(sections));
    }
    return sanitizeWikiPage(data as WikiPageData);
}
export async function loadWikiPage(pageId: string): Promise<WikiPageData | null> {
    const { data, error } = await supabase
        .from('wiki_pages')
        .select('*')
        .eq('id', pageId)
        .single();
    if (error) {
        if (error.code === 'PGRST116')
            return null;
        throw new Error(`Load wiki page failed: ${error.message}`);
    }
    return sanitizeWikiPage(data as WikiPageData);
}
export interface LoadedWikiPage extends WikiPageData {
    author_username: string | null;
    author_avatar: string | null;
    editor_username: string | null;
}
export async function loadWikiPageBySlug(slug: string): Promise<LoadedWikiPage | null> {
    const { data, error } = await supabase
        .from('wiki_pages')
        .select('*, author:profiles!wiki_pages_created_by_fkey(username, avatar_icon), editor:profiles!wiki_pages_updated_by_fkey(username)')
        .eq('slug', slug)
        .single();
    if (error) {
        if (error.code === 'PGRST116')
            return null;
        throw new Error(`Load wiki page failed: ${error.message}`);
    }
    const row = data as WikiPageData & {
        author: {
            username: string;
            avatar_icon: string | null;
        } | null;
        editor: {
            username: string;
        } | null;
    };
    const { author, editor, ...page } = row;
    return {
        ...sanitizeWikiPage(page as WikiPageData),
        author_username: author?.username ?? null,
        author_avatar: author?.avatar_icon ?? null,
        editor_username: editor?.username ?? null,
    };
}
export async function listWikiPages(opts?: {
    kind?: WikiPageKind;
    status?: WikiPageStatus | 'all';
    memoirOnly?: boolean;
    orderBy?: 'title' | 'updated_at';
    limit?: number;
}): Promise<WikiPageMeta[]> {
    let query = supabase.from('wiki_pages').select(META_COLUMNS);
    if (opts?.kind)
        query = query.eq('kind', opts.kind);
    if (opts?.memoirOnly)
        query = query.eq('is_memoir', true);
    if (opts?.status && opts.status !== 'all')
        query = query.eq('status', opts.status);
    query = opts?.orderBy === 'updated_at'
        ? query.order('updated_at', { ascending: false })
        : query.order('title', { ascending: true });
    if (opts?.limit)
        query = query.limit(opts.limit);
    const { data, error } = await query;
    if (error)
        throw new Error(`List wiki pages failed: ${error.message}`);
    return (data || []) as WikiPageMeta[];
}
export async function listRecentChanges(limit = 20): Promise<WikiPageMeta[]> {
    const { data, error } = await supabase
        .from('wiki_pages')
        .select(`${META_COLUMNS}, editor:profiles!wiki_pages_updated_by_fkey(username)`)
        .order('updated_at', { ascending: false })
        .limit(limit);
    if (error)
        throw new Error(`Recent changes failed: ${error.message}`);
    return (data || []).map((row: Record<string, unknown>) => ({
        ...(row as unknown as WikiPageMeta),
        updated_by_username: (row.editor as {
            username: string;
        } | null)?.username ?? null,
    }));
}
export async function searchWikiPages(query: string, opts?: {
    kind?: WikiPageKind;
    memoirOnly?: boolean;
    limit?: number;
}): Promise<WikiPageMeta[]> {
    const trimmed = query.trim();
    if (!trimmed)
        return [];
    const { data, error } = await supabase.rpc('search_wiki_pages', {
        p_query: trimmed,
        p_kind: opts?.kind ?? null,
        p_memoir_only: opts?.memoirOnly ?? false,
        p_limit: opts?.limit ?? 30,
    });
    if (error)
        throw new Error(`Search failed: ${error.message}`);
    return (data || []) as WikiPageMeta[];
}
export async function searchPagesByTitle(query: string, limit = 8): Promise<{
    slug: string;
    title: string;
}[]> {
    const trimmed = query.trim();
    if (!trimmed)
        return [];
    const { data, error } = await supabase
        .from('wiki_pages')
        .select('slug, title')
        .ilike('title', `%${trimmed.replace(/[%_]/g, '')}%`)
        .order('title', { ascending: true })
        .limit(limit);
    if (error)
        return [];
    return (data || []) as {
        slug: string;
        title: string;
    }[];
}
export async function listRevisions(pageId: string, limit = 50): Promise<WikiRevision[]> {
    const { data, error } = await supabase
        .from('wiki_revisions')
        .select('*, author:profiles!wiki_revisions_author_id_fkey(username)')
        .eq('page_id', pageId)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error)
        throw new Error(`List revisions failed: ${error.message}`);
    return (data || []).map((row: Record<string, unknown>) => {
        const { author, ...rev } = row;
        return {
            ...(rev as unknown as WikiRevision),
            author_username: (author as {
                username: string;
            } | null)?.username ?? null,
        };
    });
}
export async function restoreRevision(pageId: string, revision: WikiRevision): Promise<WikiPageData> {
    return saveWikiPage(pageId, {
        title: revision.title,
        subtitle: revision.subtitle,
        sections: revision.sections,
        edit_comment: `Restored revision from ${new Date(revision.created_at).toLocaleString()}`,
    });
}
export interface MyProposal {
    id: string;
    page_id: string;
    page_slug: string | null;
    page_title: string | null;
    title: string;
    summary: string | null;
    state: 'open' | 'changes_requested' | 'merged' | 'rejected' | 'withdrawn';
    review_note: string | null;
    reviewer_username: string | null;
    created_at: string;
    updated_at: string;
    decided_at: string | null;
    stale: boolean;
}
export async function submitProposal(page: WikiPageData, opts: {
    categorySlugs: string[];
    summary: string;
    baseUpdatedAt: string;
}): Promise<string> {
    const sections = await persistWikiSectionImages(page.sections, page.id);
    const cover = page.cover_image && isBlobUrl(page.cover_image)
        ? await uploadWikiBlobUrl(page.cover_image, page.id, 'cover')
        : page.cover_image;
    const { data, error } = await supabase.rpc('submit_proposal', {
        p_page_id: page.id,
        p_base_updated_at: opts.baseUpdatedAt,
        p_title: page.title,
        p_subtitle: page.subtitle,
        p_cover_image: cover,
        p_sections: sections,
        p_link_slugs: [...new Set(extractWikilinkSlugs(sections))],
        p_kind: page.kind,
        p_is_memoir: page.is_memoir,
        p_category_slugs: opts.categorySlugs,
        p_summary: opts.summary || null,
        p_bg_color: page.global_bg_color ?? null,
        p_accent_color: page.global_accent_color ?? null,
        p_text_color: page.global_text_color ?? null,
        p_font: page.global_font ?? null,
    });
    if (error)
        throw new Error(error.message);
    return data as string;
}
export async function listMyProposals(): Promise<MyProposal[]> {
    const { data: session } = await supabase.auth.getUser();
    const me = session?.user?.id;
    if (!me)
        return [];
    const { data, error } = await supabase
        .from('wiki_page_proposals')
        .select('id, page_id, title, summary, state, review_note, created_at, updated_at, decided_at, base_updated_at, page:wiki_pages!wiki_page_proposals_page_id_fkey(slug, title, updated_at), reviewer:profiles!wiki_page_proposals_reviewer_id_fkey(username)')
        .eq('author_id', me)
        .order('updated_at', { ascending: false });
    if (error)
        throw new Error(`Could not load your proposals: ${error.message}`);
    return (data || []).map((row: Record<string, unknown>) => {
        const page = row.page as {
            slug: string;
            title: string;
            updated_at: string;
        } | null;
        return {
            id: row.id as string,
            page_id: row.page_id as string,
            page_slug: page?.slug ?? null,
            page_title: page?.title ?? null,
            title: row.title as string,
            summary: (row.summary as string) ?? null,
            state: row.state as MyProposal['state'],
            review_note: (row.review_note as string) ?? null,
            reviewer_username: (row.reviewer as {
                username: string;
            } | null)?.username ?? null,
            created_at: row.created_at as string,
            updated_at: row.updated_at as string,
            decided_at: (row.decided_at as string) ?? null,
            stale: page ? page.updated_at !== row.base_updated_at : false,
        };
    });
}
export interface ProposalForRebase {
    id: string;
    page_id: string;
    title: string;
    subtitle: string | null;
    cover_image: string | null;
    sections: WikiSection[];
    base_sections: WikiSection[] | null;
    base_updated_at: string;
    kind: WikiPageKind;
    is_memoir: boolean;
    category_slugs: string[];
    summary: string | null;
    state: MyProposal['state'];
    global_bg_color: string | null;
    global_accent_color: string | null;
    global_text_color: string | null;
    global_font: string | null;
}
export async function loadProposalForRebase(id: string): Promise<ProposalForRebase | null> {
    const { data, error } = await supabase
        .from('wiki_page_proposals')
        .select('id, page_id, title, subtitle, cover_image, sections, base_sections, base_updated_at, kind, is_memoir, category_slugs, summary, state, global_bg_color, global_accent_color, global_text_color, global_font')
        .eq('id', id)
        .maybeSingle();
    if (error)
        throw new Error(`Could not open your version: ${error.message}`);
    if (!data)
        return null;
    const row = data as Record<string, unknown>;
    const rawBase = row.base_sections;
    return {
        id: row.id as string,
        page_id: row.page_id as string,
        title: row.title as string,
        subtitle: (row.subtitle as string) ?? null,
        cover_image: (row.cover_image as string) ?? null,
        sections: sanitizeSections(row.sections as WikiSection[]),
        base_sections: rawBase == null ? null : sanitizeSections(rawBase as WikiSection[]),
        base_updated_at: row.base_updated_at as string,
        kind: row.kind as WikiPageKind,
        is_memoir: !!row.is_memoir,
        category_slugs: (row.category_slugs as string[]) ?? [],
        summary: (row.summary as string) ?? null,
        state: row.state as MyProposal['state'],
        global_bg_color: (row.global_bg_color as string) ?? null,
        global_accent_color: (row.global_accent_color as string) ?? null,
        global_text_color: (row.global_text_color as string) ?? null,
        global_font: (row.global_font as string) ?? null,
    };
}
export async function withdrawProposal(id: string): Promise<void> {
    const { error } = await supabase.rpc('withdraw_proposal', { p_id: id });
    if (error)
        throw new Error(error.message);
}
async function setPageStatusChecked(pageId: string, expectedUpdatedAt: string, status: WikiPageStatus, failure: string): Promise<WikiPageData> {
    const { data, error } = await supabase
        .from('wiki_pages')
        .update({ status })
        .eq('id', pageId)
        .eq('updated_at', expectedUpdatedAt)
        .select()
        .maybeSingle();
    if (error)
        throw new Error(`${failure}: ${error.message}`);
    if (!data) {
        throw new SaveConflictError(`${failure}: this page changed since you opened it, or you may not change it. Reload and try again.`);
    }
    return sanitizeWikiPage(data as WikiPageData);
}
export function requestPublish(pageId: string, expectedUpdatedAt: string): Promise<WikiPageData> {
    return setPageStatusChecked(pageId, expectedUpdatedAt, 'in_review', 'Could not send that for review');
}
export function withdrawFromReview(pageId: string, expectedUpdatedAt: string): Promise<WikiPageData> {
    return setPageStatusChecked(pageId, expectedUpdatedAt, 'draft', 'Could not pull that back');
}
export interface Contributor {
    id: string;
    username: string;
    avatar_icon: string | null;
    edits: number;
    last_edit: string;
}
export async function getPageContributors(pageId: string): Promise<Contributor[]> {
    const { data, error } = await supabase.rpc('page_contributors', { p_page_id: pageId });
    if (error)
        throw new Error(`Contributors failed: ${error.message}`);
    return (data || []) as Contributor[];
}
export interface Reader {
    id: string;
    username: string;
    avatar_icon: string | null;
    last_viewed_at: string;
}
export async function getPageReaders(pageId: string, limit = 12): Promise<Reader[]> {
    const { data, error } = await supabase
        .from('wiki_page_views')
        .select('last_viewed_at, reader:profiles!wiki_page_views_user_id_fkey(id, username, avatar_icon)')
        .eq('page_id', pageId)
        .order('last_viewed_at', { ascending: false })
        .limit(limit);
    if (error)
        return [];
    return (data || []).flatMap((row: Record<string, unknown>) => {
        const r = row.reader as {
            id: string;
            username: string;
            avatar_icon: string | null;
        } | null;
        return r ? [{ ...r, last_viewed_at: row.last_viewed_at as string }] : [];
    });
}
export async function recordPageView(pageId: string): Promise<void> {
    await supabase.rpc('record_page_view', { p_page_id: pageId });
}
export async function getBacklinks(slug: string): Promise<WikiBacklink[]> {
    const { data, error } = await supabase
        .from('wiki_links')
        .select('page:wiki_pages!wiki_links_from_page_fkey(id, slug, title)')
        .eq('to_slug', slug);
    if (error)
        throw new Error(`Backlinks failed: ${error.message}`);
    return (data || [])
        .map((row: Record<string, unknown>) => row.page as {
        id: string;
        slug: string;
        title: string;
    } | null)
        .filter((p): p is {
        id: string;
        slug: string;
        title: string;
    } => p !== null)
        .map((p) => ({ page_id: p.id, slug: p.slug, title: p.title }));
}
export async function getExistingSlugs(slugs: string[]): Promise<Set<string>> {
    if (slugs.length === 0)
        return new Set();
    const { data, error } = await supabase
        .from('wiki_pages')
        .select('slug')
        .in('slug', slugs);
    if (error)
        return new Set();
    return new Set((data || []).map((r: {
        slug: string;
    }) => r.slug));
}
async function syncPageLinks(pageId: string, slugs: string[]): Promise<void> {
    const unique = [...new Set(slugs)];
    const { error: delError } = await supabase
        .from('wiki_links')
        .delete()
        .eq('from_page', pageId);
    if (delError)
        return;
    if (unique.length > 0) {
        await supabase
            .from('wiki_links')
            .insert(unique.map((to_slug) => ({ from_page: pageId, to_slug })));
    }
}
export async function listCategories(): Promise<WikiCategory[]> {
    const { data, error } = await supabase
        .from('wiki_categories')
        .select('*')
        .order('name', { ascending: true });
    if (error)
        throw new Error(`List categories failed: ${error.message}`);
    return (data || []) as WikiCategory[];
}
export async function createCategory(slug: string, name: string, description?: string): Promise<WikiCategory> {
    const { data, error } = await supabase
        .from('wiki_categories')
        .insert({ slug, name, description: description || null })
        .select()
        .single();
    if (error) {
        if (error.code === '23505')
            throw new Error('A category with this slug already exists.');
        throw new Error(`Create category failed: ${error.message}`);
    }
    return data as WikiCategory;
}
export async function getPageCategories(pageId: string): Promise<string[]> {
    const { data, error } = await supabase
        .from('wiki_page_categories')
        .select('category_slug')
        .eq('page_id', pageId);
    if (error)
        throw new Error(`Page categories failed: ${error.message}`);
    return (data || []).map((r: {
        category_slug: string;
    }) => r.category_slug);
}
export async function setPageCategories(pageId: string, slugs: string[]): Promise<void> {
    const { error: delError } = await supabase
        .from('wiki_page_categories')
        .delete()
        .eq('page_id', pageId);
    if (delError)
        throw new Error(`Update categories failed: ${delError.message}`);
    if (slugs.length > 0) {
        const { error } = await supabase
            .from('wiki_page_categories')
            .insert(slugs.map((category_slug) => ({ page_id: pageId, category_slug })));
        if (error)
            throw new Error(`Update categories failed: ${error.message}`);
    }
}
export async function listPagesInCategory(categorySlug: string): Promise<WikiPageMeta[]> {
    const { data, error } = await supabase
        .from('wiki_page_categories')
        .select(`page:wiki_pages!wiki_page_categories_page_id_fkey(${META_COLUMNS})`)
        .eq('category_slug', categorySlug);
    if (error)
        throw new Error(`Category pages failed: ${error.message}`);
    return (data || [])
        .map((row: Record<string, unknown>) => row.page as unknown as WikiPageMeta | null)
        .filter((p): p is WikiPageMeta => p !== null)
        .sort((a, b) => a.title.localeCompare(b.title));
}
export async function getLinkedProjects(wikiPageId: string): Promise<WikiPageProject[]> {
    const { data, error } = await supabase
        .from('wiki_page_projects')
        .select('*')
        .eq('wiki_page_id', wikiPageId)
        .order('display_order', { ascending: true });
    if (error)
        throw new Error(`Get linked projects failed: ${error.message}`);
    return (data || []) as WikiPageProject[];
}
export async function syncLinkedProjects(wikiPageId: string, projectIds: string[], existingLinks: WikiPageProject[]): Promise<WikiPageProject[]> {
    const existingMap = new Map(existingLinks.map((l) => [l.project_id, l]));
    const newProjectIds = new Set(projectIds);
    const toDelete = existingLinks.filter((l) => !newProjectIds.has(l.project_id));
    if (toDelete.length > 0) {
        const { error } = await supabase
            .from('wiki_page_projects')
            .delete()
            .in('id', toDelete.map((l) => l.id));
        if (error)
            throw new Error(`Delete links failed: ${error.message}`);
    }
    const upserts = projectIds.map((projectId, index) => {
        const existing = existingMap.get(projectId);
        return {
            ...(existing ? { id: existing.id } : {}),
            wiki_page_id: wikiPageId,
            project_id: projectId,
            display_order: index,
            detail_sections: existing?.detail_sections || [],
        };
    });
    if (upserts.length > 0) {
        const { error } = await supabase
            .from('wiki_page_projects')
            .upsert(upserts, { onConflict: 'id' });
        if (error)
            throw new Error(`Sync links failed: ${error.message}`);
    }
    return getLinkedProjects(wikiPageId);
}
export async function saveIdentityDetail(wikiPageProjectId: string, detailSections: WikiSection[]): Promise<WikiSection[]> {
    const persisted = await persistWikiSectionImages(detailSections, wikiPageProjectId);
    const { data, error } = await supabase
        .from('wiki_page_projects')
        .update({ detail_sections: persisted })
        .eq('id', wikiPageProjectId)
        .select('id')
        .maybeSingle();
    if (error)
        throw new Error(`Save identity detail failed: ${error.message}`);
    if (!data)
        throw new Error('Save identity detail failed: you may not edit this page.');
    return persisted;
}
function forEachSlateValue(sections: WikiSection[], cb: (value: Descendant[]) => void): void {
    for (const section of sections) {
        switch (section.type) {
            case 'richtext':
            case 'collapsible':
                if (Array.isArray(section.content))
                    cb(section.content);
                break;
            case 'quote':
                if (Array.isArray(section.text))
                    cb(section.text);
                break;
            case 'infobox':
                for (const field of section.fields || []) {
                    if (Array.isArray(field.value))
                        cb(field.value);
                }
                break;
            case 'stat-table':
                for (const row of section.rows || []) {
                    if (Array.isArray(row.value))
                        cb(row.value);
                }
                break;
            case 'image-gallery':
                for (const img of section.images || []) {
                    if (Array.isArray(img.caption))
                        cb(img.caption);
                }
                break;
        }
    }
}
export function extractWikilinkSlugs(sections: WikiSection[]): string[] {
    const slugs: string[] = [];
    const walk = (node: unknown) => {
        if (!node || typeof node !== 'object')
            return;
        const n = node as Record<string, unknown>;
        if (n.type === 'wikilink' && typeof n.slug === 'string' && n.slug) {
            slugs.push(n.slug);
        }
        if (Array.isArray(n.children)) {
            for (const child of n.children)
                walk(child);
        }
    };
    forEachSlateValue(sections, (value) => { for (const node of value)
        walk(node); });
    return slugs;
}
const VALID_SECTION_TYPES = new Set([
    'infobox', 'richtext', 'identity-showcase', 'image-gallery',
    'collapsible', 'divider', 'quote', 'stat-table',
]);
function sanitizeWikiPage(page: WikiPageData): WikiPageData {
    page.sections = sanitizeSections(page.sections);
    return page;
}
export function sanitizeSections(sections: WikiSection[] | null | undefined): WikiSection[] {
    if (!Array.isArray(sections))
        return [];
    const kept = sections.filter((s) => s && typeof s === 'object' && typeof s.id === 'string' && VALID_SECTION_TYPES.has(s.type));
    for (const section of kept) {
        if (section.type === 'infobox' && !Array.isArray(section.fields)) {
            section.fields = [];
        }
        if (section.type === 'infobox' && Array.isArray(section.fields)) {
            for (const field of section.fields) {
                if (field.value !== undefined && typeof field.value !== 'string' && !Array.isArray(field.value)) {
                    field.value = '';
                }
            }
        }
        if (section.type === 'image-gallery' && !Array.isArray(section.images)) {
            section.images = [];
        }
        if (section.type === 'stat-table' && !Array.isArray(section.rows)) {
            section.rows = [];
        }
        if (section.type === 'stat-table' && Array.isArray(section.rows)) {
            for (const row of section.rows) {
                if (row.value !== undefined && typeof row.value !== 'string' && !Array.isArray(row.value)) {
                    row.value = '';
                }
            }
        }
        if ((section.type === 'richtext' || section.type === 'collapsible') &&
            !Array.isArray(section.content)) {
            section.content = [{ type: 'paragraph', children: [{ text: '' }] }];
        }
    }
    return kept;
}
async function uploadWikiBlobUrl(blobUrl: string, contextId: string, fieldPath: string): Promise<string> {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    const ext = mimeToExt(blob.type);
    const storagePath = `pages/${contextId}/${fieldPath}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const { error } = await supabase.storage
        .from(WIKI_BUCKET)
        .upload(storagePath, blob, { upsert: true, contentType: blob.type });
    if (error)
        throw new Error(`Wiki upload failed for ${fieldPath}: ${error.message}`);
    const { data } = supabase.storage.from(WIKI_BUCKET).getPublicUrl(storagePath);
    return `${data.publicUrl}?v=${Date.now()}`;
}
async function persistWikiSectionImages(sections: WikiSection[], contextId: string): Promise<WikiSection[]> {
    const result = JSON.parse(JSON.stringify(sections)) as WikiSection[];
    for (let i = 0; i < result.length; i++) {
        const section = result[i];
        if (section.type === 'infobox' && section.portraitUrl && isBlobUrl(section.portraitUrl)) {
            section.portraitUrl = await uploadWikiBlobUrl(section.portraitUrl, contextId, `section_${i}_portrait`);
        }
        if (section.type === 'image-gallery') {
            for (let j = 0; j < section.images.length; j++) {
                if (isBlobUrl(section.images[j].url)) {
                    section.images[j].url = await uploadWikiBlobUrl(section.images[j].url, contextId, `section_${i}_gallery_${j}`);
                }
            }
        }
    }
    return result;
}
export async function deleteWikiPageImages(pageId: string): Promise<void> {
    const prefix = `pages/${pageId}/`;
    const { data: files } = await supabase.storage.from(WIKI_BUCKET).list(prefix);
    if (files && files.length > 0) {
        const paths = files.map((f) => `${prefix}${f.name}`);
        await supabase.storage.from(WIKI_BUCKET).remove(paths);
    }
}
function mimeToExt(mime: string): string {
    const map: Record<string, string> = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/webp': 'webp',
        'image/gif': 'gif',
    };
    return map[mime] || 'png';
}
