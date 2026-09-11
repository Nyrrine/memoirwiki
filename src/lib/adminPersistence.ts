import { supabase } from './supabase';
import { deleteWikiPageImages } from './wikiPersistence';
import type { MemberRole } from '../hooks/useAuth';
import type { SavedProjectMeta } from './projectPersistence';
import type { CustomStatus } from '../types/customStatus';
import type { WikiPageKind, WikiPageStatus, WikiSection } from '../types/wiki';
export type ProposalState = 'open' | 'changes_requested' | 'merged' | 'rejected' | 'withdrawn';
export interface Proposal {
    id: string;
    page_id: string;
    author_id: string;
    base_updated_at: string;
    title: string;
    subtitle: string | null;
    cover_image: string | null;
    sections: WikiSection[];
    search_text: string;
    link_slugs: string[];
    kind: WikiPageKind;
    is_memoir: boolean;
    category_slugs: string[];
    summary: string | null;
    state: ProposalState;
    reviewer_id: string | null;
    review_note: string | null;
    created_at: string;
    updated_at: string;
    decided_at: string | null;
    global_bg_color: string | null;
    global_accent_color: string | null;
    global_text_color: string | null;
    global_font: string | null;
    author_username?: string | null;
    author_avatar?: string | null;
    page_slug?: string | null;
    page_title?: string | null;
    stale?: boolean;
}
export interface ProposalSummary {
    id: string;
    page_id: string;
    author_id: string;
    base_updated_at: string;
    title: string;
    summary: string | null;
    state: ProposalState;
    created_at: string;
    updated_at: string;
    author_username: string | null;
    page_slug: string | null;
    page_title: string | null;
    stale: boolean;
}
const PROPOSAL_META = 'id, page_id, author_id, base_updated_at, title, summary, state, created_at, updated_at,'
    + ' author:profiles!wiki_page_proposals_author_id_fkey(username),'
    + ' page:wiki_pages!wiki_page_proposals_page_id_fkey(slug, title, updated_at)';
export async function listProposals(states: ProposalState[] = ['open', 'changes_requested']): Promise<ProposalSummary[]> {
    const { data, error } = await supabase
        .from('wiki_page_proposals')
        .select(PROPOSAL_META)
        .in('state', states)
        .order('created_at', { ascending: false });
    if (error)
        throw new Error(`List proposals failed: ${error.message}`);
    const rows = (data || []) as unknown as Record<string, unknown>[];
    return rows.map((row) => {
        const { author, page, ...rest } = row;
        const p = page as {
            slug: string;
            title: string;
            updated_at: string;
        } | null;
        const meta = rest as unknown as Omit<ProposalSummary, 'author_username' | 'page_slug' | 'page_title' | 'stale'>;
        return {
            ...meta,
            author_username: (author as {
                username: string;
            } | null)?.username ?? null,
            page_slug: p?.slug ?? null,
            page_title: p?.title ?? null,
            stale: p ? p.updated_at !== meta.base_updated_at : false,
        };
    });
}
export async function getProposal(id: string): Promise<Proposal | null> {
    const { data, error } = await supabase
        .from('wiki_page_proposals')
        .select('*, author:profiles!wiki_page_proposals_author_id_fkey(username, avatar_icon), page:wiki_pages!wiki_page_proposals_page_id_fkey(slug, title, updated_at, status)')
        .eq('id', id)
        .maybeSingle();
    if (error)
        throw new Error(`Load proposal failed: ${error.message}`);
    if (!data)
        return null;
    const { author, page, ...rest } = data as Record<string, unknown>;
    const p = page as {
        slug: string;
        title: string;
        updated_at: string;
    } | null;
    const full = rest as unknown as Proposal;
    return {
        ...full,
        author_username: (author as {
            username: string;
        } | null)?.username ?? null,
        author_avatar: (author as {
            avatar_icon: string | null;
        } | null)?.avatar_icon ?? null,
        page_slug: p?.slug ?? null,
        page_title: p?.title ?? null,
        stale: p ? p.updated_at !== full.base_updated_at : false,
    };
}
export async function mergeProposal(id: string, expectedUpdatedAt: string, note?: string): Promise<string> {
    const { data, error } = await supabase.rpc('merge_proposal', {
        p_id: id, p_expected_updated_at: expectedUpdatedAt, p_note: note || null,
    });
    if (error)
        throw new Error(error.message);
    return data as string;
}
export async function reviewProposal(id: string, state: 'changes_requested' | 'rejected', note?: string): Promise<void> {
    const { error } = await supabase.rpc('review_proposal', {
        p_id: id, p_state: state, p_note: note || null,
    });
    if (error)
        throw new Error(error.message);
}
export async function purgeProposals(authorId: string): Promise<number> {
    const { data, error } = await supabase.rpc('purge_proposals', { p_author_id: authorId });
    if (error)
        throw new Error(error.message);
    return (data as number) ?? 0;
}
export interface AdminPage {
    id: string;
    slug: string;
    title: string;
    subtitle: string | null;
    cover_image: string | null;
    kind: WikiPageKind;
    status: WikiPageStatus;
    is_memoir: boolean;
    created_at: string;
    updated_at: string;
    author_username: string | null;
    editor_username: string | null;
    open_proposals: number;
}
export async function listAllPages(): Promise<AdminPage[]> {
    const { data, error } = await supabase
        .from('wiki_pages')
        .select('id, slug, title, subtitle, cover_image, kind, status, is_memoir, created_at, updated_at, author:profiles!wiki_pages_created_by_fkey(username), editor:profiles!wiki_pages_updated_by_fkey(username)')
        .order('updated_at', { ascending: false });
    if (error)
        throw new Error(`List pages failed: ${error.message}`);
    const { data: openProps } = await supabase
        .from('wiki_page_proposals')
        .select('page_id')
        .in('state', ['open', 'changes_requested']);
    const pending = new Map<string, number>();
    for (const row of (openProps || []) as {
        page_id: string;
    }[]) {
        pending.set(row.page_id, (pending.get(row.page_id) ?? 0) + 1);
    }
    return (data || []).map((row: Record<string, unknown>) => {
        const { author, editor, ...page } = row;
        return {
            ...(page as unknown as Omit<AdminPage, 'author_username' | 'editor_username' | 'open_proposals'>),
            author_username: (author as {
                username: string;
            } | null)?.username ?? null,
            editor_username: (editor as {
                username: string;
            } | null)?.username ?? null,
            open_proposals: pending.get(row.id as string) ?? 0,
        };
    });
}
export async function countOpenProposals(pageId: string): Promise<number> {
    const { count, error } = await supabase
        .from('wiki_page_proposals')
        .select('id', { count: 'exact', head: true })
        .eq('page_id', pageId)
        .in('state', ['open', 'changes_requested']);
    if (error)
        throw new Error(`Could not check proposals: ${error.message}`);
    return count ?? 0;
}
export async function setPageStatus(pageId: string, status: WikiPageStatus): Promise<void> {
    const { error } = await supabase.rpc('admin_set_page_status', { p_page_id: pageId, p_status: status });
    if (error)
        throw new Error(error.message);
}
export async function deletePage(pageId: string, reason?: string): Promise<void> {
    const { error } = await supabase.rpc('admin_delete_page', {
        p_page_id: pageId, p_reason: reason || null,
    });
    if (error)
        throw new Error(error.message);
    await deleteWikiPageImages(pageId);
}
export interface Member {
    id: string;
    username: string;
    role: MemberRole;
    avatar_icon: string | null;
    created_at: string;
    banned_at: string | null;
    banned_reason: string | null;
    role_locked: boolean;
    page_count: number;
    card_count: number;
    status_count: number;
}
export async function listMembers(): Promise<Member[]> {
    const [profiles, pages, cards, statuses] = await Promise.all([
        supabase.from('profiles')
            .select('id, username, role, avatar_icon, created_at, banned_at, banned_reason, role_locked')
            .order('created_at', { ascending: true }),
        supabase.from('wiki_pages').select('created_by'),
        supabase.from('projects').select('user_id'),
        supabase.from('custom_statuses').select('user_id'),
    ]);
    if (profiles.error)
        throw new Error(`List members failed: ${profiles.error.message}`);
    const tally = (rows: {
        [k: string]: unknown;
    }[] | null, key: string) => {
        const counts = new Map<string, number>();
        for (const row of rows || []) {
            const id = row[key] as string | null;
            if (id)
                counts.set(id, (counts.get(id) ?? 0) + 1);
        }
        return counts;
    };
    const pageCounts = tally(pages.data, 'created_by');
    const cardCounts = tally(cards.data, 'user_id');
    const statusCounts = tally(statuses.data, 'user_id');
    return (profiles.data || []).map((p: Record<string, unknown>) => ({
        ...(p as unknown as Omit<Member, 'page_count' | 'card_count' | 'status_count'>),
        page_count: pageCounts.get(p.id as string) ?? 0,
        card_count: cardCounts.get(p.id as string) ?? 0,
        status_count: statusCounts.get(p.id as string) ?? 0,
    }));
}
export async function setMemberRole(userId: string, role: MemberRole): Promise<void> {
    const { error } = await supabase.rpc('set_member_role', { p_user_id: userId, p_role: role });
    if (error)
        throw new Error(error.message);
}
export async function banMember(userId: string, reason: string): Promise<void> {
    const { error } = await supabase.rpc('ban_member', { p_user_id: userId, p_reason: reason });
    if (error)
        throw new Error(error.message);
}
export interface AdminCard extends SavedProjectMeta {
    owner_username: string | null;
}
export async function listAllCards(): Promise<AdminCard[]> {
    const [cards, profiles] = await Promise.all([
        supabase.from('projects')
            .select('id, user_id, name, rarity, portrait_url, created_at, updated_at')
            .order('updated_at', { ascending: false }),
        supabase.from('profiles').select('id, username'),
    ]);
    if (cards.error)
        throw new Error(`List cards failed: ${cards.error.message}`);
    const names = new Map<string, string>();
    for (const p of (profiles.data || []) as {
        id: string;
        username: string;
    }[]) {
        names.set(p.id, p.username);
    }
    return (cards.data || []).map((row: Record<string, unknown>) => ({
        ...(row as unknown as SavedProjectMeta),
        character_name: null,
        owner_username: names.get(row.user_id as string) ?? null,
    }));
}
export async function deleteCard(cardId: string, reason?: string): Promise<void> {
    const { error } = await supabase.rpc('admin_delete_card', {
        p_card_id: cardId, p_reason: reason || null,
    });
    if (error)
        throw new Error(error.message);
}
export interface AdminStatus extends CustomStatus {
    owner_username: string | null;
}
export async function listAllStatuses(): Promise<AdminStatus[]> {
    const { data, error } = await supabase
        .from('custom_statuses')
        .select('*, owner:profiles!custom_statuses_user_id_fkey(username)')
        .order('created_at', { ascending: false });
    if (error)
        throw new Error(`List statuses failed: ${error.message}`);
    return (data || []).map((row: Record<string, unknown>) => {
        const { owner, ...status } = row;
        return {
            ...(status as unknown as CustomStatus),
            owner_username: (owner as {
                username: string;
            } | null)?.username ?? null,
        };
    });
}
export async function deleteStatus(statusId: string, reason?: string): Promise<void> {
    const { error } = await supabase.rpc('admin_delete_status', {
        p_status_id: statusId, p_reason: reason || null,
    });
    if (error)
        throw new Error(error.message);
}
export interface LogEntry {
    id: string;
    actor_id: string | null;
    action: string;
    target_type: string;
    target_id: string | null;
    detail: Record<string, unknown>;
    created_at: string;
    actor_username: string | null;
    target_name: string | null;
}
export async function listModerationLog(limit = 100): Promise<LogEntry[]> {
    const { data, error } = await supabase
        .from('moderation_log')
        .select('*, actor:profiles!moderation_log_actor_id_fkey(username)')
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error)
        throw new Error(`Activity failed: ${error.message}`);
    const entries = (data || []).map((row: Record<string, unknown>) => {
        const { actor, ...entry } = row;
        return {
            ...(entry as unknown as Omit<LogEntry, 'actor_username' | 'target_name'>),
            actor_username: (actor as {
                username: string;
            } | null)?.username ?? null,
            target_name: null as string | null,
        };
    });
    const profileIds = entries.filter((e) => e.target_type === 'profile' && e.target_id).map((e) => e.target_id!);
    const pageIds = entries.filter((e) => e.target_type === 'wiki_page' && e.target_id).map((e) => e.target_id!);
    const [people, pages] = await Promise.all([
        profileIds.length
            ? supabase.from('profiles').select('id, username').in('id', [...new Set(profileIds)])
            : Promise.resolve({ data: [] as {
                    id: string;
                    username: string;
                }[] }),
        pageIds.length
            ? supabase.from('wiki_pages').select('id, title').in('id', [...new Set(pageIds)])
            : Promise.resolve({ data: [] as {
                    id: string;
                    title: string;
                }[] }),
    ]);
    const names = new Map<string, string>();
    for (const p of (people.data || []) as {
        id: string;
        username: string;
    }[])
        names.set(p.id, p.username);
    for (const p of (pages.data || []) as {
        id: string;
        title: string;
    }[])
        names.set(p.id, p.title);
    for (const e of entries) {
        e.target_name = (e.target_id && names.get(e.target_id))
            ?? (e.detail?.title as string | undefined)
            ?? (e.detail?.slug as string | undefined)
            ?? null;
    }
    return entries;
}
export interface PageActivity {
    page_id: string;
    slug: string;
    title: string;
    readers: number;
    views: number;
    last_viewed_at: string | null;
}
export async function listPageActivity(): Promise<PageActivity[]> {
    const { data, error } = await supabase
        .from('wiki_page_views')
        .select('page_id, view_count, last_viewed_at, page:wiki_pages!wiki_page_views_page_id_fkey(slug, title)');
    if (error)
        throw new Error(`Page activity failed: ${error.message}`);
    const byPage = new Map<string, PageActivity>();
    for (const row of (data || []) as Record<string, unknown>[]) {
        const pageId = row.page_id as string;
        const page = row.page as {
            slug: string;
            title: string;
        } | null;
        const entry = byPage.get(pageId) ?? {
            page_id: pageId,
            slug: page?.slug ?? '',
            title: page?.title ?? '(deleted)',
            readers: 0,
            views: 0,
            last_viewed_at: null,
        };
        entry.readers += 1;
        entry.views += (row.view_count as number) ?? 0;
        const seen = row.last_viewed_at as string | null;
        if (seen && (!entry.last_viewed_at || seen > entry.last_viewed_at))
            entry.last_viewed_at = seen;
        byPage.set(pageId, entry);
    }
    return [...byPage.values()].sort((a, b) => b.views - a.views);
}
