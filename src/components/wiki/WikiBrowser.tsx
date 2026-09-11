import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth, roleAtLeast } from '../../hooks/useAuth';
import { WikiPageCard } from './WikiPageCard';
import { Button, Input, Field, Modal, Select, Tabs } from '../ui';
import { listWikiPages, listRecentChanges, searchWikiPages, listCategories, listPagesInCategory, createWikiPage, listMyProposals, withdrawProposal, } from '../../lib/wikiPersistence';
import type { MyProposal } from '../../lib/wikiPersistence';
import { deletePage } from '../../lib/adminPersistence';
import type { WikiCategory, WikiPageKind, WikiPageMeta } from '../../types/wiki';
import { KINDS, wikiSearchPlaceholder, type KindFilter } from '../../lib/wikiKinds';
import styles from './WikiBrowser.module.css';
function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        || 'untitled';
}
type WikiTab = 'pages' | 'recent' | 'categories' | 'proposals';
const BASE_TABS: {
    id: WikiTab;
    label: string;
}[] = [
    { id: 'pages', label: 'All Pages' },
    { id: 'recent', label: 'Recent Changes' },
    { id: 'categories', label: 'Categories' },
];
const PROPOSAL_STATE: Record<MyProposal['state'], string> = {
    open: 'Waiting for review',
    changes_requested: 'Changes asked for',
    merged: 'Merged',
    rejected: 'Not accepted',
    withdrawn: 'Withdrawn',
};
interface WikiBrowserProps {
    embedded?: boolean;
    confirmLeave?: () => boolean;
    search?: string;
    onSearchChange?: (value: string) => void;
}
export function WikiBrowser({ embedded, confirmLeave, search: searchProp, onSearchChange }: WikiBrowserProps) {
    const profile = useAuth((s) => s.profile);
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [localCategory, setLocalCategory] = useState<string | null>(null);
    const categoryFilter = embedded ? localCategory : searchParams.get('category');
    const setCategory = useCallback((slug: string | null) => {
        if (embedded)
            setLocalCategory(slug);
        else
            setSearchParams(slug ? { category: slug } : {});
    }, [embedded, setSearchParams]);
    const go = useCallback((to: string, opts?: {
        state?: unknown;
    }) => {
        if (confirmLeave && !confirmLeave())
            return;
        navigate(to, opts as never);
    }, [confirmLeave, navigate]);
    const canEdit = roleAtLeast(profile?.role, 'editor');
    const canDelete = roleAtLeast(profile?.role, 'moderator');
    const [tab, setTab] = useState<WikiTab>('pages');
    const [kind, setKind] = useState<KindFilter>('all');
    const [memoirOnly, setMemoirOnly] = useState(false);
    const [proposals, setProposals] = useState<MyProposal[] | null>(null);
    const [searching, setSearching] = useState(false);
    const [searchKey, setSearchKey] = useState(0);
    const [pages, setPages] = useState<WikiPageMeta[]>([]);
    const [recent, setRecent] = useState<WikiPageMeta[]>([]);
    const [categories, setCategories] = useState<WikiCategory[]>([]);
    const [categoryPages, setCategoryPages] = useState<WikiPageMeta[]>([]);
    const [ownSearch, setOwnSearch] = useState('');
    const hosted = onSearchChange !== undefined;
    const search = hosted ? (searchProp ?? '') : ownSearch;
    const setSearch = hosted ? onSearchChange : setOwnSearch;
    const [searchResults, setSearchResults] = useState<WikiPageMeta[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newKind, setNewKind] = useState<WikiPageKind>('lore');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const refresh = useCallback(() => { setSearchKey((k) => k + 1); }, []);
    useEffect(() => {
        let ignore = false;
        setLoading(true);
        setError(null);
        Promise.all([
            listWikiPages({
                orderBy: 'title',
                ...(kind !== 'all' && { kind }),
                ...(memoirOnly && { memoirOnly: true }),
            }),
            listRecentChanges(20),
            listCategories(),
        ])
            .then(([all, rec, cats]) => {
            if (ignore)
                return;
            setPages(all);
            setRecent(rec);
            setCategories(cats);
        })
            .catch((err: unknown) => {
            if (!ignore)
                setError(err instanceof Error ? err.message : 'Failed to load');
        })
            .finally(() => { if (!ignore)
            setLoading(false); });
        return () => { ignore = true; };
    }, [kind, memoirOnly, searchKey]);
    useEffect(() => {
        if (tab !== 'proposals' || !canEdit || proposals !== null)
            return;
        listMyProposals().then(setProposals).catch(() => setProposals([]));
    }, [tab, canEdit, proposals]);
    useEffect(() => {
        if (!categoryFilter) {
            setCategoryPages([]);
            return;
        }
        let ignore = false;
        listPagesInCategory(categoryFilter)
            .then((r) => { if (!ignore)
            setCategoryPages(r); })
            .catch(() => { if (!ignore)
            setCategoryPages([]); });
        return () => { ignore = true; };
    }, [categoryFilter, searchKey]);
    useEffect(() => {
        const q = search.trim();
        if (!q) {
            setSearchResults(null);
            return;
        }
        let ignore = false;
        setSearching(true);
        const t = setTimeout(() => {
            searchWikiPages(q, {
                ...(kind !== 'all' && { kind }),
                ...(memoirOnly && { memoirOnly: true }),
            })
                .then((r) => { if (!ignore) {
                setSearchResults(r);
                setSearching(false);
            } })
                .catch(() => { if (!ignore) {
                setSearchResults([]);
                setSearching(false);
            } });
        }, 250);
        return () => { ignore = true; clearTimeout(t); };
    }, [search, kind, memoirOnly, searchKey]);
    const handleCreate = async () => {
        const title = newTitle.trim() || 'New Page';
        setCreating(true);
        setCreateError(null);
        try {
            const slug = slugify(title);
            const page = await createWikiPage(title, slug, newKind);
            go(`/wiki/edit/${page.id}`);
        }
        catch (err) {
            if (err instanceof Error && err.message.includes('slug')) {
                try {
                    const page = await createWikiPage(title, `${slugify(title)}-${Math.random().toString(36).slice(2, 7)}`, newKind);
                    go(`/wiki/edit/${page.id}`);
                    return;
                }
                catch (err2) {
                    setCreateError(err2 instanceof Error ? err2.message : 'Failed to create page');
                }
            }
            else {
                setCreateError(err instanceof Error ? err.message : 'Failed to create page');
            }
        }
        finally {
            setCreating(false);
        }
    };
    const handleDelete = async (pageId: string) => {
        const why = window.prompt('Delete this wiki page?\n\nIts revision history, its images and every proposal made against it are destroyed. This cannot be undone.\n\nReason (kept in the moderation log):');
        if (why === null)
            return;
        try {
            await deletePage(pageId, why);
            refresh();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete');
        }
    };
    const filtered = kind !== 'all' || memoirOnly;
    const grouped = useMemo(() => {
        const letters = new Map<string, WikiPageMeta[]>();
        for (const p of pages) {
            const letter = (p.title[0] || '#').toUpperCase();
            const key = /[A-Z]/.test(letter) ? letter : '#';
            if (!letters.has(key))
                letters.set(key, []);
            letters.get(key)!.push(p);
        }
        return [...letters.entries()].sort(([a], [b]) => a.localeCompare(b));
    }, [pages]);
    const renderCards = (list: WikiPageMeta[]) => (<div className={styles.grid}>
      {list.map((p) => (<WikiPageCard key={p.id} page={p} showStatus={canEdit} onNavigate={confirmLeave} onEdit={canEdit ? () => go(`/wiki/edit/${p.id}`) : undefined} onDelete={canDelete ? () => handleDelete(p.id) : undefined}/>))}
    </div>);
    return (<>
      <div className={`${styles.home} ${embedded ? styles.homeEmbedded : ''}`}>
        
        <div className={styles.toolbar}>
          {!hosted && (<div className={styles.searchWrap}>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={wikiSearchPlaceholder(kind)} aria-label="Search the wiki"/>
            </div>)}
          {(searchResults !== null || (!categoryFilter && tab === 'pages')) && (<div className={styles.filters}>
            {KINDS.map((k) => (<button key={k.id} type="button" className={`${styles.filter} ${kind === k.id ? styles.filterOn : ''}`} aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
                {k.label}
              </button>))}
            <button type="button" className={`${styles.filter} ${styles.filterMemoir} ${memoirOnly ? styles.filterOn : ''}`} aria-pressed={memoirOnly} onClick={() => setMemoirOnly((v) => !v)}>
              Memoir only
            </button>
          </div>)}
          {canEdit && (<Button variant="primary" onClick={() => { setCreateOpen(true); setNewTitle(''); setCreateError(null); }}>
              + Create Page
            </Button>)}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        {searchResults !== null ? (<section className={styles.section}>
            {searching && <p className={styles.muted}>Searching...</p>}
            <h2 className={styles.sectionTitle}>
              {searchResults.length === 0
                ? `No results${kind === 'all' ? '' : ` in ${KINDS.find((k) => k.id === kind)?.label.toLowerCase()}`}${memoirOnly ? ', Memoir only' : ''}`
                : `Results (${searchResults.length})`}
            </h2>
            {searchResults.length === 0 && filtered && (<p className={styles.muted}>
                Filters are narrowing this.{' '}
                <button type="button" className={styles.inlineClear} onClick={() => { setKind('all'); setMemoirOnly(false); }}>
                  Search everything instead
                </button>
              </p>)}
            {renderCards(searchResults)}
          </section>) : categoryFilter ? (<section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                Category: {categories.find((c) => c.slug === categoryFilter)?.name || categoryFilter}
              </h2>
              <Button size="sm" variant="ghost" onClick={() => setCategory(null)}>Clear filter</Button>
            </div>
            {renderCards(categoryPages)}
          </section>) : (<>
            <Tabs tabs={canEdit ? [...BASE_TABS, { id: 'proposals' as WikiTab, label: 'My Proposals' }] : BASE_TABS} active={tab} onChange={setTab} className={styles.tabs}/>

            {loading ? (<p className={styles.muted}>Loading...</p>) : tab === 'pages' ? (pages.length === 0 ? (filtered ? (<div className={styles.empty}>
                    <p>Nothing matches those filters.</p>
                    <Button onClick={() => { setKind('all'); setMemoirOnly(false); }}>
                      Clear filters
                    </Button>
                  </div>) : (<div className={styles.empty}>
                    <p>No pages yet.</p>
                    {canEdit ? (<Button variant="primary" size="lg" onClick={() => setCreateOpen(true)}>
                        Write the first page
                      </Button>) : (<p>Server members can sign in and start writing.</p>)}
                  </div>)) : (grouped.map(([letter, list]) => (<section key={letter} className={styles.section}>
                    <h2 className={styles.letterHeading}>{letter}</h2>
                    {renderCards(list)}
                  </section>)))) : tab === 'recent' ? (<ul className={styles.recentList}>
                {recent.map((p) => (<li key={p.id} className={styles.recentItem}>
                    <Link to={`/wiki/page/${p.slug}`} className={styles.recentTitle}>{p.title}</Link>
                    <span className={styles.recentMeta}>
                      {p.updated_by_username ? `${p.updated_by_username} · ` : ''}
                      {new Date(p.updated_at).toLocaleString()}
                      {canEdit && p.status !== 'published' ? ` · ${p.status}` : ''}
                    </span>
                  </li>))}
              </ul>) : tab === 'proposals' ? (proposals === null ? (<p className={styles.muted}>Loading...</p>) : proposals.length === 0 ? (<div className={styles.empty}>
                  <p>You have not proposed any changes.</p>
                  <p className={styles.muted}>
                    Editing a page someone else owns, or one that is already live, sends
                    your version here for a maintainer to look at.
                  </p>
                </div>) : (<div className={styles.proposalList}>
                  {proposals.map((p) => (<div key={p.id} className={styles.proposalRow}>
                      <span className={`${styles.proposalState} ${styles[`state_${p.state}`]}`}>
                        {p.stale && p.state === 'open' ? 'Needs rebasing' : PROPOSAL_STATE[p.state]}
                      </span>
                      <div className={styles.proposalMain}>
                        <Link to={`/wiki/page/${p.page_slug}`} className={styles.proposalTitle}>
                          {p.page_title || p.title}
                        </Link>
                        <span className={styles.proposalMeta}>
                          {p.summary ? `${p.summary} · ` : ''}
                          sent {new Date(p.created_at).toLocaleDateString()}
                        </span>
                        {p.stale && (p.state === 'open' || p.state === 'changes_requested') && (<span className={styles.proposalNote}>
                            The page changed after you wrote this, so it can no longer be
                            merged as-is. Rebasing re-applies your version onto the current
                            page - anything you changed that nobody else touched carries
                            across on its own.
                          </span>)}
                        {p.review_note && (<span className={styles.proposalNote}>
                            {p.reviewer_username || 'A maintainer'} said: "{p.review_note}"
                          </span>)}
                      </div>
                      {(p.state === 'open' || p.state === 'changes_requested') && p.page_id && (<Button size="sm" variant={p.stale ? 'primary' : 'secondary'} title={p.stale
                            ? 'Re-apply your version onto the page as it stands now'
                            : 'Open your version in the editor'} onClick={() => go(`/wiki/edit/${p.page_id}`, {
                            state: { rebaseProposalId: p.id },
                        })}>
                          {p.stale ? 'Rebase' : 'Open my version'}
                        </Button>)}
                      {(p.state === 'open' || p.state === 'changes_requested') && (<Button size="sm" onClick={() => {
                            if (!window.confirm('Withdraw this proposal?'))
                                return;
                            withdrawProposal(p.id)
                                .then(() => setProposals(null))
                                .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not withdraw'));
                        }}>
                          Withdraw
                        </Button>)}
                    </div>))}
                </div>)) : (<div className={styles.categoryList}>
                {categories.length === 0 ? (<p className={styles.muted}>No categories yet. Editors can create them while editing a page.</p>) : (categories.map((c) => (<button key={c.slug} type="button" className={styles.categoryItem} onClick={() => setCategory(c.slug)}>
                      <span className={styles.categoryName}>{c.name}</span>
                      {c.description && <span className={styles.categoryDesc}>{c.description}</span>}
                    </button>)))}
              </div>)}
          </>)}
      </div>

      <Modal title="Create Page" open={createOpen} onClose={() => setCreateOpen(false)} footer={<>
            <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} disabled={creating || !newTitle.trim()}>
              {creating ? 'Creating...' : 'Create'}
            </Button>
          </>}>
        <Field label="Title" error={createError}>
          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Page title" maxLength={255} autoFocus onKeyDown={(e) => { if (e.key === 'Enter' && newTitle.trim())
        handleCreate(); }}/>
        </Field>
        <Field label="Kind" hint="Character pages can showcase linked identity cards.">
          <Select value={newKind} onChange={(e) => setNewKind(e.target.value as WikiPageKind)}>
            <option value="lore">Lore</option>
            <option value="character">Character</option>
            <option value="guide">Guide</option>
          </Select>
        </Field>
      </Modal>
    </>);
}
