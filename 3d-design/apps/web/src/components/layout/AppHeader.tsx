import { NavLink } from 'react-router';
import { useFormat, useT } from '../../i18n';
import { usePrefs } from '../../stores/prefs';
import { useSession } from '../../stores/session';
import { IconButton, cx } from '../ui';

function Mark() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true">
      <ellipse
        cx="16"
        cy="23"
        rx="11"
        ry="3.5"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
      />
      <path d="M16 5l7 4v8l-7 4-7-4V9z" fill="var(--text)" />
      <path d="M16 13v8M9 9l7 4 7-4" fill="none" stroke="var(--surface)" strokeWidth="1.5" />
    </svg>
  );
}

export function AppHeader() {
  const t = useT();
  const f = useFormat();
  const credits = useSession((s) => s.credits);
  const { theme, setTheme, locale, setLocale } = usePrefs();
  const link = ({ isActive }: { isActive: boolean }) =>
    cx(
      'inline-flex min-h-5 items-center rounded-control px-1 text-small font-medium',
      isActive ? 'text-text bg-surface-2' : 'text-muted hover:text-text',
    );
  return (
    <header className="relative flex h-7 shrink-0 items-center gap-1 border-b border-line bg-surface px-1 sm:gap-2 sm:px-2 z-(--z-header)">
      <NavLink
        to="/"
        className="flex items-center gap-1 rounded-control text-small font-semibold"
        aria-label={t('app.name')}
      >
        <Mark />
        <span className="hidden sm:inline">{t('app.name')}</span>
      </NavLink>
      <nav aria-label={t('nav.menu')} className="flex gap-0.5">
        <NavLink to="/create" className={link}>
          {t('nav.create')}
        </NavLink>
        <NavLink to="/library" className={link}>
          {t('nav.library')}
        </NavLink>
      </nav>
      <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
        {/* The balance is always visible: every paid action is priced against it. */}
        <span
          className="num inline-flex min-h-4 items-center rounded-pill border border-line px-1 text-caption sm:text-small"
          aria-label={credits === null ? undefined : t('credits.label', { n: credits })}
          aria-live="polite"
        >
          {credits === null ? '—' : t('credits.balance', { n: f.int(credits) })}
        </span>
        <button
          type="button"
          onClick={() => setLocale(locale === 'th' ? 'en' : 'th')}
          aria-label={t('prefs.locale.label')}
          lang={locale === 'th' ? 'en' : 'th'}
          className="inline-flex min-h-5 items-center rounded-control px-1 text-small text-muted hover:text-text"
        >
          {t('prefs.locale.switch')}
        </button>
        <IconButton
          icon={theme === 'dark' ? 'sun' : 'moon'}
          label={theme === 'dark' ? t('prefs.theme.toLight') : t('prefs.theme.toDark')}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        />
      </div>
    </header>
  );
}

export function AppFooter() {
  const t = useT();
  return (
    <footer className="border-t border-line px-2 py-2 text-caption text-muted">
      <nav aria-label={t('nav.terms')} className="mx-auto flex max-w-[1200px] flex-wrap gap-2">
        <NavLink to="/terms" className="hover:text-text">
          {t('nav.terms')}
        </NavLink>
        <NavLink to="/privacy" className="hover:text-text">
          {t('nav.privacy')}
        </NavLink>
      </nav>
    </footer>
  );
}
