import type { Job } from '@3d-design/shared';
import { useT } from '../../i18n';
import { errorMessage } from '../../lib/errors';
import { ApiRequestError } from '../../lib/api';
import { Icon } from '../ui';
import { duration } from './format';

/** Real-time job readout over the viewer: stage, %, queue position, ETA. */
export function JobStatus({ job }: { job: Job }) {
  const t = useT();
  if (job.status === 'succeeded') return null;
  if (job.status === 'failed') {
    const e = new ApiRequestError(job.error?.code ?? 'provider_failed', 500, job.error?.detail);
    return (
      <div
        role="alert"
        className="flex max-w-[52ch] items-start gap-1 rounded-overlay border border-danger bg-surface px-1.5 py-1 text-small shadow-overlay"
      >
        <Icon name="alert" className="mt-0.5 shrink-0 text-danger" />
        <p>{errorMessage(t, e)}</p>
      </div>
    );
  }
  const pct = Math.round(job.progress * 100);
  const meta = [
    job.queuePosition ? t('progress.queue', { n: job.queuePosition }) : null,
    job.etaSeconds ? t('progress.eta', { t: duration(t, job.etaSeconds) }) : null,
  ].filter(Boolean);
  return (
    <div className="w-[360px] max-w-[calc(100vw-32px)] rounded-overlay border border-line bg-surface/95 px-1.5 py-1 shadow-overlay">
      <div className="flex items-baseline justify-between gap-1 text-small">
        <span className="font-medium" aria-live="polite">
          {t(`stage.${job.stage}`)}
        </span>
        <span className="num text-muted">{pct}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={t('progress.label')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${t(`stage.${job.stage}`)} ${pct}%`}
        className="mt-0.5 h-0.5 overflow-hidden rounded-pill bg-surface-2"
      >
        <div
          className="h-full bg-accent transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      {meta.length > 0 && <p className="mt-0.5 text-caption text-muted">{meta.join(' · ')}</p>}
    </div>
  );
}
