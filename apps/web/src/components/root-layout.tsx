import { Link, Outlet } from '@tanstack/react-router';
import { useAuth } from '../lib/firebase.tsx';
import { AssistantSlot } from './assistant-slot.tsx';
import { Pictogram, type PictogramName } from './pictogram.tsx';

const NAV_LINKS = [
  { to: '/', label: 'Inicio', icon: 'home' },
  { to: '/ranking', label: 'Ranking', icon: 'rank' },
  { to: '/bata-3d', label: '3D', icon: 'cube' },
  { to: '/bata-ar', label: 'AR espejo', icon: 'mirror' },
  { to: '/perfil', label: 'Perfil', icon: 'user' },
] as const satisfies readonly { to: string; label: string; icon: PictogramName }[];

// One navigation landmark: a bottom tab bar in the thumb zone on phones, inline pills in the
// header from md up.
const tabClass =
  'pressable flex min-h-14 flex-col items-center justify-center gap-1 rounded-card px-1 text-xs font-bold text-muted ' +
  'md:min-h-11 md:flex-row md:gap-2 md:rounded-pill md:px-4 md:text-sm md:text-on-primary-muted ' +
  'md:hover:bg-primary-strong md:hover:text-bg';
const tabActiveClass = 'text-primary md:bg-primary-strong md:text-bg';
const publicLinkClass =
  'pressable inline-flex min-h-11 items-center rounded-pill px-3 text-sm font-bold whitespace-nowrap text-bg hover:bg-primary-strong md:px-4';

export function RootLayout() {
  const { user } = useAuth();
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip bg-bg text-ink">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:rounded-pill focus:bg-ink focus:px-4 focus:py-2 focus:text-bg"
      >
        Saltar al contenido
      </a>
      <AssistantSlot />
      <header className="on-primary bg-primary text-bg">
        {/* The assistant trigger is fixed top-left; signed-in headers reserve its slot. */}
        <div
          // Full-width row whose edges line up with the centred 72rem content column, while
          // never letting the brand slide under the fixed assistant trigger (min 10rem).
          className={`flex min-h-17 items-center gap-4 pr-4 md:pr-[max(2rem,calc(50vw-34rem))] ${
            user
              ? 'pl-40 md:pl-[max(10rem,calc(50vw-34rem))]'
              : 'pl-4 md:pl-[max(2rem,calc(50vw-34rem))]'
          }`}
        >
          <Link
            to="/"
            className={`inline-flex items-center gap-2 text-sm font-extrabold tracking-tight whitespace-nowrap md:ml-0 md:text-base ${user ? 'ml-auto' : ''}`}
          >
            <Pictogram name="gown" className="size-6" />
            Bata Quirúrgica Edu
          </Link>
          <nav
            aria-label="Principal"
            className={
              user
                ? 'fixed inset-x-0 bottom-0 z-40 border-t border-grid bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:static md:ml-auto md:border-0 md:bg-transparent md:pb-0 md:backdrop-blur-none'
                : 'ml-auto'
            }
          >
            {user ? (
              <ul className="grid grid-cols-5 gap-1 px-2 py-1 md:flex md:p-0">
                {NAV_LINKS.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className={tabClass}
                      activeProps={{ className: tabActiveClass, 'aria-current': 'page' }}
                      activeOptions={{ exact: link.to === '/' }}
                    >
                      <Pictogram name={link.icon} className="size-6 md:hidden" />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="flex items-center">
                {/* Below sm the login and sign-up cards already link to each other. */}
                <li className="hidden sm:block">
                  <Link to="/login" className={publicLinkClass}>
                    Ingresar
                  </Link>
                </li>
                <li>
                  <Link to="/registro" className={publicLinkClass}>
                    Crear cuenta
                  </Link>
                </li>
              </ul>
            )}
          </nav>
        </div>
      </header>
      <main
        id="contenido"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-8"
      >
        <Outlet />
      </main>
      <footer className={`border-t border-grid ${user ? 'pb-20 md:pb-0' : ''}`}>
        <div className="mx-auto flex max-w-6xl flex-wrap gap-4 px-4 py-4 text-sm text-muted md:px-8">
          <Link to="/privacidad" className="underline underline-offset-4 hover:text-primary">
            Política de tratamiento de datos
          </Link>
          <Link to="/creditos" className="underline underline-offset-4 hover:text-primary">
            Créditos
          </Link>
        </div>
      </footer>
    </div>
  );
}
