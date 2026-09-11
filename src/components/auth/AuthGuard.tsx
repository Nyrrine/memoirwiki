import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { useAuth, roleAtLeast, type MemberRole } from '../../hooks/useAuth';
import { LoginPage } from './LoginPage';
interface AuthGuardProps {
    children: ReactNode;
    requireRole?: MemberRole;
}
export function AuthGuard({ children, requireRole }: AuthGuardProps) {
    const user = useAuth((s) => s.user);
    const profile = useAuth((s) => s.profile);
    const loading = useAuth((s) => s.loading);
    const initialize = useAuth((s) => s.initialize);
    useEffect(() => {
        initialize();
    }, [initialize]);
    if (loading) {
        return <LoadingScreen />;
    }
    if (!user) {
        return <LoginPage />;
    }
    if (requireRole && !roleAtLeast(profile?.role, requireRole)) {
        return <AccessDenied requireRole={requireRole}/>;
    }
    return <>{children}</>;
}
export function AuthInit({ children }: {
    children: ReactNode;
}) {
    const initialize = useAuth((s) => s.initialize);
    useEffect(() => {
        initialize();
    }, [initialize]);
    return <>{children}</>;
}
function AccessDenied({ requireRole }: {
    requireRole: MemberRole;
}) {
    return (<div style={screenStyle}>
      <img src="/ui/limbus-logo.webp" alt="Limbus Company" style={{ height: 40, opacity: 0.6 }}/>
      <div style={captionStyle}>
        {requireRole === 'editor'
            ? 'Editing requires server membership - join the Discord, then sign in again.'
            : `This area requires the ${requireRole} role.`}
      </div>
    </div>);
}
function LoadingScreen() {
    return (<div style={screenStyle}>
      <img src="/ui/limbus-logo.webp" alt="Limbus Company" style={{ height: 40, opacity: 0.6 }}/>
      <div style={{ ...captionStyle, opacity: 0.5 }}>Loading...</div>
    </div>);
}
const screenStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--app-bg)',
    gap: '16px',
};
const captionStyle: CSSProperties = {
    fontFamily: 'var(--font-display)',
    fontSize: '10px',
    color: 'var(--text-muted)',
    letterSpacing: '3px',
    textTransform: 'uppercase',
    textAlign: 'center',
    maxWidth: 420,
    lineHeight: 1.8,
};
