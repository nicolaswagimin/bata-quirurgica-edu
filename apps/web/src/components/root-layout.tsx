import { Link, Outlet, useNavigate } from '@tanstack/react-router';
import { useAuth } from '../lib/firebase.tsx';
import { AssistantSlot } from './assistant-slot.tsx';

const NAV_LINKS = [
  { to: '/', label: 'Inicio' },
  { to: '/ranking', label: 'Ranking' },
  { to: '/bata-3d', label: '3D' },
  { to: '/bata-ar', label: 'AR espejo' },
  { to: '/perfil', label: 'Perfil' },
] as const;

const navLinkClass =
  'inline-flex min-h-11 items-center rounded-pill px-3 text-sm font-medium text-ink hover:bg-primary-soft';

export function RootLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const onSignOut = async () => {
    await signOut();
    await navigate({ to: '/login' });
  };
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-ink">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-pill focus:bg-primary focus:px-4 focus:py-2 focus:text-bg"
      >
        Saltar al contenido
      </a>
      <AssistantSlot />
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <Link to="/" className="text-lg font-semibold text-primary">
            Bata Quirúrgica Edu
          </Link>
          <nav aria-label="Principal" className="ml-auto">
            <ul className="flex flex-wrap items-center gap-1">
              {user ? (
                <>
                  {NAV_LINKS.map((link) => (
                    <li key={link.to}>
                      <Link
                        to={link.to}
                        className={navLinkClass}
                        activeProps={{ className: 'bg-primary-soft', 'aria-current': 'page' }}
                        activeOptions={{ exact: link.to === '/' }}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <button type="button" onClick={() => void onSignOut()} className={navLinkClass}>
                      Cerrar sesión
                    </button>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <Link to="/login" className={navLinkClass}>
                      Ingresar
                    </Link>
                  </li>
                  <li>
                    <Link to="/registro" className={navLinkClass}>
                      Crear cuenta
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </nav>
        </div>
      </header>
      <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-4 px-4 py-4 text-sm text-muted">
          <Link to="/privacidad" className="underline hover:text-primary">
            Política de tratamiento de datos
          </Link>
          <Link to="/creditos" className="underline hover:text-primary">
            Créditos
          </Link>
        </div>
      </footer>
    </div>
  );
}
