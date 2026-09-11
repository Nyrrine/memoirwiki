import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthGuard, AuthInit } from './components/auth/AuthGuard';
import { AuthCallback } from './components/auth/AuthCallback';
import { EditorShell } from './components/layout/EditorShell';
const WikiHome = lazy(() => import('./components/wiki/WikiHome').then((m) => ({ default: m.WikiHome })));
const WikiPageView = lazy(() => import('./components/wiki/WikiPageView').then((m) => ({ default: m.WikiPageView })));
const WikiIdentityView = lazy(() => import('./components/wiki/WikiIdentityView').then((m) => ({ default: m.WikiIdentityView })));
const WikiBuilder = lazy(() => import('./components/wiki/WikiBuilder').then((m) => ({ default: m.WikiBuilder })));
const WikiIdentityBuilder = lazy(() => import('./components/wiki/WikiIdentityBuilder').then((m) => ({ default: m.WikiIdentityBuilder })));
const GuidePage = lazy(() => import('./components/wiki/GuidePage').then((m) => ({ default: m.GuidePage })));
const WikiAdmin = lazy(() => import('./components/wiki/admin/WikiAdmin').then((m) => ({ default: m.WikiAdmin })));
function App() {
    return (<BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />}/>

        <Route path="/wiki" element={<AuthInit><WikiHome /></AuthInit>}/>
        <Route path="/wiki/guide/user-guide" element={<AuthInit><GuidePage /></AuthInit>}/>
        <Route path="/wiki/guide/getting-started" element={<Navigate to="/wiki/guide/user-guide" replace/>}/>
        <Route path="/wiki/page/:slug" element={<AuthInit><WikiPageView /></AuthInit>}/>
        <Route path="/wiki/page/:slug/:identityId" element={<AuthInit><WikiIdentityView /></AuthInit>}/>

        <Route path="/" element={<Navigate to="/editor/new" replace/>}/>
        <Route path="/editor/:id" element={<AuthGuard><EditorShell /></AuthGuard>}/>
        <Route path="/wiki/edit/:pageId" element={<AuthGuard requireRole="editor"><WikiBuilder /></AuthGuard>}/>
        <Route path="/wiki/edit/:pageId/:identityId" element={<AuthGuard requireRole="editor"><WikiIdentityBuilder /></AuthGuard>}/>

        <Route path="/wiki/admin" element={<AuthGuard requireRole="moderator"><WikiAdmin /></AuthGuard>}/>
      </Routes>
      </Suspense>
    </BrowserRouter>);
}
function RouteFallback() {
    return (<div style={{
            position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: 'var(--app-bg)',
        }}>
      <img src="/ui/limbus-logo.webp" alt="" style={{ height: 40, opacity: 0.4 }}/>
    </div>);
}
export default App;
