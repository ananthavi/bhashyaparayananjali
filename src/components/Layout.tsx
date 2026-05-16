import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import clsx from 'clsx';
import { applyPrefsToHtml, usePrefs } from '@/state/store';

export function Layout(): JSX.Element {
  const prefs = usePrefs();
  const { pathname } = useLocation();

  useEffect(() => {
    applyPrefsToHtml(prefs);
  }, [prefs.theme, prefs.fontSize]);

  const isReader = pathname.startsWith('/read');

  return (
    <div className="min-h-full flex flex-col safe-top safe-bottom">
      {/*
        On the reader we don't render this generic chrome — the reader owns
        a single sticky toolbar with all controls (back / index / script /
        mic / settings) so the user always sees them while scrolling.
      */}
      {!isReader && (
      <header
        className={clsx(
          'sticky top-0 z-30 backdrop-blur border-b',
          'bg-[color:var(--bg)]/85',
        )}
        style={{
          borderColor: 'var(--rule)',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <div className="max-w-3xl mx-auto px-3 h-12 flex items-center gap-2">
          <Link
            to="/"
            className="font-semibold tracking-tight text-[color:var(--accent)] shrink-0"
            aria-label="Śaṅkara-bhāṣya-pārāyaṇāñjali — home"
          >
            {/* Narrow screens show the Om mark only; ≥sm shows the IAST title. */}
            <span className="sm:hidden text-xl leading-none">ॐ</span>
            <span className="hidden sm:inline iast-text">Pārāyaṇāñjali</span>
          </Link>
          <span
            aria-hidden
            className="mx-1 opacity-50 hidden md:inline"
            style={{ color: 'var(--muted)' }}
          >
            ·
          </span>
          <span className="text-xs opacity-70 hidden md:inline iast-text">
            Śaṅkara-bhāṣya
          </span>
          <div className="grow" />
          <nav className="flex items-center gap-0.5 text-sm">
            <NavTab to="/" label="Library" mobileLabel="Home" />
            <NavTab to="/search" label="Search" mobileLabel="Find" />
            <NavTab to="/bookmarks" label="Bookmarks" mobileLabel="Saved" />
            <NavTab to="/about" label="About" mobileLabel="Info" />
          </nav>
        </div>
      </header>
      )}
      <main
        className={clsx('flex-1', isReader ? 'pb-20' : 'py-4 px-3 max-w-3xl mx-auto w-full')}
      >
        <Outlet />
      </main>
      {!isReader && (
        <footer
          className="py-6 text-xs text-center opacity-70 px-4"
          style={{ color: 'var(--muted)' }}
        >
          Inspired by and based on{' '}
          <a
            href="https://advaitasharada.sringeri.net/"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Advaita Sharada
          </a>
          , Dakṣiṇāmnāya Śrī Śāradā Pīṭham, Śṛṅgerī.
        </footer>
      )}
    </div>
  );
}

function NavTab({
  to,
  label,
  mobileLabel,
}: {
  to: string;
  label: string;
  mobileLabel?: string;
}): JSX.Element {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        clsx(
          'px-2 sm:px-2.5 py-1.5 rounded-md transition-colors text-xs sm:text-sm whitespace-nowrap',
          isActive
            ? 'bg-[color:var(--surface-2)] text-[color:var(--accent)]'
            : 'hover:bg-[color:var(--surface-2)]',
        )
      }
    >
      <span className="sm:hidden">{mobileLabel ?? label}</span>
      <span className="hidden sm:inline">{label}</span>
    </NavLink>
  );
}
