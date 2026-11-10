import { useLocale } from '../i18n';
import { PRIVACY, TERMS } from '../content/legal';
import { AppFooter } from '../components/layout/AppHeader';

export default function Legal({ doc }: { doc: 'terms' | 'privacy' }) {
  const locale = useLocale();
  const d = (doc === 'terms' ? TERMS : PRIVACY)[locale];
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <article className="mx-auto w-full max-w-prose flex-1 px-2 py-4">
        <h1 className="text-h1 font-semibold">{d.title}</h1>
        <p className="text-caption text-muted">{d.updated}</p>
        {d.sections.map((s) => (
          <section key={s.heading} className="mt-3">
            <h2 className="text-h2 font-semibold">{s.heading}</h2>
            <ul className="mt-1 flex list-disc flex-col gap-1 pl-3 text-body">
              {s.body.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
        ))}
      </article>
      <AppFooter />
    </div>
  );
}
