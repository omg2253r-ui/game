import { lazy, Suspense, useState } from 'react';
import { useNavigate } from 'react-router';
import { useT } from '../i18n';
import { useStudio } from '../stores/studio';
import { AppFooter } from '../components/layout/AppHeader';
import { TEMPLATES } from '../components/studio/templates';
import { Button, Field, Textarea } from '../components/ui';

const Viewer = lazy(() => import('../components/viewer/Viewer'));

export default function Home() {
  const t = useT();
  const navigate = useNavigate();
  const setForm = useStudio((s) => s.setForm);
  const [prompt, setPrompt] = useState('');

  const start = (text: string, extra?: Partial<Parameters<typeof setForm>[0]>) => {
    setForm({ prompt: text, ...extra });
    navigate('/create');
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="enter flex flex-col justify-center gap-3 px-2 py-4 sm:px-4 lg:py-6">
          <h1 className="max-w-[20ch] text-h1 font-semibold sm:text-display">{t('home.title')}</h1>
          <p className="max-w-prose text-body text-muted">{t('home.lede')}</p>
          <form
            className="flex max-w-[560px] flex-col gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              start(prompt.trim());
            }}
          >
            <Field label={t('home.promptLabel')}>
              {({ id }) => (
                <Textarea
                  id={id}
                  rows={3}
                  value={prompt}
                  maxLength={600}
                  placeholder={t('home.promptPlaceholder')}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              )}
            </Field>
            <div className="flex flex-wrap items-center gap-1">
              <Button type="submit" variant="primary">
                {t('home.start')}
              </Button>
              <span className="text-small text-muted">{t('home.tryTemplates')}</span>
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => start(t(tpl.prompt), { style: tpl.style, quality: tpl.quality })}
                  className="min-h-4 rounded-pill border border-line px-1 text-small hover:border-line-strong"
                >
                  {t(tpl.label)}
                </button>
              ))}
            </div>
          </form>
        </section>
        <figure className="enter-late m-0 flex min-h-[360px] flex-col lg:min-h-0">
          <div className="min-h-0 flex-1">
            <Suspense fallback={<div className="h-full bg-viewer" />}>
              <Viewer
                url="/samples/magic-sword.glb"
                measure
                toolbar="minimal"
                label={t('home.sampleCaption')}
              />
            </Suspense>
          </div>
          <figcaption className="border-t border-line bg-surface px-2 py-1 text-caption text-muted">
            {t('home.sampleCaption')}
          </figcaption>
        </figure>
      </div>
      <section
        aria-labelledby="steps"
        className="border-t border-line bg-surface px-2 py-3 sm:px-4"
      >
        <h2 id="steps" className="sr-only">
          {t('home.steps')}
        </h2>
        <ol className="mx-auto grid max-w-[1200px] gap-3 sm:grid-cols-3">
          {([1, 2, 3] as const).map((n) => (
            <li key={n} className="flex gap-1.5">
              <span className="num mt-0.5 inline-flex size-3 shrink-0 items-center justify-center rounded-pill border border-line-strong text-caption">
                {n}
              </span>
              <div>
                <h3 className="text-small font-semibold">{t(`home.step${n}.title`)}</h3>
                <p className="max-w-prose text-small text-muted">{t(`home.step${n}.body`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <AppFooter />
    </div>
  );
}
