import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { getAccessToken } from './api';

// Lazy-load all pages — only one is needed at a time
const Login      = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Dashboard  = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Components = lazy(() => import('./pages/Components').then(m => ({ default: m.Components })));
const BulkImport = lazy(() => import('./pages/BulkImport').then(m => ({ default: m.BulkImport })));
const Retailers  = lazy(() => import('./pages/Retailers').then(m => ({ default: m.Retailers })));
const Scrapers   = lazy(() => import('./pages/Scrapers').then(m => ({ default: m.Scrapers })));
const Unmatched  = lazy(() => import('./pages/Unmatched').then(m => ({ default: m.Unmatched })));
const Presets    = lazy(() => import('./pages/Presets').then(m => ({ default: m.Presets })));

function RequireAuth({ children }: { children: React.ReactNode }) {
  // Simple guard — if no token in memory, redirect to login.
  // On page refresh the token is lost; tryRefresh() in api.ts handles re-auth via cookie.
  if (!getAccessToken()) {
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: '#cdd6f4' }}>Loading...</div>}>
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
          <Route path="dashboard"  element={<Dashboard />} />
          <Route path="components" element={<Components />} />
          <Route path="components/import" element={<BulkImport />} />
          <Route path="retailers"  element={<Retailers />} />
          <Route path="scrapers"   element={<Scrapers />} />
          <Route path="unmatched"  element={<Unmatched />} />
          <Route path="presets"    element={<Presets />} />
        </Route>

        <Route path="*" element={<Navigate to="/admin/login" replace />} />
      </Routes>
    </Suspense>
  );
}
