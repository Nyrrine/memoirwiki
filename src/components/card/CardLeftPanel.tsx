import { useRef, useEffect } from 'react';
import type { ProjectData } from '../../types/project';
import { CardPortrait } from './CardPortrait';
import { CardStatsBar } from './CardStatsBar';
import { SinIcon } from './SinIcon';
import { MIRROR_WORLD_ICONS } from '../../lib/mirrorWorldIcons';
import styles from './CardLeftPanel.module.css';
import { traitLabel, traitStruck } from '../../types/project';
const IDENTITY_FONT_MAX = 28;
const IDENTITY_FONT_MIN = 14;
interface CardLeftPanelProps {
    data: ProjectData;
    activeTab: 'info' | 'sanity';
    onTabChange?: (tab: 'info' | 'sanity') => void;
    layout?: 'paged' | 'single';
}
export function CardLeftPanel({ data, activeTab, onTabChange, layout = 'paged' }: CardLeftPanelProps) {
    const isSingle = layout === 'single';
    const nameRef = useRef<HTMLHeadingElement>(null);
    useEffect(() => {
        const el = nameRef.current;
        if (!el)
            return;
        el.style.fontSize = `${IDENTITY_FONT_MAX}px`;
        if (el.scrollWidth > el.clientWidth) {
            const ratio = el.clientWidth / el.scrollWidth;
            const newSize = Math.max(Math.floor(IDENTITY_FONT_MAX * ratio), IDENTITY_FONT_MIN);
            el.style.fontSize = `${newSize}px`;
        }
    }, [data.identityName, activeTab]);
    return (<div className={styles.leftPanel}>
      
      <CardPortrait portraitUrl={data.portraitUrl}/>

      {!isSingle && (<div className={styles.tabBar}>
          <div className={`${styles.tab} ${activeTab === 'info' ? styles.tabActive : ''}`} onClick={onTabChange ? () => onTabChange('info') : undefined}>
            INFO
          </div>
          <div className={`${styles.tab} ${activeTab === 'sanity' ? styles.tabActive : ''}`} onClick={onTabChange ? () => onTabChange('sanity') : undefined}>
            SANITY
          </div>
        </div>)}

      <div className={styles.tabContent} style={data.infoBarBgColor ? { background: data.infoBarBgColor } : undefined}>
        {(isSingle || activeTab === 'info') && (<>
            
            <div className={styles.header}>
              <div className={styles.headerTop}>
                <div className={styles.headerIcons}>
                  {data.sinnerIconUrl ? (<img className={styles.sinnerIcon} src={data.sinnerIconUrl} alt={data.characterName}/>) : (<SinIcon sinType={data.sinAffinity} size="lg"/>)}
                  <img className={styles.uptieIcon} src={data.uptieLevel === 1 ? '/icons/uptie/uptie1.png' : `/icons/uptie/uptie${data.uptieLevel}.webp`} alt={`Uptie ${data.uptieLevel}`}/>
                </div>
                <div className={styles.levelBadge}>
                  <span className={styles.levelText}>Lv. {data.level}</span>
                </div>
              </div>
              <h1 ref={nameRef} className={styles.identityName}>{data.identityName || '\u00A0'}</h1>
              <div className={styles.characterRow}>
                <span className={styles.characterName}>{data.characterName || '\u00A0'}</span>
                <img className={styles.rarityIcon} src={`/icons/rarity/rarity-${data.rarity}.png`} alt={`Rarity ${data.rarity}`}/>
              </div>
            </div>

            <div className={styles.goldLine}/>

            <CardStatsBar stats={data.stats} bgColor={data.infoBarBgColor}/>

            {(data.traits.length > 0 || data.mirrorWorldIconUrl) && (<div className={styles.infoSection}>
                <div className={styles.infoLabel}>
                  <span className={styles.infoLabelText}>TRAITS</span>
                  <div className={styles.infoLabelLine}/>
                  {data.mirrorWorldIconUrl && (<span className={styles.infoLabelText}>MIRROR WORLD</span>)}
                </div>
                <div className={styles.traitsMirrorRow}>
                  <div className={styles.traitsColumn}>
                    {data.traits.map((tag, i) => (<span key={i} className={`${styles.traitTag} ${traitStruck(tag) ? styles.traitStruck : ''}`}>
                        {traitLabel(tag)}
                      </span>))}
                  </div>
                  {data.mirrorWorldIconUrl && (<div className={styles.mirrorColumn}>
                      <img className={styles.mirrorIcon} src={data.mirrorWorldIconUrl} alt="Mirror World"/>
                      <span className={styles.mirrorLabel}>
                        {data.mirrorWorldName ?? MIRROR_WORLD_ICONS.find((mw) => mw.path === data.mirrorWorldIconUrl)?.label ?? ''}
                      </span>
                    </div>)}
                </div>
              </div>)}
          </>)}

        {isSingle && <div className={styles.goldLine}/>}

        {(isSingle || activeTab === 'sanity') && (<div className={styles.sanityContent}>
            
            <div className={styles.sanitySection}>
              <div className={styles.sanitySectionLabel}>
                <span className={styles.sanitySectionLabelText}>PANIC TYPE</span>
                <div className={styles.sanitySectionLabelLine}/>
              </div>

              <div className={styles.sanityPanicCard}>
                {data.sanity.panicIconUrl && (<img className={styles.sanityPanicIcon} src={data.sanity.panicIconUrl} alt=""/>)}
                <div className={styles.sanityPanicInfo}>
                  <span className={styles.sanityPanicName} style={{ color: data.sanity.sanityTextColor || undefined }}>
                    {data.sanity.panicName || '\u00A0'}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.sanityDescRow}>
              <div className={styles.sanityDescBlock}>
                <span className={styles.sanityDescLabel}>Low Morale</span>
                <span className={styles.sanityDescText}>
                  {data.sanity.lowMoraleDesc || '\u00A0'}
                </span>
              </div>
              <div className={styles.sanityDescDivider}/>
              <div className={styles.sanityDescBlock}>
                <span className={styles.sanityDescLabel}>Panic</span>
                <span className={styles.sanityDescText}>
                  {data.sanity.panicDesc || '\u00A0'}
                </span>
              </div>
            </div>

            <div className={styles.sanitySectionLabel}>
              <span className={styles.sanitySectionLabelText}>FACTORS</span>
              <div className={styles.sanitySectionLabelLine}/>
            </div>

            <div className={styles.sanityFactorBox} data-factor="increasing">
              <div className={styles.sanityFactorHeader}>
                <img className={styles.sanityFactorIcon} src="/icons/status/sp_heal_efficiency.png" alt=""/>
                <span className={styles.sanityFactorLabel}>Increasing</span>
              </div>
              {data.sanity.factorsIncreasing.length > 0 ? (<ul className={styles.sanityFactorList}>
                  {data.sanity.factorsIncreasing.map((f, i) => (<li key={i} className={styles.sanityFactorItem}>{f}</li>))}
                </ul>) : (<span className={styles.sanityFactorEmpty}>&mdash;</span>)}
            </div>

            <div className={styles.sanityFactorBox} data-factor="decreasing">
              <div className={styles.sanityFactorHeader}>
                <img className={styles.sanityFactorIcon} src="/icons/status/sp_heal_efficiency_down.png" alt=""/>
                <span className={styles.sanityFactorLabel}>Decreasing</span>
              </div>
              {data.sanity.factorsDecreasing.length > 0 ? (<ul className={styles.sanityFactorList}>
                  {data.sanity.factorsDecreasing.map((f, i) => (<li key={i} className={styles.sanityFactorItem}>{f}</li>))}
                </ul>) : (<span className={styles.sanityFactorEmpty}>&mdash;</span>)}
            </div>
          </div>)}
      </div>

    </div>);
}
