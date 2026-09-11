import type { ProjectData } from '../../types/project';
import { CardLeftPanel } from './CardLeftPanel';
import { CardSkillPanel } from './CardSkillPanel';
import { CardPassivePanel } from './CardPassivePanel';
import styles from './CardPage.module.css';
interface CardPageProps {
    data: ProjectData;
    pageIndex: number;
    totalPages: number;
    leftTab: 'info' | 'sanity';
    onTabChange?: (tab: 'info' | 'sanity') => void;
    layout?: 'paged' | 'single';
}
export function CardPage({ data, pageIndex, totalPages, leftTab, onTabChange, layout = 'paged' }: CardPageProps) {
    const isSingle = layout === 'single';
    const hasSkills = data.skills.length > 0;
    const hasDefense = data.defenseSkills.length > 0;
    const hasCombatPassives = data.combatPassives.length > 0;
    const hasSupportPassives = data.supportPassives.length > 0;
    const hasCustomEffects = data.customEffects.length > 0;
    const hasAnyContent = hasSkills || hasDefense || hasCombatPassives || hasSupportPassives || hasCustomEffects;
    return (<div className={isSingle ? styles.pageSingle : styles.page} data-page={pageIndex}>
      
      <div className={styles.noise}/>

      <div className={isSingle ? styles.columnsSingle : styles.columns}>
        
        <CardLeftPanel data={data} activeTab={leftTab} onTabChange={onTabChange} layout={layout}/>

        <div className={`${styles.rightColumn} ${isSingle ? styles.rightColumnSingle : ''}`}>
          
          {data.rightColumnBgUrl && (<div className={styles.rightColumnBg} style={{
                backgroundImage: `url(${data.rightColumnBgUrl})`,
                opacity: data.rightColumnBgOpacity ?? 0.15,
            }}/>)}

          <div className={styles.cautionBorderTop} style={{ backgroundColor: data.cautionColor || '#6b5c40' }}/>

          {!hasAnyContent && (<div className={styles.emptyState}>
              <span className={styles.emptyText}>Add entries in the sidebar</span>
            </div>)}

          {hasSkills && (<div className={styles.section} data-export-section="skills">
              <div className={styles.sectionLabel} data-export-item="header-skills">
                <span className={styles.sectionLabelText}>SKILLS</span>
                <div className={styles.sectionLabelLine}/>
              </div>
              {data.skills.map((skill, i) => (<div key={skill.id} data-export-item={`skill-${i}`} data-export-type="skill">
                  <CardSkillPanel skill={skill} index={i}/>
                </div>))}
            </div>)}

          {hasDefense && (<div className={styles.section} data-export-section="defense">
              <div className={styles.sectionLabel} data-export-item="header-defense">
                <span className={styles.sectionLabelText}>DEFENSE</span>
                <div className={styles.sectionLabelLine}/>
              </div>
              {data.defenseSkills.map((def, i) => (<div key={def.id} data-export-item={`defense-${i}`} data-export-type="defense">
                  <CardSkillPanel skill={def} index={i}/>
                </div>))}
            </div>)}

          {hasCombatPassives && (<div className={styles.section} data-export-section="combatPassives">
              <div className={styles.sectionLabel} data-export-item="header-combatPassives">
                <span className={styles.sectionLabelText}>COMBAT PASSIVES</span>
                <div className={styles.sectionLabelLine}/>
              </div>
              {data.combatPassives.map((p, i) => (<div key={p.id} data-export-item={`combatPassive-${i}`} data-export-type="combatPassive">
                  <CardPassivePanel passive={p} type="combat" index={i}/>
                </div>))}
            </div>)}

          {hasSupportPassives && (<div className={styles.section} data-export-section="supportPassives">
              <div className={styles.sectionLabel} data-export-item="header-supportPassives">
                <span className={styles.sectionLabelText}>SUPPORT PASSIVES</span>
                <div className={styles.sectionLabelLine}/>
              </div>
              {data.supportPassives.map((p, i) => (<div key={p.id} data-export-item={`supportPassive-${i}`} data-export-type="supportPassive">
                  <CardPassivePanel passive={p} type="support" index={i}/>
                </div>))}
            </div>)}

          {hasCustomEffects && (<div className={styles.section} data-export-section="customEffects">
              <div className={styles.sectionLabel} data-export-item="header-customEffects">
                <span className={styles.sectionLabelText}>CUSTOM</span>
                <div className={styles.sectionLabelLine}/>
              </div>
              {data.customEffects.map((p, i) => (<div key={p.id} data-export-item={`customEffect-${i}`} data-export-type="customEffect">
                  <CardPassivePanel passive={p} type="custom" index={i}/>
                </div>))}
            </div>)}

          <div className={styles.stampWatermark}>
            <img className={styles.stampImage} src="/ui/stamp.png" alt=""/>
          </div>

          <div className={styles.cautionBorderBottom} style={{ backgroundColor: data.cautionColor || '#6b5c40' }}/>
        </div>
      </div>

      {!isSingle && totalPages > 1 && (<div className={styles.pageIndicator}>
          {pageIndex + 1} / {totalPages}
        </div>)}

    </div>);
}
