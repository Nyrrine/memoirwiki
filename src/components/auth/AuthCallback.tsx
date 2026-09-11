import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import styles from './LoginPage.module.css';
export function AuthCallback() {
    const navigate = useNavigate();
    const refreshProfile = useAuth((s) => s.refreshProfile);
    const initialize = useAuth((s) => s.initialize);
    const [status, setStatus] = useState('Signing in...');
    const ran = useRef(false);
    useEffect(() => {
        if (ran.current)
            return;
        ran.current = true;
        (async () => {
            await initialize();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                navigate('/', { replace: true });
                return;
            }
            if (session.provider_token) {
                setStatus('Checking server membership...');
                try {
                    const res = await fetch('/api/auth/guild-check', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${session.access_token}`,
                        },
                        body: JSON.stringify({ providerToken: session.provider_token }),
                    });
                    if (res.ok) {
                        const { promoted } = (await res.json()) as {
                            promoted?: boolean;
                        };
                        if (promoted)
                            await refreshProfile();
                    }
                }
                catch {
                }
            }
            await refreshProfile();
            navigate('/', { replace: true });
        })();
    }, [initialize, refreshProfile, navigate]);
    return (<div className={styles.page}>
      <div className={styles.overlay}/>
      <div className={styles.container}>
        <div className={styles.logoSection}>
          <img className={styles.logo} src="/ui/limbus-logo.webp" alt="Limbus Company"/>
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>Memoir</h1>
            <p className={styles.subtitle}>{status}</p>
          </div>
        </div>
      </div>
    </div>);
}
