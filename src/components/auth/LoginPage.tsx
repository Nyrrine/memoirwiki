import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import styles from './LoginPage.module.css';
export function LoginPage() {
    const navigate = useNavigate();
    const signInWithDiscord = useAuth((s) => s.signInWithDiscord);
    const loading = useAuth((s) => s.loading);
    const error = useAuth((s) => s.error);
    return (<div className={styles.page}>
      <div className={styles.overlay}/>
      <div className={styles.container}>
        <div className={styles.logoSection}>
          <img className={styles.logo} src="/ui/limbus-logo.webp" alt="Limbus Company"/>
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>Memoir</h1>
            <p className={styles.subtitle}>Wiki &amp; ToolKit</p>
          </div>
        </div>

        <div className={styles.divider}/>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.door}>
          <span className={styles.doorLabel}>ToolKit</span>
          <p className={styles.doorText}>Build identity cards and save them to your account.</p>
          <button className={styles.submitBtn} type="button" onClick={() => signInWithDiscord()} disabled={loading}>
            {loading ? 'Redirecting...' : 'Sign in with Discord'}
          </button>
        </div>

        <div className={styles.divider}/>

        <div className={styles.door}>
          <span className={styles.doorLabel}>Wiki</span>
          <p className={styles.doorText}>Server lore and character pages, open to everyone.</p>
          <button className={styles.wikiBtn} type="button" onClick={() => navigate('/wiki')}>
            Browse the Wiki
          </button>
        </div>

        <p className={styles.footer}>
          Discord server members can edit the wiki.
        </p>

        <a className={styles.discordLink} href="https://discord.gg/MfcFPDtjjE" target="_blank" rel="noopener noreferrer">
          <img className={styles.discordFaust} src="/ui/discord-faust.png" alt="Join our Discord"/>
          <span className={styles.discordText}>Not on the server yet?<br />Join the Discord!</span>
        </a>
      </div>
    </div>);
}
