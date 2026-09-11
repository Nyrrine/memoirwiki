import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { WikiLayout } from './WikiLayout';
import { SectionRenderer } from './sections/SectionRenderer';
import { CardRenderer } from '../card/CardRenderer';
import { loadWikiPageBySlug, getLinkedProjects } from '../../lib/wikiPersistence';
import { loadProject } from '../../lib/projectPersistence';
import { useCustomStatusStore } from '../../hooks/useCustomStatusStore';
import type { WikiPageData, WikiPageProject } from '../../types/wiki';
import type { ProjectData } from '../../types/project';
import styles from './WikiIdentityView.module.css';
const CARD_W = 1280;
const CARD_H = 720;
function ScaledCard({ children }: {
    children: React.ReactNode;
}) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0.65);
    useLayoutEffect(() => {
        const el = wrapRef.current;
        if (!el)
            return;
        const measure = () => setScale(Math.min(el.clientWidth / CARD_W, 1));
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    return (<div className={styles.cardBreakout}>
      <div ref={wrapRef} className={styles.cardWrap} style={{ height: CARD_H * scale }}>
        <div className={styles.cardStage} style={{ transform: `scale(${scale})` }}>
          {children}
        </div>
      </div>
    </div>);
}
export function WikiIdentityView() {
    const { slug, identityId } = useParams<{
        slug: string;
        identityId: string;
    }>();
    const [page, setPage] = useState<WikiPageData | null>(null);
    const [link, setLink] = useState<WikiPageProject | null>(null);
    const [projectData, setProjectData] = useState<ProjectData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const loadStatuses = useCustomStatusStore((s) => s.loadStatuses);
    useEffect(() => { loadStatuses(); }, [loadStatuses]);
    useEffect(() => {
        (async () => {
            if (!slug || !identityId)
                return;
            setLoading(true);
            setError(null);
            try {
                const pageResult = await loadWikiPageBySlug(slug);
                if (!pageResult) {
                    setError('Page not found');
                    setLoading(false);
                    return;
                }
                setPage(pageResult);
                const links = await getLinkedProjects(pageResult.id);
                const foundLink = links.find((l) => l.id === identityId);
                if (!foundLink) {
                    setError('Identity not found');
                    setLoading(false);
                    return;
                }
                setLink(foundLink);
                const project = await loadProject(foundLink.project_id);
                if (project) {
                    setProjectData(project.data);
                }
            }
            catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load');
            }
            finally {
                setLoading(false);
            }
        })();
    }, [slug, identityId]);
    if (loading) {
        return (<WikiLayout>
        <div className={styles.center}><p className={styles.muted}>Loading...</p></div>
      </WikiLayout>);
    }
    if (error || !page || !link) {
        return (<WikiLayout>
        <div className={styles.center}><p className={styles.error}>{error || 'Not found'}</p></div>
      </WikiLayout>);
    }
    const breadcrumbs = [
        { label: page.title, to: `/wiki/page/${slug}` },
        { label: projectData?.identityName || 'Identity' },
    ];
    return (<WikiLayout breadcrumbs={breadcrumbs}>
      <article className={styles.page}>
        <Link to={`/wiki/page/${slug}`} className={styles.backLink}>
          &larr; Back to {page.title}
        </Link>

        <header className={styles.header}>
          <h1 className={styles.title}>
            {projectData?.identityName || 'Identity'}
          </h1>
          {projectData?.characterName && (<p className={styles.characterName}>{projectData.characterName}</p>)}
        </header>

        {projectData && (<ScaledCard>
            <CardRenderer data={projectData}/>
          </ScaledCard>)}

        {link.detail_sections.length > 0 && (<div className={styles.body}>
            {link.detail_sections.map((section) => (<SectionRenderer key={section.id} section={section}/>))}
          </div>)}
      </article>
    </WikiLayout>);
}
