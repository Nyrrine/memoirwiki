import { Link, useNavigate } from 'react-router-dom';
import { useAuth, roleAtLeast } from '../../hooks/useAuth';
import styles from './WikiLayout.module.css';
interface WikiLayoutProps {
    children: React.ReactNode;
    breadcrumbs?: {
        label: string;
        to?: string;
    }[];
    headerSearch?: React.ReactNode;
}
export function WikiLayout({ children, breadcrumbs, headerSearch }: WikiLayoutProps) {
    const navigate = useNavigate();
    const user = useAuth((s) => s.user);
    const profile = useAuth((s) => s.profile);
    const canModerate = roleAtLeast(profile?.role, 'moderator');
    return (<div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            <Link to="/editor/new" className={styles.logoLink}>
              <img className={styles.logoImg} src="/ui/limbus-logo.webp" alt="Limbus Company"/>
              <div className={styles.logoText}>
                <span className={styles.logoLine}>Memoir</span>
                <span className={styles.logoLine}>Wiki</span>
              </div>
            </Link>
            <div className={styles.headerDivider}/>
            {breadcrumbs && breadcrumbs.length > 0 && (<nav className={styles.breadcrumbs}>
                <Link to="/wiki" className={styles.crumbLink}>Wiki</Link>
                {breadcrumbs.map((crumb, i) => (<span key={i} className={styles.crumb}>
                    <span className={styles.crumbSep}>/</span>
                    {crumb.to ? (<Link to={crumb.to} className={styles.crumbLink}>{crumb.label}</Link>) : (<span className={styles.crumbCurrent}>{crumb.label}</span>)}
                  </span>))}
              </nav>)}
            {!breadcrumbs && (<span className={styles.crumbCurrent}>Wiki</span>)}
          </div>
          {headerSearch && <div className={styles.headerSearch}>{headerSearch}</div>}
          <div className={styles.headerRight}>
            {canModerate && (<Link to="/wiki/admin" className={styles.modLink}>Moderation</Link>)}
            <button type="button" className={styles.backBtn} onClick={() => navigate('/editor/new')}>
              {user ? 'Open ToolKit' : 'Sign in'}
            </button>
          </div>
        </div>
      </header>
      <main className={styles.content}>
        {children}
      </main>
    </div>);
}
