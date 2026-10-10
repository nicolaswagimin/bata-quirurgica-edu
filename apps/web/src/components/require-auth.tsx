import { Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { useAuth } from '../lib/firebase.tsx';
import { LoadingState } from './loading-state.tsx';

// Cosmetic guard: the redirect to /login happens in the route's beforeLoad (router.tsx);
// the API authorizer and Firestore rules enforce access on the server. The effect covers a
// sign-out while already inside (e.g. apiFetch after a second 401).
export function RequireAuth() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { href } = useLocation();
  // Last location seen with a session; the location changes while navigating away.
  const lastHref = useRef(href);
  if (user) lastHref.current = href;

  useEffect(() => {
    if (loading || user) return;
    void navigate({ to: '/login', search: { redirect: lastHref.current }, replace: true });
  }, [loading, user, navigate]);

  if (loading || !user) return <LoadingState />;
  return <Outlet />;
}
