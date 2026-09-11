import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, type MemberRole } from '../../../hooks/useAuth';
import { WikiLayout } from '../WikiLayout';
import { Tabs, Button, Input, TextArea, Select, Modal } from '../../ui';
import { ProposalDiff, FieldDiff } from './ProposalDiff';
import { loadWikiPage, getPageCategories, extractWikilinkSlugs } from '../../../lib/wikiPersistence';
import { listProposals, getProposal, mergeProposal, reviewProposal, purgeProposals, listAllPages, setPageStatus, deletePage, countOpenProposals, listMembers, setMemberRole, banMember, listAllCards, deleteCard, listAllStatuses, deleteStatus, listModerationLog, listPageActivity, type Proposal, type ProposalSummary, type AdminPage, type Member, type AdminCard, type AdminStatus, type LogEntry, type PageActivity, } from '../../../lib/adminPersistence';
import { CLASSIFICATION_COLORS } from '../../../types/customStatus';
import type { WikiPageData, WikiPageStatus } from '../../../types/wiki';
import styles from './WikiAdmin.module.css';
type AdminTab = 'queue' | 'pages' | 'people' | 'cards' | 'statuses' | 'activity';
const TABS: {
    id: AdminTab;
    label: string;
}[] = [
    { id: 'queue', label: 'Review Queue' },
    { id: 'pages', label: 'Pages' },
    { id: 'people', label: 'People' },
    { id: 'cards', label: 'Characters' },
    { id: 'statuses', label: 'Statuses' },
    { id: 'activity', label: 'Activity' },
];
const ROLES: MemberRole[] = ['reader', 'editor', 'moderator', 'admin'];
const DEFAULT_AVATAR = '/icons/story/dias.png';
interface ReviewDetail {
    proposal: Proposal;
    live: WikiPageData;
    liveCategories: string[];
}
function when(iso: string | null): string {
    if (!iso)
        return '-';
    return new Date(iso).toLocaleString();
}
export function WikiAdmin() {
    const profile = useAuth((s) => s.profile);
    const isAdmin = profile?.role === 'admin';
    const [tab, setTab] = useState<AdminTab>('queue');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [proposals, setProposals] = useState<ProposalSummary[] | null>(null);
    const [pages, setPages] = useState<AdminPage[] | null>(null);
    const [members, setMembers] = useState<Member[] | null>(null);
    const [cards, setCards] = useState<AdminCard[] | null>(null);
    const [statuses, setStatuses] = useState<AdminStatus[] | null>(null);
    const [log, setLog] = useState<LogEntry[] | null>(null);
    const [activity, setActivity] = useState<PageActivity[] | null>(null);
    const run = useCallback(async (fn: () => Promise<void>) => {
        setBusy(true);
        setError(null);
        try {
            await fn();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
        }
        finally {
            setBusy(false);
        }
    }, []);
    const loadQueue = useCallback(() => run(async () => { setProposals(await listProposals()); }), [run]);
    useEffect(() => {
        if (tab === 'queue' && proposals === null)
            void loadQueue();
        if (tab === 'pages' && pages === null)
            void run(async () => { setPages(await listAllPages()); });
        if (tab === 'people' && members === null)
            void run(async () => { setMembers(await listMembers()); });
        if (tab === 'cards' && cards === null)
            void run(async () => { setCards(await listAllCards()); });
        if (tab === 'statuses' && statuses === null)
            void run(async () => { setStatuses(await listAllStatuses()); });
        if (tab === 'activity' && log === null) {
            void run(async () => {
                const [entries, pageStats] = await Promise.all([listModerationLog(), listPageActivity()]);
                setLog(entries);
                setActivity(pageStats);
            });
        }
    }, [tab, proposals, pages, members, cards, statuses, log, run, loadQueue]);
    const pendingCount = proposals?.filter((p) => !p.stale).length ?? 0;
    const refresh = useCallback(() => {
        setProposals(null);
        setPages(null);
        setMembers(null);
        setCards(null);
        setStatuses(null);
        setLog(null);
        setActivity(null);
        setError(null);
    }, []);
    return (<WikiLayout breadcrumbs={[{ label: 'Moderation' }]}>
      <div className={styles.admin}>
        <header className={styles.header}>
          <h1 className={styles.title}>Moderation</h1>
          <span className={styles.who}>
            Signed in as {profile?.username} · {profile?.role}
          </span>
        </header>

        <div className={styles.tabRow}>
          <Tabs tabs={TABS.map((t) => (t.id === 'queue' && pendingCount > 0
            ? { ...t, label: `${t.label} (${pendingCount})` } : t))} active={tab} onChange={setTab}/>
          <Button size="sm" onClick={refresh} title="Re-read everything from the server">
            Refresh
          </Button>
        </div>

        {error && (<p className={styles.error} role="alert">
            {error}
            <button type="button" className={styles.dismiss} onClick={() => setError(null)}>dismiss</button>
          </p>)}
        {busy && <p className={styles.muted}>Working...</p>}

        {tab === 'queue' && <QueueTab proposals={proposals} onDone={loadQueue}/>}
        {tab === 'pages' && (<PagesTab pages={pages} run={run} onChanged={() => run(async () => { setPages(await listAllPages()); })}/>)}
        {tab === 'people' && (<PeopleTab members={members} isAdmin={isAdmin} run={run} onChanged={() => run(async () => { setMembers(await listMembers()); })}/>)}
        {tab === 'cards' && (<CardsTab cards={cards} run={run} onChanged={() => run(async () => { setCards(await listAllCards()); })}/>)}
        {tab === 'statuses' && (<StatusesTab statuses={statuses} run={run} onChanged={() => run(async () => { setStatuses(await listAllStatuses()); })}/>)}
        {tab === 'activity' && <ActivityTab log={log} activity={activity}/>}
      </div>
    </WikiLayout>);
}
interface QueueTabProps {
    proposals: ProposalSummary[] | null;
    onDone: () => void;
}
function QueueTab({ proposals, onDone }: QueueTabProps) {
    const [openId, setOpenId] = useState<string | null>(null);
    const [detail, setDetail] = useState<ReviewDetail | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const [working, setWorking] = useState(false);
    const request = useRef(0);
    const close = () => {
        request.current += 1;
        setOpenId(null);
        setDetail(null);
        setNote('');
        setLoadError(null);
        setActionError(null);
    };
    const openProposal = async (id: string) => {
        const token = ++request.current;
        setOpenId(id);
        setDetail(null);
        setNote('');
        setLoadError(null);
        setActionError(null);
        try {
            const proposal = await getProposal(id);
            if (token !== request.current)
                return;
            if (!proposal) {
                setLoadError('That proposal is no longer there.');
                return;
            }
            const [live, liveCategories] = await Promise.all([
                loadWikiPage(proposal.page_id),
                getPageCategories(proposal.page_id),
            ]);
            if (token !== request.current)
                return;
            if (!live) {
                setLoadError('The page this targets has been deleted.');
                return;
            }
            setDetail({ proposal, live, liveCategories });
        }
        catch (err) {
            if (token !== request.current)
                return;
            setLoadError(err instanceof Error ? err.message : 'Could not load this proposal.');
        }
    };
    const decide = async (action: 'merge' | 'changes_requested' | 'rejected') => {
        if (!detail)
            return;
        setWorking(true);
        setActionError(null);
        try {
            if (action === 'merge') {
                await mergeProposal(detail.proposal.id, detail.proposal.updated_at, note.trim() || undefined);
            }
            else {
                await reviewProposal(detail.proposal.id, action, note.trim() || undefined);
            }
            close();
            onDone();
        }
        catch (err) {
            setActionError(err instanceof Error ? err.message : 'That did not go through.');
        }
        finally {
            setWorking(false);
        }
    };
    if (proposals === null)
        return <p className={styles.muted}>Loading...</p>;
    if (proposals.length === 0) {
        return (<div className={styles.empty}>
        <p>Nothing waiting for review.</p>
        <p className={styles.muted}>
          Proposals appear here when a contributor changes a page that is already live.
        </p>
      </div>);
    }
    const ready = detail !== null;
    const stale = detail?.proposal.stale ?? false;
    return (<>
      <div className={styles.list}>
        {proposals.map((p) => (<div key={p.id} className={`${styles.row} ${p.stale ? styles.rowStale : ''}`}>
            <span className={p.stale ? styles.pillStale : styles.pillPending}>
              {p.stale ? 'Stale' : p.state === 'changes_requested' ? 'Changes asked' : 'Proposal'}
            </span>
            <div className={styles.rowMain}>
              <Link to={`/wiki/page/${p.page_slug}`} className={styles.rowTitle}>
                {p.page_title || p.title}
              </Link>
              <span className={styles.rowMeta}>
                {p.author_username || 'unknown'}
                {p.summary ? ` · ${p.summary}` : ''} · {when(p.created_at)}
              </span>
            </div>
            <Button size="sm" onClick={() => { void openProposal(p.id); }}>Review</Button>
          </div>))}
      </div>

      <Modal title={detail ? `Review: ${detail.proposal.page_title || detail.proposal.title}` : 'Review'} open={openId !== null} onClose={close} wide footer={<>
            <Button onClick={close}>Cancel</Button>
            <Button onClick={() => { void decide('changes_requested'); }} disabled={!ready || working}>
              Request changes
            </Button>
            <Button onClick={() => { void decide('rejected'); }} disabled={!ready || working}>
              Reject
            </Button>
            <Button variant="primary" onClick={() => { void decide('merge'); }} disabled={!ready || working || stale} title={!ready ? 'Wait for the comparison to load'
                : stale ? 'The page moved on - the author can rebase it from My Proposals'
                    : undefined}>
              {stale ? 'Cannot merge - stale' : 'Merge'}
            </Button>
          </>}>
        <div className={styles.review}>
          {actionError && <p className={styles.error} role="alert">{actionError}</p>}
          {loadError && <p className={styles.error} role="alert">{loadError}</p>}

          {!detail && !loadError && <p className={styles.muted}>Loading the comparison...</p>}

          {detail && (<>
              <div className={styles.reviewMeta}>
                <span>By <strong>{detail.proposal.author_username || 'unknown'}</strong></span>
                <span>{when(detail.proposal.created_at)}</span>
              </div>
              {detail.proposal.summary && (<p className={styles.contributorNote}>
                  <span className={styles.noteWho}>Their note</span>
                  {detail.proposal.summary}
                </p>)}

              {stale && (<p className={styles.warn}>
                  The page changed after this was written, so merging it would undo that change.
                  {' '}{detail.proposal.author_username || 'The author'} can rebase it onto the
                  current version from My Proposals - anything they changed that nobody else
                  touched carries across on its own - and resubmit. Asking for a redo is no
                  longer necessary.
                </p>)}

              <FieldDiff label="Title" before={detail.live.title} after={detail.proposal.title}/>
              <FieldDiff label="Description" before={detail.live.subtitle} after={detail.proposal.subtitle}/>
              <FieldDiff label="Kind" before={detail.live.kind} after={detail.proposal.kind}/>
              <FieldDiff label="Memoir" before={detail.live.is_memoir ? 'Part of Memoir' : 'Not tagged'} after={detail.proposal.is_memoir ? 'Part of Memoir' : 'Not tagged'}/>
              
              <FieldDiff label="Cover image" before={detail.live.cover_image} after={detail.proposal.cover_image}/>
              <FieldDiff label="Categories" before={[...detail.liveCategories].sort().join(', ')} after={[...(detail.proposal.category_slugs || [])].sort().join(', ')}/>
              <FieldDiff label="Outgoing links" before={[...new Set(extractWikilinkSlugs(detail.live.sections))].sort().join(', ')} after={[...new Set(detail.proposal.link_slugs || [])].sort().join(', ')}/>
              
              <FieldDiff label="Page background" before={detail.live.global_bg_color} after={detail.proposal.global_bg_color}/>
              <FieldDiff label="Page accent" before={detail.live.global_accent_color} after={detail.proposal.global_accent_color}/>
              <FieldDiff label="Page text colour" before={detail.live.global_text_color} after={detail.proposal.global_text_color}/>
              <FieldDiff label="Page font" before={detail.live.global_font} after={detail.proposal.global_font}/>
              <ProposalDiff before={detail.live.sections} after={detail.proposal.sections}/>
            </>)}

          <label className={styles.label} htmlFor="review-note">Note for the author (optional)</label>
          <TextArea id="review-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should they change, or why is this good?" rows={3} maxLength={1000}/>
        </div>
      </Modal>
    </>);
}
function PagesTab({ pages, run, onChanged }: {
    pages: AdminPage[] | null;
    run: (fn: () => Promise<void>) => Promise<void>;
    onChanged: () => void;
}) {
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | WikiPageStatus>('all');
    const shown = useMemo(() => (pages || []).filter((p) => {
        if (statusFilter !== 'all' && p.status !== statusFilter)
            return false;
        const q = filter.trim().toLowerCase();
        if (!q)
            return true;
        return p.title.toLowerCase().includes(q)
            || p.slug.toLowerCase().includes(q)
            || (p.author_username || '').toLowerCase().includes(q);
    }), [pages, filter, statusFilter]);
    if (pages === null)
        return <p className={styles.muted}>Loading...</p>;
    const remove = (p: AdminPage) => {
        const extra = p.open_proposals > 0
            ? ` ${p.open_proposals} open proposal${p.open_proposals === 1 ? '' : 's'} and every merged review record for it go too.`
            : '';
        const why = window.prompt(`Delete "${p.title}"?\n\nIts revision history, its images and every proposal ever made against it are destroyed.${extra} This cannot be undone.\n\nReason (kept in the moderation log):`);
        if (why === null)
            return;
        void run(async () => { await deletePage(p.id, why); onChanged(); });
    };
    const changeStatus = (p: AdminPage) => async (status: WikiPageStatus) => {
        void run(async () => {
            const pending = await countOpenProposals(p.id);
            if (pending > 0 && !window.confirm(`"${p.title}" has ${pending} open proposal${pending === 1 ? '' : 's'}. Changing its status makes ${pending === 1 ? 'it' : 'them'} stale, so ${pending === 1 ? 'its author' : 'their authors'} will have to rebase from My Proposals before ${pending === 1 ? 'it' : 'they'} can be merged. Continue?`))
                return;
            await setPageStatus(p.id, status);
            onChanged();
        });
    };
    return (<>
      <div className={styles.filters}>
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by title, slug or author" aria-label="Filter pages"/>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | WikiPageStatus)} aria-label="Filter by status">
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="in_review">In review</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </Select>
        <span className={styles.count}>{shown.length} of {pages.length}</span>
      </div>

      <div className={styles.list}>
        {shown.map((p) => (<div key={p.id} className={styles.row}>
            <span className={styles[`pill${p.status === 'published' ? 'Live' : p.status === 'in_review' ? 'Pending' : 'Draft'}`]}>
              {p.status === 'in_review' ? 'In review' : p.status}
            </span>
            <div className={styles.rowMain}>
              <Link to={`/wiki/page/${p.slug}`} className={styles.rowTitle}>{p.title}</Link>
              <span className={styles.rowMeta}>
                {p.kind}{p.is_memoir ? ' · Memoir' : ''} · by {p.author_username || 'unknown'}
                {p.editor_username && p.editor_username !== p.author_username ? `, last edited by ${p.editor_username}` : ''}
                {' · '}{when(p.updated_at)}
                {p.open_proposals > 0 && (<strong className={styles.pendingNote}>
                    {' · '}{p.open_proposals} open proposal{p.open_proposals === 1 ? '' : 's'}
                  </strong>)}
              </span>
            </div>
            <Link to={`/wiki/edit/${p.id}`} className={styles.linkBtn}>Edit</Link>
            {p.status !== 'published' ? (<Button size="sm" onClick={() => { void changeStatus(p)('published'); }}>Publish</Button>) : (<Button size="sm" onClick={() => { void changeStatus(p)('draft'); }}>Unpublish</Button>)}
            {p.status !== 'archived' && (<Button size="sm" onClick={() => { void changeStatus(p)('archived'); }}>Archive</Button>)}
            <Button size="sm" variant="danger" onClick={() => remove(p)}>Delete</Button>
          </div>))}
        {shown.length === 0 && <p className={styles.muted}>No pages match.</p>}
      </div>
    </>);
}
function PeopleTab({ members, isAdmin, run, onChanged }: {
    members: Member[] | null;
    isAdmin: boolean;
    run: (fn: () => Promise<void>) => Promise<void>;
    onChanged: () => void;
}) {
    const [filter, setFilter] = useState('');
    const [banning, setBanning] = useState<Member | null>(null);
    const [reason, setReason] = useState('');
    const [banError, setBanError] = useState<string | null>(null);
    const [banWorking, setBanWorking] = useState(false);
    const shown = useMemo(() => (members || []).filter((m) => {
        const q = filter.trim().toLowerCase();
        return !q || m.username.toLowerCase().includes(q) || m.role.includes(q);
    }), [members, filter]);
    if (members === null)
        return <p className={styles.muted}>Loading...</p>;
    const doBan = async () => {
        if (!banning)
            return;
        const target = banning;
        setBanWorking(true);
        setBanError(null);
        try {
            await banMember(target.id, reason.trim() || 'No reason given');
            setBanning(null);
            setReason('');
            onChanged();
        }
        catch (err) {
            setBanError(err instanceof Error ? err.message : 'That did not go through.');
        }
        finally {
            setBanWorking(false);
        }
    };
    return (<>
      <div className={styles.filters}>
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by name or role" aria-label="Filter members"/>
        <span className={styles.count}>{shown.length} of {members.length}</span>
      </div>

      {!isAdmin && (<p className={styles.muted}>
          Roles and bans are admin-only. You can see everything here, but the controls need the owner.
        </p>)}

      <div className={styles.list}>
        {shown.map((m) => (<div key={m.id} className={`${styles.row} ${m.role === 'banned' ? styles.rowBanned : ''}`}>
            <img className={styles.avatar} src={m.avatar_icon || DEFAULT_AVATAR} alt=""/>
            <div className={styles.rowMain}>
              <span className={styles.rowTitle}>{m.username}</span>
              <span className={styles.rowMeta}>
                {m.page_count} pages · {m.card_count} cards · {m.status_count} statuses · joined {when(m.created_at)}
                {m.banned_at ? ` · banned ${when(m.banned_at)}${m.banned_reason ? `: ${m.banned_reason}` : ''}` : ''}
                {m.role_locked && !m.banned_at ? ' · role set by hand' : ''}
              </span>
            </div>
            {isAdmin ? (<Select value={m.role === 'banned' ? '' : m.role} aria-label={`Role for ${m.username}`} onChange={(e) => {
                    const next = e.target.value as MemberRole;
                    if (!next)
                        return;
                    if (!window.confirm(`Change ${m.username} from ${m.role} to ${next}?`))
                        return;
                    void run(async () => { await setMemberRole(m.id, next); onChanged(); });
                }}>
                {m.role === 'banned' && <option value="">banned</option>}
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>) : (<span className={styles.roleTag}>{m.role}</span>)}
            <Button size="sm" title="Remove this member's merged, rejected and withdrawn proposals" onClick={() => {
                if (!window.confirm(`Clear ${m.username}'s finished proposals? Open ones are untouched, and the moderation log keeps what was decided.`))
                    return;
                void run(async () => {
                    const removed = await purgeProposals(m.id);
                    window.alert(removed === 0 ? 'Nothing to clear.' : `Cleared ${removed}.`);
                });
            }}>
              Clear proposals
            </Button>
            {isAdmin && (<Button size="sm" variant={m.role === 'banned' ? 'secondary' : 'danger'} onClick={() => { setBanning(m); setReason(m.banned_reason || ''); }}>
                {m.role === 'banned' ? 'Edit reason' : 'Ban'}
              </Button>)}
          </div>))}
      </div>

      <Modal title={banning ? (banning.role === 'banned' ? `Ban reason for ${banning.username}` : `Ban ${banning.username}`) : ''} open={banning !== null} onClose={() => { setBanning(null); setBanError(null); }} footer={<>
            <Button onClick={() => { setBanning(null); setBanError(null); }}>Cancel</Button>
            <Button variant="danger" onClick={() => { void doBan(); }} disabled={banWorking}>
              {banning?.role === 'banned' ? 'Save reason' : 'Ban'}
            </Button>
          </>}>
        {banError && <p className={styles.error} role="alert">{banError}</p>}
        {banning?.role === 'banned' ? (<p className={styles.muted}>
            Editing the reason only. When the ban happened, and who did it, stay as they were.
          </p>) : (<p className={styles.muted}>
            They keep their account and everything they made, but cannot create, edit or delete
            anything - including their own cards, statuses and images. You can undo it by setting
            their role back.
          </p>)}
        <label className={styles.label} htmlFor="ban-reason">Reason (kept in the log)</label>
        <TextArea id="ban-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} placeholder="What happened?"/>
      </Modal>
    </>);
}
function CardsTab({ cards, run, onChanged }: {
    cards: AdminCard[] | null;
    run: (fn: () => Promise<void>) => Promise<void>;
    onChanged: () => void;
}) {
    const [filter, setFilter] = useState('');
    const shown = useMemo(() => (cards || []).filter((c) => {
        const q = filter.trim().toLowerCase();
        return !q || (c.name || '').toLowerCase().includes(q)
            || (c.owner_username || '').toLowerCase().includes(q);
    }), [cards, filter]);
    if (cards === null)
        return <p className={styles.muted}>Loading...</p>;
    const remove = (c: AdminCard) => {
        const why = window.prompt(`Delete "${c.name || 'Untitled'}" by ${c.owner_username || 'unknown'}?\n\nIt disappears from any wiki page showing it, and this cannot be undone.\n\nReason (kept in the moderation log):`);
        if (why === null)
            return;
        void run(async () => { await deleteCard(c.id, why); onChanged(); });
    };
    return (<>
      <div className={styles.filters}>
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by card or owner" aria-label="Filter cards"/>
        <span className={styles.count}>{shown.length} of {cards.length}</span>
      </div>
      <div className={styles.cardGrid}>
        {shown.map((c) => (<div key={c.id} className={styles.card}>
            {c.portrait_url
                ? <img className={styles.portrait} src={c.portrait_url} alt=""/>
                : <div className={styles.portraitBlank}/>}
            <div className={styles.cardBody}>
              <span className={styles.cardName}>{c.name || 'Untitled'}</span>
              <span className={styles.rowMeta}>{c.owner_username || 'unknown'} · {when(c.updated_at)}</span>
            </div>
            <Button size="sm" variant="danger" onClick={() => remove(c)}>Delete</Button>
          </div>))}
        {shown.length === 0 && <p className={styles.muted}>No cards match.</p>}
      </div>
    </>);
}
function StatusesTab({ statuses, run, onChanged }: {
    statuses: AdminStatus[] | null;
    run: (fn: () => Promise<void>) => Promise<void>;
    onChanged: () => void;
}) {
    if (statuses === null)
        return <p className={styles.muted}>Loading...</p>;
    const remove = (s: AdminStatus) => {
        const why = window.prompt(`Delete the "${s.name}" status by ${s.owner_username || 'unknown'}?\n\nAny page using :custom_${s.key}: stops rendering it.\n\nReason (kept in the moderation log):`);
        if (why === null)
            return;
        void run(async () => { await deleteStatus(s.id, why); onChanged(); });
    };
    return (<>
      <p className={styles.muted}>
        Status keys are unique across the whole site and render inside everyone's pages,
        so a squatted or offensive one affects more than its owner.
      </p>
      <div className={styles.list}>
        {statuses.map((s) => (<div key={s.id} className={styles.row}>
            {s.icon_url
                ? <img className={styles.statusIcon} src={s.icon_url} alt=""/>
                : <span className={styles.statusDot} style={{ background: CLASSIFICATION_COLORS[s.classification] }}/>}
            <div className={styles.rowMain}>
              <span className={styles.rowTitle}>{s.name}</span>
              <span className={styles.rowMeta}>
                :custom_{s.key}: · {s.classification} · {s.owner_username || 'unknown'} · {when(s.created_at)}
              </span>
            </div>
            <Button size="sm" variant="danger" onClick={() => remove(s)}>Delete</Button>
          </div>))}
        {statuses.length === 0 && <p className={styles.muted}>No custom statuses yet.</p>}
      </div>
    </>);
}
function describe(entry: LogEntry): string {
    const d = entry.detail || {};
    const who = entry.target_name || 'someone';
    switch (entry.action) {
        case 'proposal.merge': return `merged a proposal into ${who}`;
        case 'proposal.rejected': return `rejected a proposal for ${who}`;
        case 'proposal.changes_requested': return `asked for changes on a proposal for ${who}`;
        case 'proposal.purge': return `cleared ${d.removed ?? 0} finished proposals for ${who}`;
        case 'member.role': return `changed ${who} from ${d.from} to ${d.to}`;
        case 'member.ban': return `banned ${who}`;
        case 'member.ban_reason': return `corrected the ban reason for ${who}`;
        case 'page.delete':
            return `deleted the page ${who}${d.proposals_lost ? `, losing ${d.proposals_lost} proposal record${d.proposals_lost === 1 ? '' : 's'}` : ''}`;
        case 'page.status': return `moved ${who} from ${d.from} to ${d.to}`;
        case 'card.delete':
            return `deleted ${who}'s card "${d.name || 'Untitled'}"${d.pages_affected ? `, removing it from ${d.pages_affected} page${d.pages_affected === 1 ? '' : 's'}` : ''}`;
        case 'status.delete': return `deleted ${who}'s status ":custom_${d.key}:"`;
        default: return entry.action;
    }
}
function ActivityTab({ log, activity }: {
    log: LogEntry[] | null;
    activity: PageActivity[] | null;
}) {
    if (log === null)
        return <p className={styles.muted}>Loading...</p>;
    return (<div className={styles.activity}>
      <section>
        <h2 className={styles.sectionTitle}>Moderation log</h2>
        {log.length === 0 ? (<p className={styles.muted}>Nothing yet. Merges, rejections, role changes and bans land here.</p>) : (<div className={styles.list}>
            {log.map((e) => (<div key={e.id} className={styles.logRow}>
                <span className={styles.logWhen}>{when(e.created_at)}</span>
                <span className={styles.logWhat}>
                  <strong>{e.actor_username || 'someone'}</strong> {describe(e)}
                  {typeof e.detail?.reason === 'string' && e.detail.reason && (<em className={styles.logNote}> - reason: {e.detail.reason as string}</em>)}
                  {typeof e.detail?.review_note === 'string' && e.detail.review_note && (<em className={styles.logNote}> - their note to the author: {e.detail.review_note as string}</em>)}
                  {typeof e.detail?.summary === 'string' && e.detail.summary && (<em className={styles.logNote}> - contributor wrote: "{e.detail.summary as string}"</em>)}
                </span>
              </div>))}
          </div>)}
      </section>

      <section>
        <h2 className={styles.sectionTitle}>Page reads</h2>
        
        <p className={styles.muted}>
            Counts only members who leave read receipts on, so treat them as a
            minimum.
        </p>
        {!activity || activity.length === 0 ? (<p className={styles.muted}>No reads recorded from members who show them.</p>) : (<div className={styles.list}>
            {activity.map((a) => (<div key={a.page_id} className={styles.row}>
                <div className={styles.rowMain}>
                  <Link to={`/wiki/page/${a.slug}`} className={styles.rowTitle}>{a.title}</Link>
                  <span className={styles.rowMeta}>last read {when(a.last_viewed_at)}</span>
                </div>
                <span className={styles.stat}>{a.readers} readers</span>
                <span className={styles.stat}>{a.views} reads</span>
              </div>))}
          </div>)}
      </section>
    </div>);
}
