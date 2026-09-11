import { Modal } from './Modal';
import { Button } from './Button';
import { ASSET_NOTICE, CURRENT_VERSION, HEADLINE, RELEASES, markReleaseSeen, } from '../../lib/whatsNew';
import styles from './WhatsNewModal.module.css';
interface WhatsNewModalProps {
    open: boolean;
    onClose: () => void;
}
const X_PATH = 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z';
const KOFI_PATH = 'M11.351 2.715c-2.7 0-4.986.025-6.83.26C2.078 3.285 0 5.154 0 8.61c0 3.506.182 6.13 1.585 8.493 1.584 2.701 4.233 4.182 7.662 4.182h.83c4.209 0 6.494-2.234 7.637-4a9.5 9.5 0 0 0 1.091-2.338C21.792 14.688 24 12.22 24 9.208v-.415c0-3.247-2.13-5.507-5.792-5.87-1.558-.156-2.65-.208-6.857-.208m0 1.947c4.208 0 5.09.052 6.571.182 2.624.311 4.13 1.584 4.13 4v.39c0 2.156-1.792 3.844-3.87 3.844h-.935l-.156.649c-.208 1.013-.597 1.818-1.039 2.546-.909 1.428-2.545 3.064-5.922 3.064h-.805c-2.571 0-4.831-.883-6.078-3.195-1.09-2-1.298-4.155-1.298-7.506 0-2.181.857-3.402 3.012-3.714 1.533-.233 3.559-.26 6.39-.26m6.547 2.287c-.416 0-.65.234-.65.546v2.935c0 .311.234.545.65.545 1.324 0 2.051-.754 2.051-2s-.727-2.026-2.052-2.026m-10.39.182c-1.818 0-3.013 1.48-3.013 3.142 0 1.533.858 2.857 1.949 3.897.727.701 1.87 1.429 2.649 1.896a1.47 1.47 0 0 0 1.507 0c.78-.467 1.922-1.195 2.623-1.896 1.117-1.039 1.974-2.364 1.974-3.897 0-1.662-1.247-3.142-3.039-3.142-1.065 0-1.792.545-2.338 1.298-.493-.753-1.246-1.298-2.312-1.298';
function BrandIcon({ path }: {
    path: string;
}) {
    return (<svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={path} fill="currentColor"/>
    </svg>);
}
export function WhatsNewModal({ open, onClose }: WhatsNewModalProps) {
    const close = () => {
        markReleaseSeen(CURRENT_VERSION);
        onClose();
    };
    return (<Modal title="What's New" open={open} onClose={close} wide footer={<div className={styles.footerRow}>
          <div className={styles.socials}>
            <a className={styles.social} href="https://x.com/nyrrineross" target="_blank" rel="noopener noreferrer" title="Nyrrine on X" aria-label="Nyrrine on X">
              <BrandIcon path={X_PATH}/>
            </a>
            <a className={`${styles.social} ${styles.kofi}`} href="https://ko-fi.com/nyrrine" target="_blank" rel="noopener noreferrer" title="Support the wiki on Ko-fi" aria-label="Support the wiki on Ko-fi">
              <BrandIcon path={KOFI_PATH}/>
            </a>
          </div>
          <p className={styles.fineprint}>
            Anything through Ko-fi goes to running and building this wiki. It is
            not connected to Memoir itself, and Memoir, the game, is not taking
            donations.
          </p>
          <Button variant="primary" onClick={close}>Got it</Button>
        </div>}>
      
      <div className={styles.sheet}>
        <div className={styles.texture} aria-hidden="true"/>
        <div className={styles.content}>
          
          <p className={styles.notice}>{ASSET_NOTICE}</p>

          <div className={styles.hero}>
            <img className={styles.art} src="/ui/whats-new-art.webp" alt="" width={230} height={224}/>
            <div className={styles.heroText}>
              <h3 className={styles.headline}>{HEADLINE}</h3>
              <span className={styles.stamp}>
                v{RELEASES[0].version}
                <span className={styles.dot}>&middot;</span>
                {RELEASES[0].date}
              </span>
            </div>
          </div>

          <div className={styles.columns}>
            {RELEASES.map((release) => (<section key={release.version} className={styles.column}>
                <h4 className={styles.columnTitle}>{release.label}</h4>
                <ul className={styles.items}>
                  {release.items.map((item, i) => (<li key={i} className={styles.item}>{item}</li>))}
                </ul>
              </section>))}
          </div>
        </div>
      </div>
    </Modal>);
}
