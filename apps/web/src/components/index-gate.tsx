import type { RouteComponent } from '@tanstack/react-router';
import { Suspense } from 'react';
import { useAuth } from '../lib/firebase.tsx';
import { LoadingState } from './loading-state.tsx';

type IndexGateProps = {
  HomePage: RouteComponent;
  LandingPage: RouteComponent;
};

export function IndexGate({ HomePage, LandingPage }: IndexGateProps) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState />;

  return <Suspense fallback={<LoadingState />}>{user ? <HomePage /> : <LandingPage />}</Suspense>;
}
