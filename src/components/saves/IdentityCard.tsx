import { useRef, useEffect, useCallback } from 'react';
import styles from './IdentityCard.module.css';
import type { SavedProjectMeta } from '../../lib/projectPersistence';
const GACHA_FRAME: Record<number, string> = {
    1: '/ui/gacha-frame-1.png',
    2: '/ui/gacha-frame-2.png',
    3: '/ui/gacha-frame-3.png',
};
const RARITY_CLASS: Record<number, string> = {
    1: styles.rarity1,
    2: styles.rarity2,
    3: styles.rarity3,
};
function FitText({ text, className, baseSize, minSize }: {
    text: string;
    className: string;
    baseSize: number;
    minSize: number;
}) {
    const ref = useRef<HTMLSpanElement>(null);
    const fit = useCallback(() => {
        const el = ref.current;
        if (!el)
            return;
        el.style.fontSize = `${baseSize}px`;
        if (el.scrollWidth > el.clientWidth) {
            const shrunk = Math.max(minSize, Math.floor(baseSize * (el.clientWidth / el.scrollWidth)));
            el.style.fontSize = `${shrunk}px`;
        }
    }, [baseSize, minSize]);
    useEffect(() => { fit(); }, [text, fit]);
    return <span ref={ref} className={className} style={{ fontSize: baseSize }}>{text}</span>;
}
interface IdentityCardProps {
    project: SavedProjectMeta;
    onClick: () => void;
}
export function IdentityCard({ project, onClick }: IdentityCardProps) {
    const rarityClass = RARITY_CLASS[project.rarity] || styles.rarity1;
    const frameSrc = GACHA_FRAME[project.rarity] || GACHA_FRAME[1];
    return (<button className={`${styles.card} ${rarityClass}`} onClick={onClick} type="button">
      <div className={styles.frame}>
        <div className={styles.portraitClip}>
          {project.portrait_url ? (<img className={styles.portrait} src={project.portrait_url} alt={project.name}/>) : (<div className={styles.placeholder}>
              <span className={styles.placeholderIcon}>?</span>
            </div>)}
        </div>
        <img className={styles.gachaFrame} src={frameSrc} alt=""/>
      </div>
      <div className={styles.nameGroup}>
        <FitText text={project.name || 'Untitled'} className={styles.name} baseSize={18} minSize={10}/>
        {project.character_name && project.character_name !== project.name && (<FitText text={project.character_name} className={styles.characterName} baseSize={20} minSize={9}/>)}
      </div>
    </button>);
}
