import { Outlet } from '@tanstack/react-router';
import { useAuth } from '../lib/firebase.tsx';
import { LoadingState } from './loading-state.tsx';

// Cosmetic guard: /v1/admin/* checks the role claim on the server.
export function RequireAdmin() {
  const { role, loading } = useAuth();
  if (loading) return <LoadingState />;
  if (role !== 'admin') {
    return (
      <section className="mx-auto max-w-2xl rounded-card bg-surface p-8 text-center">
        <h1 className="text-xl font-semibold text-ink">Acceso restringido</h1>
        <p className="mt-2 text-muted">No tienes permiso para esta acción.</p>
      </section>
    );
  }
  return <Outlet />;
}
