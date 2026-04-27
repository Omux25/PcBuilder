import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Components } from './pages/Components';
import { BulkImport } from './pages/BulkImport';
import { Retailers } from './pages/Retailers';
import { Scrapers } from './pages/Scrapers';
import { Unmatched } from './pages/Unmatched';
import { Presets } from './pages/Presets';
import { getAccessToken } from './api';

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
  );
}
