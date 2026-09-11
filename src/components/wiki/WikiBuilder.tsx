import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth, roleAtLeast } from '../../hooks/useAuth';
import { useWikiStore } from '../../hooks/useWikiStore';
import { useAutosave, type SaveResult } from '../../hooks/useAutosave';
import { DraftRecoveryBar } from '../ui/DraftRecoveryBar';
import { acceptDraft, discardDraft, draftKeys, getNewestDraft, pruneDrafts, type DraftRecord } from '../../lib/draftCache';
import { SectionRenderer } from './sections/SectionRenderer';
import { SectionEditor } from './sections/SectionEditor';
import { SectionPalette } from './SectionPalette';
import { ProjectPicker } from './ProjectPicker';
import { WikiIdentityPreviewModal } from './WikiIdentityPreviewModal';
import { RevisionHistoryModal } from './RevisionHistoryModal';
import { CategoryPicker } from './CategoryPicker';
import { RebasePanel } from './RebasePanel';
import { planRebase, stableStringify, unresolvedConflicts, type RebaseDecision, type RebasePlan, type RebaseRow, } from '../../lib/rebase';
import { SaveConflictError, loadWikiPage, loadProposalForRebase, saveWikiPage, submitProposal, type ProposalForRebase, requestPublish, withdrawFromReview, getLinkedProjects, syncLinkedProjects, getPageCategories, setPageCategories, } from '../../lib/wikiPersistence';
import { listUserProjects, type SavedProjectMeta } from '../../lib/projectPersistence';
import { useSidebarResize } from '../../hooks/useSidebarResize';
import { MAX_SECTIONS_PER_PAGE } from '../../hooks/useWikiStore';
import type { WikiPageData, WikiPageKind, WikiPageProject, WikiPageStatus, WikiSection, WikiSectionType, } from '../../types/wiki';
import { wikiGlobalStyle } from '../../lib/wikiGlobalStyle';
import styles from './WikiBuilder.module.css';
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/webp,image/gif';
const SIDEBAR_MIN = 320;
const SIDEBAR_MAX = 540;
const SIDEBAR_DEFAULT = 400;
const SIDEBAR_STORAGE_KEY = 'limbus-wiki-sidebar-width';
function slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}
interface WikiPageDraft {
    page: WikiPageData;
    linkedProjects: WikiPageProject[];
    categorySlugs: string[];
}
export function WikiBuilder() {
    const { pageId } = useParams<{
        pageId: string;
    }>();
    const navigate = useNavigate();
    const user = useAuth((s) => s.user);
    const profile = useAuth((s) => s.profile);
    const page = useWikiStore((s) => s.page);
    const linkedProjects = useWikiStore((s) => s.linkedProjects);
    const isDirty = useWikiStore((s) => s.isDirty);
    const saving = useWikiStore((s) => s.saving);
    const loadPage = useWikiStore((s) => s.loadPage);
    const setTitle = useWikiStore((s) => s.setTitle);
    const setSlug = useWikiStore((s) => s.setSlug);
    const setSubtitle = useWikiStore((s) => s.setSubtitle);
    const setCoverImage = useWikiStore((s) => s.setCoverImage);
    const setStatus = useWikiStore((s) => s.setStatus);
    const setKind = useWikiStore((s) => s.setKind);
    const setIsMemoir = useWikiStore((s) => s.setIsMemoir);
    const categorySlugs = useWikiStore((s) => s.categorySlugs);
    const setCategorySlugs = useWikiStore((s) => s.setCategorySlugs);
    const setGlobalBgColor = useWikiStore((s) => s.setGlobalBgColor);
    const setGlobalAccentColor = useWikiStore((s) => s.setGlobalAccentColor);
    const setGlobalTextColor = useWikiStore((s) => s.setGlobalTextColor);
    const setGlobalFont = useWikiStore((s) => s.setGlobalFont);
    const addSection = useWikiStore((s) => s.addSection);
    const insertSectionAt = useWikiStore((s) => s.insertSectionAt);
    const updateSection = useWikiStore((s) => s.updateSection);
    const removeSection = useWikiStore((s) => s.removeSection);
    const reorderSection = useWikiStore((s) => s.reorderSection);
    const setLinkedProjects = useWikiStore((s) => s.setLinkedProjects);
    const reorderProjects = useWikiStore((s) => s.reorderProjects);
    const beginSave = useWikiStore((s) => s.beginSave);
    const failSave = useWikiStore((s) => s.failSave);
    const markClean = useWikiStore((s) => s.markClean);
    const applyServerRow = useWikiStore((s) => s.applyServerRow);
    const applyResolvedSection = useWikiStore((s) => s.applyResolvedSection);
    const [projectMetas, setProjectMetas] = useState<SavedProjectMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [autoSlug, setAutoSlug] = useState(false);
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [previewProjectId, setPreviewProjectId] = useState<string | null>(null);
    const [viewportDropIndex, setViewportDropIndex] = useState<number | null>(null);
    const [editComment, setEditComment] = useState('');
    const [historyOpen, setHistoryOpen] = useState(false);
    const [pendingDraft, setPendingDraft] = useState<DraftRecord<WikiPageDraft> | null>(null);
    const [proposed, setProposed] = useState<string | null>(null);
    const [serverFacts, setServerFacts] = useState<{
        createdBy: string | null;
        status: WikiPageStatus;
    } | null>(null);
    const [baseUpdatedAt, setBaseUpdatedAt] = useState<string | null>(null);
    const location = useLocation();
    const rebaseRequestRef = useRef<string | null>((location.state as {
        rebaseProposalId?: string;
    } | null)?.rebaseProposalId ?? null);
    const [rebase, setRebase] = useState<{
        proposal: ProposalForRebase;
        plan: RebasePlan;
        baseSections: WikiSection[] | null;
        liveSections: WikiSection[];
        live: {
            title: string;
            subtitle: string | null;
            cover_image: string | null;
        };
    } | null>(null);
    const [rebaseDecisions, setRebaseDecisions] = useState<ReadonlyMap<string, RebaseDecision>>(new Map());
    const [rebaseHidden, setRebaseHidden] = useState(false);
    const userId = user?.id ?? null;
    const loadedPageIdRef = useRef<string | null>(null);
    const { sidebarWidth, isResizing, handleResizeStart } = useSidebarResize({
        min: SIDEBAR_MIN, max: SIDEBAR_MAX, initial: SIDEBAR_DEFAULT, storageKey: SIDEBAR_STORAGE_KEY,
    });
    useEffect(() => { void pruneDrafts(); }, []);
    useEffect(() => {
        if (!pageId || !userId)
            return;
        if (loadedPageIdRef.current === pageId)
            return;
        loadedPageIdRef.current = pageId;
        setPendingDraft(null);
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const loaded = await loadWikiPage(pageId);
                if (!loaded) {
                    setError('Page not found');
                    setLoading(false);
                    return;
                }
                const [links, cats] = await Promise.all([
                    getLinkedProjects(loaded.id),
                    getPageCategories(loaded.id),
                ]);
                const rebaseId = rebaseRequestRef.current;
                rebaseRequestRef.current = null;
                let rebased = false;
                let rebasedFrom: WikiSection[] | null = null;
                let rebasedMeta: {
                    title: string;
                    subtitle: string | null;
                    cover_image: string | null;
                    kind: WikiPageKind;
                    is_memoir: boolean;
                    categorySlugs: string[];
                    bg: string | null;
                    accent: string | null;
                    text: string | null;
                    font: string | null;
                } | null = null;
                if (rebaseId) {
                    const proposal = await loadProposalForRebase(rebaseId);
                    const isMod = roleAtLeast(useAuth.getState().profile?.role, 'moderator');
                    const nowhereToPutIt = (loaded.status === 'archived' && !isMod)
                        || (loaded.created_by === userId && loaded.status === 'in_review' && !isMod);
                    const rebaseable = proposal
                        && proposal.page_id === loaded.id
                        && !nowhereToPutIt
                        && (proposal.state === 'open' || proposal.state === 'changes_requested');
                    if (proposal && rebaseable) {
                        const plan = planRebase(proposal.base_sections, proposal.sections, loaded.sections);
                        loadPage({
                            ...loaded,
                            title: proposal.title,
                            subtitle: proposal.subtitle,
                            cover_image: proposal.cover_image,
                            kind: proposal.kind,
                            is_memoir: proposal.is_memoir,
                            global_bg_color: proposal.global_bg_color ?? undefined,
                            global_accent_color: proposal.global_accent_color ?? undefined,
                            global_text_color: proposal.global_text_color ?? undefined,
                            global_font: proposal.global_font ?? undefined,
                            sections: plan.sections,
                        }, links, proposal.category_slugs);
                        useWikiStore.setState({ isDirty: true });
                        setRebase({
                            proposal,
                            plan,
                            baseSections: proposal.base_sections,
                            liveSections: loaded.sections,
                            live: { title: loaded.title, subtitle: loaded.subtitle, cover_image: loaded.cover_image },
                        });
                        setRebaseDecisions(new Map());
                        setRebaseHidden(false);
                        rebased = true;
                        rebasedFrom = proposal.sections;
                        rebasedMeta = {
                            title: proposal.title, subtitle: proposal.subtitle,
                            cover_image: proposal.cover_image, kind: proposal.kind,
                            is_memoir: proposal.is_memoir, categorySlugs: proposal.category_slugs,
                            bg: proposal.global_bg_color, accent: proposal.global_accent_color,
                            text: proposal.global_text_color, font: proposal.global_font,
                        };
                    }
                    else if (nowhereToPutIt) {
                        setSaveError(loaded.status === 'archived'
                            ? 'This page is archived, so a rebase has nowhere to go. A maintainer would have to bring it back first.'
                            : 'This page is waiting for review, so there is nowhere to put a rebase. Pull it back to draft first.');
                    }
                    else {
                        setSaveError('That proposal could not be opened. Showing the page as it stands.');
                    }
                }
                if (!rebased)
                    loadPage(loaded, links, cats);
                setServerFacts({ createdBy: loaded.created_by, status: loaded.status });
                setBaseUpdatedAt(loaded.updated_at);
                const metas = await listUserProjects(userId);
                setProjectMetas(metas);
                const draft = await getNewestDraft<WikiPageDraft>(draftKeys.wikiPage(pageId));
                if (draft?.payload?.page) {
                    const dp = draft.payload;
                    const meta = rebasedMeta;
                    const linksDiffer = stableStringify((dp.linkedProjects ?? []).map((lp) => lp.project_id).sort()) !== stableStringify(links.map((lp) => lp.project_id).sort());
                    const newerThanProposal = !rebasedFrom || !meta
                        || stableStringify(dp.page.sections) !== stableStringify(rebasedFrom)
                        || dp.page.title !== meta.title
                        || dp.page.subtitle !== meta.subtitle
                        || dp.page.cover_image !== meta.cover_image
                        || dp.page.kind !== meta.kind
                        || dp.page.is_memoir !== meta.is_memoir
                        || (dp.page.global_bg_color ?? null) !== meta.bg
                        || (dp.page.global_accent_color ?? null) !== meta.accent
                        || (dp.page.global_text_color ?? null) !== meta.text
                        || (dp.page.global_font ?? null) !== meta.font
                        || linksDiffer
                        || stableStringify([...(dp.categorySlugs ?? [])].sort())
                            !== stableStringify([...meta.categorySlugs].sort());
                    if (newerThanProposal)
                        setPendingDraft(draft);
                }
            }
            catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load');
                loadedPageIdRef.current = null;
            }
            finally {
                setLoading(false);
            }
        })();
    }, [pageId, userId, loadPage]);
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => { if (isDirty)
            e.preventDefault(); };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isDirty]);
    const isMaintainer = roleAtLeast(profile?.role, 'moderator');
    const ownsPage = !!serverFacts && !!user && serverFacts.createdBy === user.id;
    const serverStatus = serverFacts?.status;
    const mode: 'direct' | 'locked' | 'propose' | 'archived' = isMaintainer ? 'direct'
        : serverStatus === 'archived' ? 'archived'
            : ownsPage && serverStatus === 'draft' ? 'direct'
                : ownsPage && serverStatus === 'in_review' ? 'locked'
                    : 'propose';
    const slugProblem = page && page.slug.trim().length === 0
        ? 'This page needs a slug. Without one its address is /wiki/page/ and nobody can open it.'
        : page && page.title.trim().length === 0
            ? 'This page needs a title. Without one it shows up in the wiki as an unnamed card.'
            : null;
    const overCap = (page?.sections.length ?? 0) > MAX_SECTIONS_PER_PAGE;
    const overCapMessage = page
        ? `This comes to ${page.sections.length} sections and the limit is ${MAX_SECTIONS_PER_PAGE}. Remove ${page.sections.length - MAX_SECTIONS_PER_PAGE} before sending it.`
        : '';
    const handleSave = useCallback(async (): Promise<SaveResult> => {
        if (!page || !user)
            return { ok: false, stillDirty: isDirty };
        if (page.sections.length > MAX_SECTIONS_PER_PAGE) {
            setSaveError(`This page has ${page.sections.length} sections and the limit is ${MAX_SECTIONS_PER_PAGE}. Remove some before saving.`);
            return { ok: false, stillDirty: true, permanent: true };
        }
        if (page.slug.trim().length === 0) {
            setSaveError('This page needs a slug before it can be saved.');
            return { ok: false, stillDirty: true, permanent: true };
        }
        if (page.title.trim().length === 0) {
            setSaveError('This page needs a title before it can be saved.');
            return { ok: false, stillDirty: true, permanent: true };
        }
        const sent = { page, linkedProjects, categorySlugs };
        beginSave();
        setSaveError(null);
        try {
            const updated = await saveWikiPage(page.id, {
                title: page.title, slug: page.slug, subtitle: page.subtitle,
                cover_image: page.cover_image, sections: page.sections,
                kind: page.kind, is_memoir: page.is_memoir, status: page.status,
                edit_comment: editComment.trim() || null,
                global_bg_color: page.global_bg_color, global_accent_color: page.global_accent_color,
                global_text_color: page.global_text_color, global_font: page.global_font,
            }, page.updated_at);
            await Promise.all([
                syncLinkedProjects(page.id, linkedProjects.map((lp) => lp.project_id), linkedProjects),
                setPageCategories(page.id, categorySlugs),
            ]);
            const now = useWikiStore.getState();
            const editedDuringSave = now.page !== sent.page
                || now.linkedProjects !== sent.linkedProjects
                || now.categorySlugs !== sent.categorySlugs;
            setEditComment('');
            setRebase(null);
            setRebaseDecisions(new Map());
            markClean(updated, editedDuringSave);
            return { ok: true, stillDirty: editedDuringSave };
        }
        catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Save failed');
            failSave();
            return { ok: false, stillDirty: true, permanent: err instanceof SaveConflictError };
        }
    }, [page, user, isDirty, linkedProjects, categorySlugs, editComment, beginSave, failSave, markClean]);
    const draftPayload = useMemo<WikiPageDraft | null>(() => (page ? { page, linkedProjects, categorySlugs } : null), [page, linkedProjects, categorySlugs]);
    const autosave = useAutosave({
        key: page ? draftKeys.wikiPage(page.id) : null,
        data: draftPayload,
        isDirty,
        baseUpdatedAt: page?.updated_at ?? null,
        save: handleSave,
        remote: mode === 'direct',
        pauseAuto: !!rebase,
        holdRecovery: pendingDraft !== null || rebase !== null,
    });
    const handlePropose = useCallback(async () => {
        if (!page)
            return;
        if (page.sections.length > MAX_SECTIONS_PER_PAGE) {
            setSaveError(`This comes to ${page.sections.length} sections and the limit is ${MAX_SECTIONS_PER_PAGE}. Remove ${page.sections.length - MAX_SECTIONS_PER_PAGE} before sending it.`);
            return;
        }
        if (page.slug.trim().length === 0) {
            setSaveError('This page needs a slug before it can be sent for review.');
            return;
        }
        if (page.title.trim().length === 0) {
            setSaveError('This page needs a title before it can be sent for review.');
            return;
        }
        setSaveError(null);
        try {
            await submitProposal(page, {
                categorySlugs, summary: editComment.trim(), baseUpdatedAt: baseUpdatedAt ?? page.updated_at,
            });
            setEditComment('');
            setRebase(null);
            setRebaseDecisions(new Map());
            setProposed('Sent for review. A maintainer will see it in their queue - your version is kept here so you can pick it up again.');
            markClean();
        }
        catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Could not send that for review');
        }
    }, [page, baseUpdatedAt, categorySlugs, editComment, markClean]);
    const handleRequestPublish = useCallback(async () => {
        if (!page)
            return;
        if (isDirty) {
            setSaveError('Save your changes before sending this for review.');
            return;
        }
        setSaveError(null);
        try {
            const row = await requestPublish(page.id, baseUpdatedAt ?? page.updated_at);
            applyServerRow(row);
            setServerFacts({ createdBy: row.created_by, status: row.status });
            setBaseUpdatedAt(row.updated_at);
            setProposed('Sent for review. The page is locked until a maintainer decides.');
        }
        catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Could not send that for review');
        }
    }, [page, isDirty, baseUpdatedAt, applyServerRow]);
    const handleWithdraw = useCallback(async () => {
        if (!page)
            return;
        setSaveError(null);
        try {
            const row = await withdrawFromReview(page.id, baseUpdatedAt ?? page.updated_at);
            applyServerRow(row);
            setServerFacts({ createdBy: row.created_by, status: row.status });
            setBaseUpdatedAt(row.updated_at);
            setProposed(null);
        }
        catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Could not pull that back');
        }
    }, [page, baseUpdatedAt, applyServerRow]);
    const handleRestoreDraft = useCallback(async () => {
        if (!pendingDraft?.payload)
            return;
        const { page: draftPage, linkedProjects: draftLinks, categorySlugs: draftCats } = pendingDraft.payload;
        loadPage(draftPage, draftLinks || [], draftCats || []);
        useWikiStore.setState({ isDirty: true });
        setBaseUpdatedAt(pendingDraft.baseUpdatedAt ?? draftPage.updated_at);
        setRebase(null);
        setRebaseDecisions(new Map());
        await acceptDraft(pendingDraft.key);
        setPendingDraft(null);
    }, [pendingDraft, loadPage]);
    const handleDiscardDraft = useCallback(async () => {
        if (pendingDraft)
            await discardDraft(pendingDraft.key);
        setPendingDraft(null);
    }, [pendingDraft]);
    useEffect(() => {
        if (location.state)
            navigate(location.pathname + location.search, { replace: true, state: null });
    }, [location.state, location.pathname, location.search, navigate]);
    const handleRebaseDecision = useCallback((row: RebaseRow, decision: RebaseDecision) => {
        const section = decision === 'mine' ? row.mine ?? null
            : decision === 'theirs' ? row.theirs ?? null
                : null;
        const defaultIndex = rebase?.plan.sections.findIndex((sec) => sec.id === row.id) ?? -1;
        const applied = applyResolvedSection(row.id, section, defaultIndex < 0 ? (page?.sections.length ?? 0) : defaultIndex);
        if (!applied) {
            setSaveError(overCapMessage || 'That section could not be put back - the page is at its section limit.');
            return;
        }
        setSaveError(null);
        setRebaseDecisions((prev) => {
            const next = new Map(prev);
            next.set(row.id, decision);
            return next;
        });
    }, [rebase, applyResolvedSection, page, overCapMessage]);
    const handleTitleChange = (title: string) => {
        setTitle(title);
        if (autoSlug)
            setSlug(slugify(title));
    };
    const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        if (file.size > MAX_UPLOAD_BYTES) {
            alert('Image must be under 10 MB');
            return;
        }
        setCoverImage(URL.createObjectURL(file));
    };
    const handlePickerConfirm = (selectedIds: string[]) => {
        const existingIds = new Set(linkedProjects.map((lp) => lp.project_id));
        const newIds = selectedIds.filter((id) => !existingIds.has(id));
        const keptLinks = linkedProjects.filter((lp) => selectedIds.includes(lp.project_id));
        const newLinks = newIds.map((projectId, i) => ({
            id: crypto.randomUUID(), wiki_page_id: page?.id || '',
            project_id: projectId, display_order: keptLinks.length + i,
            detail_sections: [] as WikiSection[],
        }));
        setLinkedProjects([...keptLinks, ...newLinks]);
        useWikiStore.setState({ isDirty: true });
        setPickerOpen(false);
    };
    if (loading) {
        return (<div className={styles.shell}>
        <div className={styles.center}><p className={styles.muted}>Loading...</p></div>
      </div>);
    }
    if (error || !page) {
        return (<div className={styles.shell}>
        <div className={styles.center}><p className={styles.error}>{error || 'Page not found'}</p></div>
      </div>);
    }
    return (<div className={styles.shell}>
      
      <aside className={styles.sidebar} style={{ width: sidebarWidth, minWidth: sidebarWidth }}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logoRow}>
            <Link to="/editor/new" className={styles.logoLink}>
              <img className={styles.logoImg} src="/ui/limbus-logo.webp" alt="Limbus Company"/>
            </Link>
            <div className={styles.logoText}>
              <span className={styles.logoLine}>Memoir</span>
              <span className={styles.logoLine}>Wiki</span>
            </div>
          </div>
          <div className={styles.toolbar}>
            {mode === 'direct' && (<button type="button" className={styles.saveBtn} onClick={() => { void autosave.saveNow(); }} disabled={saving || !isDirty}>
                {saving ? 'Saving...' : isDirty ? 'Save*' : 'Saved'}
              </button>)}
            {mode === 'propose' && (<button type="button" className={styles.saveBtn} onClick={() => { void handlePropose(); }} disabled={!isDirty}>
                Propose changes
              </button>)}
            {mode === 'locked' && (<button type="button" className={styles.saveBtn} onClick={() => { void handleWithdraw(); }}>
                Pull back to draft
              </button>)}
            {mode === 'archived' && (<button type="button" className={styles.saveBtn} disabled>
                Archived
              </button>)}
            <button type="button" className={styles.viewBtn} onClick={() => navigate(`/wiki/page/${page.slug}`)}>
              Wiki Preview
            </button>
            <div className={styles.toolbarSpacer}/>
            <button type="button" className={styles.viewBtn} onClick={() => navigate('/editor/new')}>
              Open ToolKit
            </button>
          </div>
        </div>

        <div className={styles.sidebarContent}>
          {mode === 'propose' && (<div className={styles.modeNote}>
              <strong>Proposing changes.</strong>{' '}
              {ownsPage
                ? 'This page is live, so changes go to a maintainer rather than straight onto it.'
                : 'This page belongs to someone else, so your version goes to a maintainer.'}
              {' '}Nothing here reaches the live page until they merge it.
            </div>)}
          {mode === 'archived' && (<div className={styles.modeNote}>
              <strong>Archived.</strong> This page is out of circulation, so it
              takes neither edits nor proposals. A maintainer can move it back to
              draft if it should be worked on again.
            </div>)}
          {mode === 'locked' && (<div className={styles.modeNote}>
              <strong>Waiting for review.</strong> The page is locked while a
              maintainer decides. Pull it back to draft if you want to keep working.
            </div>)}
          {proposed && <p className={styles.modeOk}>{proposed}</p>}
          {rebase && !rebaseHidden && (<RebasePanel proposal={rebase.proposal} plan={rebase.plan} decisions={rebaseDecisions} baseSections={rebase.baseSections} liveSections={rebase.liveSections} live={rebase.live} writesDirectly={mode === 'direct'} overCapMessage={overCap ? overCapMessage : null} onDecide={handleRebaseDecision} onDismiss={() => setRebaseHidden(true)}/>)}
          {rebase && rebaseHidden && (<button type="button" className={styles.rebaseReopen} onClick={() => setRebaseHidden(false)}>
              Show the rebase again
              {unresolvedConflicts(rebase.plan, rebaseDecisions).length > 0
                && ` - ${unresolvedConflicts(rebase.plan, rebaseDecisions).length} still to decide`}
            </button>)}
          {pendingDraft && (<DraftRecoveryBar savedAt={pendingDraft.savedAt} droppedImages={pendingDraft.droppedImages} onRestore={() => { void handleRestoreDraft(); }} onDiscard={() => { void handleDiscardDraft(); }}/>)}
          {saveError && <p className={styles.saveError}>{saveError}</p>}
          {autosave.status === 'local-only' && (<p className={styles.saveError}>
              This page is too large to save automatically - use Save when you are done.
            </p>)}
          {!autosave.localOk && (<p className={styles.saveError}>
              This browser will not store a local backup, so unsaved work is not
              protected. Save often.
            </p>)}

          <div className={styles.settingsGroup}>
            <label className={styles.fieldLabel}>Title</label>
            <input className={styles.fieldInput} value={page.title} onChange={(e) => handleTitleChange(e.target.value)} maxLength={255}/>

            <label className={styles.fieldLabel}>Slug</label>
            <div className={styles.slugRow}>
              <input className={styles.fieldInput} value={page.slug} readOnly={mode !== 'direct'} onChange={(e) => { setAutoSlug(false); setSlug(e.target.value); }} maxLength={100}/>
              {mode === 'direct' && (<button type="button" className={styles.slugAutoBtn} onClick={() => { setAutoSlug(true); setSlug(slugify(page.title)); }}>Auto</button>)}
            </div>
            {slugProblem && <p className={styles.slugProblem}>{slugProblem}</p>}
            {mode !== 'direct' && (<span className={styles.fieldHint}>
                Renaming a page breaks every link pointing at it, so it is a
                maintainer's job - ask in the summary below.
              </span>)}

            <label className={styles.fieldLabel}>Description</label>
            <textarea className={styles.fieldTextarea} value={page.subtitle || ''} onChange={(e) => setSubtitle(e.target.value || null)} placeholder="Short description shown on page cards" rows={3} maxLength={1000}/>

            <label className={styles.fieldLabel}>Cover Image</label>
            <div className={styles.coverRow}>
              {page.cover_image && <img src={page.cover_image} alt="" className={styles.coverPreview}/>}
              <input type="file" accept={ACCEPTED_IMAGE_TYPES} onChange={handleCoverUpload} className={styles.fileInput}/>
              {page.cover_image && <button type="button" className={styles.clearBtn} onClick={() => setCoverImage(null)}>Clear</button>}
            </div>

            <label className={styles.fieldLabel}>Global Background Color</label>
            <div className={styles.colorRow}>
              <input type="color" className={styles.colorInput} value={page.global_bg_color || '#1a1714'} onChange={(e) => setGlobalBgColor(e.target.value)}/>
              <input className={styles.colorHex} maxLength={64} value={page.global_bg_color || ''} onChange={(e) => setGlobalBgColor(e.target.value)} placeholder="#1a1714"/>
              {page.global_bg_color && <button type="button" className={styles.resetBtn} onClick={() => setGlobalBgColor(undefined)}>Reset</button>}
            </div>

            <label className={styles.fieldLabel}>Global Accent Color</label>
            <div className={styles.colorRow}>
              <input type="color" className={styles.colorInput} value={page.global_accent_color || '#d4af37'} onChange={(e) => setGlobalAccentColor(e.target.value)}/>
              <input className={styles.colorHex} maxLength={64} value={page.global_accent_color || ''} onChange={(e) => setGlobalAccentColor(e.target.value)} placeholder="#d4af37"/>
              {page.global_accent_color && <button type="button" className={styles.resetBtn} onClick={() => setGlobalAccentColor(undefined)}>Reset</button>}
            </div>

            <label className={styles.fieldLabel}>Global Text Color</label>
            <div className={styles.colorRow}>
              <input type="color" className={styles.colorInput} value={page.global_text_color || '#e8e4dc'} onChange={(e) => setGlobalTextColor(e.target.value)}/>
              <input className={styles.colorHex} maxLength={64} value={page.global_text_color || ''} onChange={(e) => setGlobalTextColor(e.target.value)} placeholder="#e8e4dc"/>
              {page.global_text_color && <button type="button" className={styles.resetBtn} onClick={() => setGlobalTextColor(undefined)}>Reset</button>}
            </div>

            <label className={styles.fieldLabel}>Font</label>
            <select className={styles.fieldInput} value={page.global_font || ''} onChange={(e) => setGlobalFont(e.target.value || undefined)}>
              <option value="">Default (Pretendard)</option>
              <option value="Mikodacs">Mikodacs (Display)</option>
              <option value="BebasKai">BebasKai (Heading)</option>
              <option value="Pretendard">Pretendard (Body)</option>
              <option value="LiberationSans">Liberation Sans</option>
              <option value="ExcelsiorSans">Excelsior Sans</option>
              <option value="Pretendard Bold">Pretendard Bold</option>
            </select>

            <label className={styles.fieldLabel}>Kind</label>
            <select className={styles.fieldInput} value={page.kind} onChange={(e) => setKind(e.target.value as WikiPageKind)}>
              <option value="lore">Lore</option>
              <option value="character">Character</option>
              <option value="guide">Guide</option>
            </select>

            <label className={styles.memoirRow}>
              <input type="checkbox" className={styles.memoirBox} checked={page.is_memoir} onChange={(e) => setIsMemoir(e.target.checked)}/>
              <span className={styles.memoirText}>
                Part of Memoir
                <span className={styles.memoirHint}>
                  Tags this page as Memoir canon. Independent of its kind, so a
                  Memoir character page is still a character page.
                </span>
              </span>
            </label>

            <label className={styles.fieldLabel}>Status</label>
            {isMaintainer ? (<select className={styles.fieldInput} value={page.status} onChange={(e) => setStatus(e.target.value as WikiPageStatus)}>
                <option value="draft">Draft - members only</option>
                <option value="in_review">In review - waiting on a maintainer</option>
                <option value="published">Published - visible to everyone</option>
                <option value="archived">Archived - members only</option>
              </select>) : (<div className={styles.statusRow}>
                <span className={styles.statusNow}>
                  {page.status === 'draft' ? 'Draft - only members can see it'
                : page.status === 'in_review' ? 'Waiting for review'
                    : page.status === 'published' ? 'Live' : 'Archived'}
                </span>
                {mode === 'direct' && page.status === 'draft' && (<button type="button" className={styles.viewBtn} onClick={() => { void handleRequestPublish(); }}>
                    Send for review
                  </button>)}
              </div>)}
            {page.status === 'published' && (<div className={styles.shareLink}>
                <input className={styles.shareLinkInput} readOnly value={`${window.location.origin}/wiki/page/${page.slug}`} onClick={(e) => {
                (e.target as HTMLInputElement).select();
                navigator.clipboard.writeText(`${window.location.origin}/wiki/page/${page.slug}`).catch(() => { });
            }}/>
                <button type="button" className={styles.shareLinkCopy} onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/wiki/page/${page.slug}`).catch(() => { });
            }}>
                  Copy
                </button>
              </div>)}

            <label className={styles.fieldLabel}>Categories</label>
            <CategoryPicker selected={categorySlugs} onChange={setCategorySlugs}/>

            <label className={styles.fieldLabel}>Edit Summary</label>
            <input className={styles.fieldInput} value={editComment} onChange={(e) => setEditComment(e.target.value)} placeholder="What did you change? (shown in history)" maxLength={500}/>
            <button type="button" className={styles.viewBtn} onClick={() => setHistoryOpen(true)}>
              {mode === 'direct' ? 'Revision History' : 'History (read-only)'}
            </button>
          </div>

          <div className={styles.sectionsHeader}>
            <h3 className={styles.sectionsTitle}>Sections</h3>
          </div>

          {page.sections.map((section, index) => (<SectionEditor key={section.id} section={section} index={index} totalSections={page.sections.length} collapsed={collapsedSections.has(section.id)} onUpdate={updateSection} onRemove={removeSection} onMoveUp={() => reorderSection(index, index - 1)} onMoveDown={() => reorderSection(index, index + 1)} onToggleCollapse={() => setCollapsedSections((prev) => {
                const next = new Set(prev);
                if (next.has(section.id))
                    next.delete(section.id);
                else
                    next.add(section.id);
                return next;
            })} onDragStart={(i) => setDragIndex(i)} onDragOver={(_e, i) => setDragOverIndex(i)} onDrop={(_e, toIndex) => {
                if (dragIndex !== null && dragIndex !== toIndex)
                    reorderSection(dragIndex, toIndex);
                setDragIndex(null);
                setDragOverIndex(null);
            }} onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }} isDragging={dragIndex === index} isDragOver={dragOverIndex === index && dragIndex !== index} onLinkIdentities={section.type === 'identity-showcase' ? () => setPickerOpen(true) : undefined}/>))}

          {page.sections.length >= MAX_SECTIONS_PER_PAGE ? (<p className={styles.hintText}>Section limit reached ({MAX_SECTIONS_PER_PAGE})</p>) : (<SectionPalette onAdd={(type: WikiSectionType) => addSection(type)}/>)}

          <div className={styles.identitiesSection}>
            <div className={styles.sectionsHeader}>
              <h3 className={styles.sectionsTitle}>Linked Identities ({linkedProjects.length})</h3>
              <button type="button" className={styles.linkBtn} onClick={() => setPickerOpen(true)}>Link</button>
            </div>
            {linkedProjects.length === 0 ? (<p className={styles.hintText}>No identities linked yet.</p>) : (<div className={styles.linkedList}>
                {linkedProjects.map((lp, idx) => {
                const meta = projectMetas.find((m) => m.id === lp.project_id);
                return (<div key={lp.id} className={styles.linkedItem}>
                      <div className={styles.reorderBtns}>
                        <button type="button" className={styles.reorderBtn} disabled={idx === 0} onClick={() => reorderProjects(idx, idx - 1)} title="Move up">▲</button>
                        <button type="button" className={styles.reorderBtn} disabled={idx === linkedProjects.length - 1} onClick={() => reorderProjects(idx, idx + 1)} title="Move down">▼</button>
                      </div>
                      <span className={styles.linkedName}>{meta?.name || 'Unknown'}</span>
                      {meta?.character_name && meta.character_name !== meta.name && (<span className={styles.linkedChar}>{meta.character_name}</span>)}
                      <button type="button" className={styles.editDetailBtn} onClick={() => setPreviewProjectId(lp.project_id)}>View</button>
                    </div>);
            })}
              </div>)}
          </div>

          <div className={styles.sidebarFooter}>
            <span className={styles.creditLine}>developed by Nyrrine</span>
            <span className={styles.creditLine}>made with love for Hyacinth</span>
          </div>
        </div>
      </aside>

      <div className={`${styles.resizeHandle} ${isResizing ? styles.resizeHandleActive : ''}`} onMouseDown={handleResizeStart}/>

      <main className={styles.viewport}>
        <div className={styles.bgLayer}/>
        <div className={styles.previewContent} style={wikiGlobalStyle(page)}>
          {page.cover_image && (<div className={styles.previewCover}><img src={page.cover_image} alt=""/></div>)}
          <div className={styles.previewTitle}>{page.title}</div>
          {page.subtitle && <div className={styles.previewSubtitle}>{page.subtitle}</div>}
          <div className={styles.previewDivider}/>
          <div className={styles.previewBody} onDragOver={(e) => {
            if (e.dataTransfer.types.includes('wiki-section-type')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                if (page.sections.length === 0)
                    setViewportDropIndex(0);
            }
        }} onDragLeave={() => setViewportDropIndex(null)} onDrop={(e) => {
            const type = e.dataTransfer.getData('wiki-section-type') as WikiSectionType;
            if (type && viewportDropIndex !== null) {
                insertSectionAt(type, viewportDropIndex);
            }
            else if (type) {
                addSection(type);
            }
            setViewportDropIndex(null);
        }}>
            {page.sections.map((section, idx) => (<div key={section.id}>
                
                <div className={`${styles.dropZone} ${viewportDropIndex === idx ? styles.dropZoneActive : ''}`} onDragOver={(e) => {
                if (e.dataTransfer.types.includes('wiki-section-type')) {
                    e.preventDefault();
                    e.stopPropagation();
                    setViewportDropIndex(idx);
                }
            }}/>
                <SectionRenderer section={section} linkedProjects={linkedProjects} projectMetas={projectMetas} pageSlug={page.slug} onIdentityClick={(projectId) => setPreviewProjectId(projectId)}/>
              </div>))}
            
            <div className={`${styles.dropZone} ${styles.dropZoneLast} ${viewportDropIndex === page.sections.length ? styles.dropZoneActive : ''}`} onDragOver={(e) => {
            if (e.dataTransfer.types.includes('wiki-section-type')) {
                e.preventDefault();
                e.stopPropagation();
                setViewportDropIndex(page.sections.length);
            }
        }}/>
          </div>
        </div>
      </main>

      {pickerOpen && (<ProjectPicker selectedIds={linkedProjects.map((lp) => lp.project_id)} onConfirm={handlePickerConfirm} onClose={() => setPickerOpen(false)}/>)}

      {previewProjectId && (<WikiIdentityPreviewModal key={previewProjectId} projectId={previewProjectId} onClose={() => setPreviewProjectId(null)}/>)}

      {page && (<RevisionHistoryModal pageId={page.id} open={historyOpen} onClose={() => setHistoryOpen(false)} canRestore={mode === 'direct'} runExclusive={autosave.runExclusive} onRestored={(restored) => {
                if (isDirty && !window.confirm('You have unsaved changes. Restoring this revision will discard them. Continue?'))
                    return;
                loadPage(restored, linkedProjects, categorySlugs);
                setServerFacts({ createdBy: restored.created_by, status: restored.status });
                setBaseUpdatedAt(restored.updated_at);
            }}/>)}
    </div>);
}
