import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { getAccessToken, restoreSession } from './api';

// Lazy-load all pages — only one is needed at a time
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Components = lazy(() => import('./pages/Components').then(m => ({ default: m.Components })));
const BulkImport = lazy(() => import('./pages/BulkImport').then(m => ({ default: m.BulkImport })));
const Retailers = lazy(() => import('./pages/Retailers').then(m => ({ default: m.Retailers })));
const Scrapers = lazy(() => import('./pages/Scrapers').then(m => ({ default: m.Scrapers })));
const Unmatched = lazy(() => import('./pages/Unmatched').then(m => ({ default: m.Unmatched })));
const Presets = lazy(() => import('./pages/Presets').then(m => ({ default: m.Presets })));
const KeywordRules = lazy(() => import('./pages/KeywordRules').then(m => ({ default: m.KeywordRules })));

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!getAccessToken()) {
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  // On mount, try to restore the session from the httpOnly refresh-token cookie.
  // This prevents users from being kicked to /login on every page refresh.
  const [sessionRestored, setSessionRestored] = useState(false);

  useEffect(() => {
    restoreSession().finally(() => setSessionRestored(true));
  }, []);

  if (!sessionRestored) {
    return <div className="session-loading">Chargement...</div>;
  }

  return (
    <Suspense fallback={<div className="session-loading">Chargement...</div>}>
      <Routes>
        <Route path="/admin/login" element={<Login />} />

        <Route
          path="/admin"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="components" element={<Components />} />
          <Route path="components/import" element={<BulkImport />} />
          <Route path="retailers" element={<Retailers />} />
          <Route path="scrapers" element={<Scrapers />} />
          <Route path="unmatched" element={<Unmatched />} />
          <Route path="presets" element={<Presets />} />
          <Route path="keyword-rules" element={<KeywordRules />} />
        </Route>

        <Route path="*" element={<Navigate to="/admin/login" replace />} />
      </Routes>
    </Suspense>
  );
}
