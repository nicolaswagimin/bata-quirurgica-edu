import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  type RouteComponent,
  redirect,
} from '@tanstack/react-router';
import { z } from 'zod';
import { ComingSoon } from './components/coming-soon.tsx';
import { RequireAdmin } from './components/require-admin.tsx';
import { RequireAuth } from './components/require-auth.tsx';
import { RootLayout } from './components/root-layout.tsx';
import { auth } from './lib/firebase.tsx';
import { LoginPage, PrivacidadPage, RegistroPage } from './routes/public-pages.tsx';

// Feature pages are `src/routes/<name>.tsx` with a default export; a missing file renders
// "Próximamente", so adding a page never requires editing this router.
const pages = import.meta.glob<{ default: RouteComponent }>([
  './routes/*.tsx',
  '!./routes/public-pages.tsx',
]);

function page(name: string, title: string): RouteComponent {
  const loader = pages[`./routes/${name}.tsx`];
  return loader ? lazyRouteComponent(loader) : () => <ComingSoon title={title} />;
}

const rootRoute = createRootRoute({ component: RootLayout });

// ---------- Públicas ----------

const LoginSearchSchema = z.object({ redirect: z.string().optional().catch(undefined) });

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: (search) => LoginSearchSchema.parse(search),
  component: LoginPage,
});
const registroRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/registro',
  component: RegistroPage,
});
const privacidadRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/privacidad',
  component: PrivacidadPage,
});
const creditosRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/creditos',
  component: page('creditos', 'Créditos'),
});

// ---------- Con sesión ----------

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'auth',
  beforeLoad: async ({ location }) => {
    await auth.authStateReady();
    if (!auth.currentUser) {
      throw redirect({ to: '/login', search: { redirect: location.href }, replace: true });
    }
  },
  component: RequireAuth,
});

const userRoutes = [
  createRoute({ getParentRoute: () => authRoute, path: '/', component: page('home', 'Inicio') }),
  createRoute({
    getParentRoute: () => authRoute,
    path: '/mision/$missionId',
    component: page('mision', 'Misión'),
  }),
  createRoute({
    getParentRoute: () => authRoute,
    path: '/ranking',
    component: page('ranking', 'Ranking'),
  }),
  createRoute({
    getParentRoute: () => authRoute,
    path: '/perfil',
    component: page('perfil', 'Perfil'),
  }),
  createRoute({
    getParentRoute: () => authRoute,
    path: '/bata-3d',
    component: page('bata-3d', 'Bata en 3D'),
  }),
  createRoute({
    getParentRoute: () => authRoute,
    path: '/bata-ar',
    component: page('bata-ar', 'AR espejo'),
  }),
  createRoute({
    getParentRoute: () => authRoute,
    path: '/bata-espacio',
    component: page('bata-espacio', 'Ver en tu espacio'),
  }),
] as const;

// ---------- Administración ----------

const adminRoute = createRoute({
  getParentRoute: () => authRoute,
  id: 'admin',
  component: RequireAdmin,
});

const adminRoutes = [
  createRoute({
    getParentRoute: () => adminRoute,
    path: '/admin/preguntas',
    component: page('admin-preguntas', 'Banco de preguntas'),
  }),
  createRoute({
    getParentRoute: () => adminRoute,
    path: '/admin/grupos',
    component: page('admin-grupos', 'Grupos'),
  }),
] as const;

const routeTree = rootRoute.addChildren([
  loginRoute,
  registroRoute,
  privacidadRoute,
  creditosRoute,
  authRoute.addChildren([...userRoutes, adminRoute.addChildren([...adminRoutes])]),
]);

export const router = createRouter({
  routeTree,
  defaultNotFoundComponent: () => <ComingSoon title="Página no encontrada" />,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
