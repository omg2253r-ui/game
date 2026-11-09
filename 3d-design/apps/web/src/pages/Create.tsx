import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useT, type MessageKey } from '../i18n';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useMediaQuery } from '../lib/useReducedMotion';
import { usePrefs, type Lighting } from '../stores/prefs';
import { onJobFinished, selectBusy, useStudio } from '../stores/studio';
import { toast } from '../stores/toasts';
import Viewer from '../components/viewer/Viewer';
import { ExportPanel } from '../components/studio/ExportPanel';
import { InspectPanel } from '../components/studio/InspectPanel';
import { JobStatus } from '../components/studio/JobStatus';
import { PromptPanel } from '../components/studio/PromptPanel';
import { IconButton, Tabs } from '../components/ui';

type Tab = 'create' | 'inspect' | 'export';
const LIGHTS: Lighting[] = ['studio', 'outdoor', 'dramatic'];

export default function Create() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [tab, setTab] = useState<Tab>('create');
  const { job, model, modelError, wireframe, clay, measure, setViewer, openModel, setForm } =
    useStudio();
  const busy = useStudio(selectBusy);
  const { lighting, setLighting } = usePrefs();
  const [loadFailed, setLoadFailed] = useState(false);

  // The URL is the single source of truth for which model is open:
  // ?model=… → load it. Finished jobs and the library write the param; nothing
  // else calls openModel, so URL and store can never fight over it.
  const modelParam = params.get('model');
  useEffect(() => {
    if (modelParam && modelParam !== useStudio.getState().model?.id) void openModel(modelParam);
    setLoadFailed(false);
  }, [modelParam, openModel]);

  const showModel = useCallback(
    (id: string) =>
      setParams(
        (p) => {
          p.set('model', id);
          return p;
        },
        { replace: true },
      ),
    [setParams],
  );

  // ?prompt=… is a hand-off from links; move it into the form once.
  const promptParam = params.get('prompt');
  useEffect(() => {
    if (!promptParam) return;
    setForm({ prompt: promptParam });
    setParams(
      (p) => {
        p.delete('prompt');
        return p;
      },
      { replace: true },
    );
  }, [promptParam, setForm, setParams]);

  // A job that finished while the studio was closed: show its model on return.
  useEffect(() => {
    const j = useStudio.getState().job;
    if (!modelParam && j?.status === 'succeeded' && j.modelId) showModel(j.modelId);
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onJobFinished((j) => {
      if (j.status === 'succeeded' && j.modelId) {
        showModel(j.modelId);
        toast.success(t('generate.done'));
        setTab('inspect');
      } else {
        toast.error(t('generate.failed', { cost: t('credits.unit', { n: j.creditsCharged }) }));
      }
    });
    return () => onJobFinished(null);
  }, [t, showModel]);

  useEffect(() => {
    if (modelError) toast.error(errorMessage(t, modelError));
  }, [modelError, t]);

  const onCapture = useCallback((blob: Blob) => {
    const m = useStudio.getState().model;
    if (!m || m.hasThumbnail) return;
    void api
      .uploadThumbnail(m.id, blob)
      .then(() => useStudio.setState({ model: { ...m, hasThumbnail: true } }))
      .catch(() => {
        /* thumbnail is best-effort; the library shows a placeholder */
      });
  }, []);

  const fileUrl = model ? api.fileUrl(model.id) : null;
  const nextIsDownload = Boolean(model) && !busy;

  const viewer = (
    <Viewer
      url={fileUrl}
      progress={busy && job ? job.progress : null}
      wireframe={wireframe}
      clay={clay}
      measure={measure}
      onCapture={onCapture}
      onLoadError={() => setLoadFailed(true)}
    >
      <div className="pointer-events-none absolute inset-x-1 top-1 flex flex-col items-center gap-1 z-(--z-viewer-ui)">
        {job && (
          <div className="pointer-events-auto">
            <JobStatus job={job} />
          </div>
        )}
        {!model && !busy && job?.status !== 'failed' && (
          <p className="mt-[18%] max-w-[36ch] text-center text-body text-text/80">
            {t('viewer.empty')}
          </p>
        )}
        {loadFailed && (
          <p
            role="alert"
            className="max-w-[48ch] rounded-overlay border border-danger bg-surface px-1.5 py-1 text-small"
          >
            {t('viewer.loadFailed')}
          </p>
        )}
      </div>
      {model && (
        <div className="absolute right-1 top-1 flex flex-col items-end gap-0.5 z-(--z-viewer-ui)">
          <div className="flex gap-0.5 rounded-control bg-bg/80 p-0.5 backdrop-blur-sm">
            <IconButton
              icon="wireframe"
              label={t('viewer.wireframe')}
              pressed={wireframe}
              onClick={() => setViewer({ wireframe: !wireframe })}
            />
            <IconButton
              icon="clay"
              label={t('viewer.clay')}
              pressed={clay}
              onClick={() => setViewer({ clay: !clay })}
            />
            <IconButton
              icon="ruler"
              label={t('viewer.measure')}
              pressed={measure}
              onClick={() => setViewer({ measure: !measure })}
            />
          </div>
          <label className="flex items-center gap-0.5 rounded-control bg-bg/80 px-1 text-caption backdrop-blur-sm">
            <span className="text-muted">{t('viewer.lighting')}</span>
            <select
              value={lighting}
              onChange={(e) => setLighting(e.target.value as Lighting)}
              className="min-h-4 bg-transparent text-caption text-text"
            >
              {LIGHTS.map((l) => (
                <option key={l} value={l} className="bg-surface">
                  {t(`viewer.lighting.${l}` as MessageKey)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </Viewer>
  );

  const inspectEmpty = <p className="p-2 text-small text-muted">{t('inspect.empty')}</p>;

  if (desktop) {
    return (
      <div className="grid min-h-0 flex-1 grid-cols-[336px_minmax(0,1fr)_312px]">
        <h1 className="sr-only">{t('studio.title')}</h1>
        <aside
          aria-label={t('studio.tabs.create')}
          className="enter min-h-0 overflow-y-auto border-r border-line bg-surface pb-2"
        >
          <PromptPanel primary={!nextIsDownload} />
        </aside>
        <section aria-label={t('viewer.label')} className="enter-late min-h-0">
          {viewer}
        </section>
        <aside
          aria-label={t('studio.tabs.inspect')}
          className="enter min-h-0 overflow-y-auto border-l border-line bg-surface"
        >
          {model ? (
            <>
              <ExportPanel model={model} primary={nextIsDownload} />
              <InspectPanel model={model} />
            </>
          ) : (
            inspectEmpty
          )}
        </aside>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h1 className="sr-only">{t('studio.title')}</h1>
      <div className="enter-late h-[52dvh] shrink-0 sm:h-[58dvh]">{viewer}</div>
      <div className="enter flex min-h-0 flex-1 flex-col bg-surface">
        <Tabs
          label={t('studio.tabs.label')}
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'create', label: t('studio.tabs.create') },
            { value: 'inspect', label: t('studio.tabs.inspect') },
            { value: 'export', label: t('studio.tabs.export') },
          ]}
        >
          {({ id, labelledBy }) => (
            <div
              id={id}
              role="tabpanel"
              aria-labelledby={labelledBy}
              tabIndex={0}
              className="min-h-0 flex-1 overflow-y-auto"
            >
              {tab === 'create' && <PromptPanel primary stickyAction />}
              {tab === 'inspect' && (model ? <InspectPanel model={model} /> : inspectEmpty)}
              {tab === 'export' && (model ? <ExportPanel model={model} primary /> : inspectEmpty)}
            </div>
          )}
        </Tabs>
      </div>
    </div>
  );
}
