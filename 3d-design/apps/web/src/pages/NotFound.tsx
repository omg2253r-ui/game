import { Link } from 'react-router';
import { useT } from '../i18n';

export default function NotFound() {
  const t = useT();
  return (
    <div className="mx-auto flex max-w-[60ch] flex-col items-start gap-2 p-4">
      <h1 className="text-h1 font-semibold">{t('notFound.title')}</h1>
      <p className="text-muted">{t('notFound.body')}</p>
      <Link
        to="/create"
        className="inline-flex min-h-5 items-center rounded-control bg-accent px-2 text-small font-semibold text-on-accent"
      >
        {t('notFound.back')}
      </Link>
    </div>
  );
}
