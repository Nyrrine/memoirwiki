import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useParams, Link } from 'react-router-dom';
import { WikiLayout } from './WikiLayout';
import { SectionRenderer } from './sections/SectionRenderer';
import { loadWikiPageBySlug, getPageContributors, getPageReaders, recordPageView, getLinkedProjects, getBacklinks, getPageCategories, listCategories, getExistingSlugs, extractWikilinkSlugs, } from '../../lib/wikiPersistence';
import { ExistingSlugsContext } from '../../lib/wikiLinkContext';
import { listProjectMetas, type SavedProjectMeta } from '../../lib/projectPersistence';
import { useCustomStatusStore } from '../../hooks/useCustomStatusStore';
import type { Contributor, Reader } from '../../lib/wikiPersistence';
import type { WikiBacklink, WikiCategory, WikiPageData, WikiPageProject } from '../../types/wiki';
import { wikiGlobalStyle } from '../../lib/wikiGlobalStyle';
import styles from './WikiPageView.module.css';
type LoadedPage = WikiPageData & {
    author_username: string | null;
    author_avatar: string | null;
    editor_username: string | null;
};
const DEFAULT_AVATAR = '/icons/story/dias.png';
function AvatarTrail({ people }: {
    people: {
        id: string;
        username: string;
        avatar_icon: string | null;
    }[];
}) {
    return (<div className={styles.avatarStack}>
      {people.slice(0, 6).map((p) => (<img key={p.id} className={styles.avatar} src={p.avatar_icon || DEFAULT_AVATAR} alt={p.username} title={p.username}/>))}
      {people.length > 6 && <span className={styles.avatarMore}>+{people.length - 6}</span>}
    </div>);
}
export function WikiPageView() {
    const { slug } = useParams<{
        slug: string;
    }>();
    const [page, setPage] = useState<LoadedPage | null>(null);
    const [linkedProjects, setLinkedProjects] = useState<WikiPageProject[]>([]);
    const [projectMetas, setProjectMetas] = useState<SavedProjectMeta[]>([]);
    const [backlinks, setBacklinks] = useState<WikiBacklink[]>([]);
    const [categories, setCategories] = useState<WikiCategory[]>([]);
    const [existingSlugs, setExistingSlugs] = useState<Set<string> | null>(null);
    const [contributors, setContributors] = useState<Contributor[]>([]);
    const [readers, setReaders] = useState<Reader[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const loadStatuses = useCustomStatusStore((s) => s.loadStatuses);
    const [hiding, setHiding] = useState(false);
    const [receiptError, setReceiptError] = useState<string | null>(null);
    const viewer = useAuth((s) => s.user);
    const showReceipts = useAuth((s) => s.profile?.show_read_receipts ?? false);
    const setReadReceipts = useAuth((s) => s.setReadReceipts);
    const hideMe = async () => {
        setHiding(true);
        setReceiptError(null);
        try {
            await setReadReceipts(false);
            setReaders((rs) => rs.filter((r) => r.id !== viewer?.id));
        }
        catch (err) {
            setReceiptError(err instanceof Error ? err.message : 'Could not change that');
        }
        finally {
            setHiding(false);
        }
    };
    useEffect(() => { loadStatuses(); }, [loadStatuses]);
    useEffect(() => {
        if (!slug)
            return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const loadedPage = await loadWikiPageBySlug(slug);
                if (cancelled)
                    return;
                if (!loadedPage) {
                    setError('Page not found');
                    setLoading(false);
                    return;
                }
                setPage(loadedPage);
                const [links, back, catSlugs, allCats] = await Promise.all([
                    getLinkedProjects(loadedPage.id),
                    getBacklinks(loadedPage.slug),
                    getPageCategories(loadedPage.id),
                    listCategories(),
                ]);
                if (cancelled)
                    return;
                setLinkedProjects(links);
                setBacklinks(back);
                const catSet = new Set(catSlugs);
                setCategories(allCats.filter((c) => catSet.has(c.slug)));
                if (links.length > 0) {
                    const metas = await listProjectMetas(links.map((l) => l.project_id));
                    if (cancelled)
                        return;
                    setProjectMetas(metas);
                }
                const linkSlugs = extractWikilinkSlugs(loadedPage.sections);
                const known = linkSlugs.length > 0 ? await getExistingSlugs(linkSlugs) : new Set<string>();
                if (cancelled)
                    return;
                setExistingSlugs(known);
                await recordPageView(loadedPage.id).catch(() => { });
                const [people, seen] = await Promise.all([
                    getPageContributors(loadedPage.id).catch(() => []),
                    useAuth.getState().user
                        ? getPageReaders(loadedPage.id).catch(() => [])
                        : Promise.resolve([]),
                ]);
                if (cancelled)
                    return;
                setContributors(people);
                setReaders(seen);
            }
            catch (err) {
                if (!cancelled)
                    setError(err instanceof Error ? err.message : 'Failed to load page');
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [slug]);
    if (loading) {
        return (<WikiLayout>
        <div className={styles.center}><p className={styles.muted}>Loading...</p></div>
      </WikiLayout>);
    }
    if (error || !page) {
        return (<WikiLayout>
        <div className={styles.center}><p className={styles.error}>{error || 'Page not found'}</p></div>
      </WikiLayout>);
    }
    const breadcrumbs = [{ label: page.title }];
    const updated = new Date(page.updated_at).toLocaleDateString();
    return (<WikiLayout breadcrumbs={breadcrumbs}>
      
      <article className={styles.page} style={wikiGlobalStyle(page)}>
        
        {page.cover_image && (<div className={styles.coverWrap}>
            <img src={page.cover_image} alt="" className={styles.cover}/>
          </div>)}

        <header className={styles.header}>
          <h1 className={styles.title}>{page.title}</h1>
          {page.subtitle && <p className={styles.subtitle}>{page.subtitle}</p>}
          <div className={styles.byline}>
            <img className={styles.bylineAvatar} src={page.author_avatar || DEFAULT_AVATAR} alt=""/>
            <span className={styles.bylineText}>
              <span className={styles.bylineWho}>{page.author_username || 'Unknown'}</span>
              <span className={styles.bylineWhen}>
                started this page
                {page.editor_username && page.editor_username !== page.author_username
            ? ` · last edited by ${page.editor_username}` : ''}
                {' · '}{updated}
              </span>
            </span>
          </div>
          <div className={styles.headerDivider}/>
        </header>

        <ExistingSlugsContext.Provider value={existingSlugs}>
          <div className={styles.body}>
            {page.sections.map((section) => (<SectionRenderer key={section.id} section={section} linkedProjects={linkedProjects} projectMetas={projectMetas} pageSlug={page.slug}/>))}
          </div>
        </ExistingSlugsContext.Provider>

        {(contributors.length > 0 || (viewer && readers.length > 0)) && (<div className={styles.trails}>
            {contributors.length > 0 && (<div className={styles.trail}>
                <span className={styles.trailLabel}>Contributors</span>
                <AvatarTrail people={contributors}/>
                <span className={styles.trailCount}>
                  {contributors.length} {contributors.length === 1 ? 'person' : 'people'}
                  {' · '}
                  {contributors.reduce((n, c) => n + c.edits, 0)} edits
                </span>
              </div>)}
            {viewer && readers.length > 0 && (<div className={styles.trail}>
                <span className={styles.trailLabel}>Recently read</span>
                <AvatarTrail people={readers}/>
                {showReceipts && (<button type="button" className={styles.trailOptOut} disabled={hiding} title="Stop recording which pages you read, and delete what is already recorded" onClick={() => { void hideMe(); }}>
                    {hiding ? 'Hiding...' : 'Hide me'}
                  </button>)}
              </div>)}
            {receiptError && <span className={styles.trailError}>{receiptError}</span>}
          </div>)}

        {categories.length > 0 && (<div className={styles.categoryRow}>
            <span className={styles.categoryLabel}>Categories:</span>
            {categories.map((c) => (<Link key={c.slug} to={`/wiki?category=${encodeURIComponent(c.slug)}`} className={styles.categoryChip}>
                {c.name}
              </Link>))}
          </div>)}

        {backlinks.length > 0 && (<aside className={styles.backlinks}>
            <h2 className={styles.backlinksTitle}>What links here</h2>
            <ul className={styles.backlinksList}>
              {backlinks.map((b) => (<li key={b.page_id}>
                  <Link to={`/wiki/page/${b.slug}`} className={styles.backlinkItem}>{b.title}</Link>
                </li>))}
            </ul>
          </aside>)}
      </article>
    </WikiLayout>);
}
