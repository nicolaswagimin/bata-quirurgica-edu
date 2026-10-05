import { Outlet } from '@tanstack/react-router';
import { useAuth } from '../lib/firebase.tsx';
import { LoadingState } from './loading-state.tsx';

// Cosmetic guard: the redirect to /login happens in the route's beforeLoad (router.tsx);
// the API authorizer and Firestore rules enforce access on the server.
export function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading || !user) return <LoadingState />;
  return <Outlet />;
}
