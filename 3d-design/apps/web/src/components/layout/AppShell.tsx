import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useT } from '../../i18n';
import { useSession } from '../../stores/session';
import { Button, ErrorBoundary, Skeleton, Toaster } from '../ui';
import { AppHeader } from './AppHeader';

export function PageError({ reset }: { reset?: () => void }) {
  const t = useT();
  return (
    <div role="alert" className="mx-auto flex max-w-[60ch] flex-col items-start gap-2 p-4">
      <h1 className="text-h1 font-semibold">{t('error.title')}</h1>
      <p className="text-muted">{t('error.body')}</p>
      <Button
        variant="primary"
        onClick={() => {
          reset?.();
          location.reload();
        }}
      >
        {t('error.reload')}
      </Button>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-2 p-3" aria-busy="true">
      <Skeleton className="h-5 w-30" />
      <Skeleton className="h-3 w-60 max-w-full" />
      <Skeleton className="min-h-30 flex-1" />
    </div>
  );
}

export function AppShell() {
  const t = useT();
  const load = useSession((s) => s.load);
  const { pathname } = useLocation();
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className="flex h-full flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-1 focus:top-1 focus:rounded-control focus:bg-accent focus:px-2 focus:py-1 focus:text-on-accent z-(--z-toast)"
      >
        {t('app.skip')}
      </a>
      <AppHeader />
      <main id="main" tabIndex={-1} className="flex min-h-0 flex-1 flex-col outline-none">
        {/* One boundary per page: a crash in one route never blanks the header. */}
        <ErrorBoundary key={pathname} fallback={(reset) => <PageError reset={reset} />}>
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <Toaster />
    </div>
  );
}
