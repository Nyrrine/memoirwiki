import type { Descendant } from 'slate';
import type { Skill } from '../../types/project';
import { sinColor } from '../../lib/sinHelpers';
import { frameBorderPath, frameMaskPath, resolveSlot } from '../../lib/skillFrames';
import { CardRichText } from './CardRichText';
import { SkillCoinIcon } from './SkillCoinIcon';
import styles from './CardSkillPanel.module.css';
function isSlateEmpty(content: Descendant[]): boolean {
    for (const node of content) {
        if ('text' in node) {
            if (node.text.trim())
                return false;
        }
        else {
            if (node.type === 'token' || node.type === 'keyword')
                return false;
            if ('children' in node && !isSlateEmpty(node.children as Descendant[]))
                return false;
        }
    }
    return true;
}
interface CardSkillPanelProps {
    skill: Skill;
    index: number;
}
function atkWeightTriangles(weight: number): string {
    if (weight >= 8)
        return '\u2BC0'.repeat(7) + '+';
    return '\u2BC0'.repeat(Math.max(weight, 0));
}
export function CardSkillPanel({ skill, index }: CardSkillPanelProps) {
    const slot = resolveSlot(skill.skillSlot, index);
    const maskUrl = frameMaskPath(slot);
    const coins = Array.from({ length: skill.coinCount }, (_, i) => i);
    const totalPower = skill.basePower + skill.coinPower * skill.coinCount;
    const label = skill.skillLabel || `Skill ${index + 1}`;
    return (<div className={styles.panel}>
      
      <div className={styles.frameColumn}>
        <div className={styles.frameStack}>
          <div className={styles.skillArt}>
            
            <div className={styles.skillArtMask} style={{
            maskImage: `url(${maskUrl})`,
            WebkitMaskImage: `url(${maskUrl})`,
        }}>
              {skill.skillIconUrl ? (<img src={skill.skillIconUrl} alt="" className={styles.skillArtImg}/>) : (<div className={styles.skillArtPlaceholder} style={{ backgroundColor: sinColor(skill.sinType), opacity: 0.15 }}/>)}
            </div>
            
            <img src={frameBorderPath(skill.sinType, slot)} alt="" className={styles.skillFrameOverlay}/>
          </div>
          
          <div className={styles.powerBar}>
            <span className={styles.powerText}>
              {skill.basePower} + {skill.coinPower}&times;{skill.coinCount} = {totalPower}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.descColumn}>
        
        <div className={styles.skillHeader}>
          
          <img className={styles.sinIcon} src={`/icons/sins/${skill.sinType}.png`} alt={skill.sinType}/>

          <div className={styles.headerInfo}>
            
            <div className={styles.coinRow}>
              {coins.map((i) => {
            const ce = skill.coinEffects[i];
            const coinSrc = ce?.coinType === 'custom' && ce?.coinIconUrl
                ? ce.coinIconUrl
                : ce?.coinType === 'excision'
                    ? '/icons/coins/coin_excision.webp'
                    : ce?.coinType === 'unbreakable'
                        ? '/icons/coins/coin_unbreakable.png'
                        : '/icons/coins/coin.png';
            return (<img key={i} className={styles.goldCoin} src={coinSrc} alt=""/>);
        })}
            </div>
            
            {skill.name ? (<span className={styles.skillName} style={{ '--banner-color': sinColor(skill.sinType) } as React.CSSProperties}>
                {skill.name}
              </span>) : null}
            
            <div className={styles.statRow}>
              <span className={styles.offenseBadge}>
                <img className={styles.olIcon} src="/icons/stats/offense-level.webp" alt=""/>
                {skill.offenseLevel}
              </span>
              {skill.atkWeight > 0 && (<span className={styles.atkWeight}>{atkWeightTriangles(skill.atkWeight)}</span>)}
            </div>
          </div>
        </div>

        {skill.skillEffect.length > 0 && (<div className={styles.effectBlock}>
            <CardRichText content={skill.skillEffect}/>
          </div>)}

        {skill.coinEffects.length > 0 && (() => {
            const visibleCoinEffects = skill.coinEffects.filter((ce) => !(ce.coinType === 'normal' && isSlateEmpty(ce.description)));
            return visibleCoinEffects.length > 0 ? (<div className={styles.coinEffects}>
            {visibleCoinEffects.map((ce) => (<div key={ce.coinIndex} className={styles.coinEffect}>
                {ce.coinType !== 'normal' && (<span className={styles.coinTypeLabel} style={{
                            color: ce.coinType === 'unbreakable' ? 'var(--sin-wrath)'
                                : ce.coinType === 'excision' ? 'var(--sin-gluttony)'
                                    : 'var(--text-secondary)',
                        }}>
                    {ce.coinType === 'unbreakable' ? 'Unbreakable Coin'
                            : ce.coinType === 'excision' ? 'Excision Coin'
                                : ce.coinLabel || 'Custom Coin'}
                  </span>)}
                <div className={styles.coinEffectRow}>
                  <SkillCoinIcon number={ce.coinIndex + 1} size={20}/>
                  <div className={styles.coinEffectText}>
                    <CardRichText content={ce.description}/>
                  </div>
                </div>
              </div>))}
          </div>) : null;
        })()}
      </div>

      <span className={styles.skillLabel}>{label}</span>
    </div>);
}
