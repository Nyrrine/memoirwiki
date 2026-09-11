import styles from './CardPortrait.module.css';
interface CardPortraitProps {
    portraitUrl: string | null;
}
export function CardPortrait({ portraitUrl }: CardPortraitProps) {
    return (<div className={styles.portrait}>
      {portraitUrl ? (<img src={portraitUrl} alt="Character portrait" className={styles.image}/>) : (<div className={styles.placeholder}>
          <svg className={styles.silhouette} width="120" height="120" viewBox="0 0 120 120" fill="none">
            <circle cx="60" cy="40" r="22" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
            <ellipse cx="60" cy="110" rx="40" ry="36" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
          </svg>
          <span className={styles.placeholderText}>PORTRAIT</span>
        </div>)}
      
      <div className={styles.bottomFade}/>
      
      <div className={styles.goldDivider}/>
    </div>);
}
