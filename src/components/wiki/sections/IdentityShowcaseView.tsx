import { Link } from 'react-router-dom';
import type { IdentityShowcaseSection, WikiPageProject } from '../../../types/wiki';
import type { SavedProjectMeta } from '../../../lib/projectPersistence';
import styles from './IdentityShowcaseView.module.css';
const GACHA_FRAME: Record<number, string> = {
    1: '/ui/gacha-frame-1.png',
    2: '/ui/gacha-frame-2.png',
    3: '/ui/gacha-frame-3.png',
};
interface IdentityShowcaseViewProps {
    section: IdentityShowcaseSection;
    linkedProjects: WikiPageProject[];
    projectMetas: SavedProjectMeta[];
    pageSlug?: string;
    onIdentityClick?: (projectId: string, wikiPageProjectId: string) => void;
}
export function IdentityShowcaseView({ section, linkedProjects, projectMetas, pageSlug, onIdentityClick, }: IdentityShowcaseViewProps) {
    const metaMap = new Map(projectMetas.map((m) => [m.id, m]));
    if (linkedProjects.length === 0) {
        return (<div className={styles.section}>
        {section.heading && (<h2 className={styles.heading} style={section.headingColor ? { color: section.headingColor } : undefined}>
            {section.heading}
          </h2>)}
        <p className={styles.empty}>No identities linked yet.</p>
      </div>);
    }
    return (<div className={styles.section}>
      {section.heading && (<h2 className={styles.heading} style={section.headingColor ? { color: section.headingColor } : undefined}>
          {section.heading}
        </h2>)}
      <div className={styles.grid}>
        {linkedProjects.map((link) => {
            const meta = metaMap.get(link.project_id);
            if (!meta)
                return null;
            const frameSrc = GACHA_FRAME[meta.rarity] || GACHA_FRAME[1];
            const inner = (<>
              <div className={styles.frame}>
                <div className={styles.portraitClip}>
                  {meta.portrait_url ? (<img className={styles.portrait} src={meta.portrait_url} alt={meta.name}/>) : (<div className={styles.placeholder}>?</div>)}
                </div>
                <img className={styles.gachaFrame} src={frameSrc} alt=""/>
              </div>
              <div className={styles.nameGroup}>
                <span className={styles.name}>{meta.name || 'Untitled'}</span>
                {meta.character_name && meta.character_name !== meta.name && (<span className={styles.characterName}>{meta.character_name}</span>)}
              </div>
            </>);
            if (onIdentityClick) {
                return (<button key={link.id} type="button" className={styles.card} onClick={() => onIdentityClick(link.project_id, link.id)}>
                {inner}
              </button>);
            }
            if (pageSlug) {
                return (<Link key={link.id} to={`/wiki/page/${pageSlug}/${link.id}`} className={styles.card}>
                {inner}
              </Link>);
            }
            return <div key={link.id} className={styles.card}>{inner}</div>;
        })}
      </div>
    </div>);
}
