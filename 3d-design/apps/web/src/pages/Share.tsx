import type { SharedModel } from '@3d-design/shared';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useFormat, useT } from '../i18n';
import { api, downloadFile } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { toast } from '../stores/toasts';
import Viewer from '../components/viewer/Viewer';
import { Badge, Button, Skeleton } from '../components/ui';

export default function Share() {
  const { slug = '' } = useParams();
  const t = useT();
  const f = useFormat();
  const [model, setModel] = useState<SharedModel | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api
      .shared(slug)
      .then((r) => setModel(r.model))
      .catch(() => setFailed(true));
  }, [slug]);

  if (failed) {
    return (
      <div className="mx-auto flex max-w-[60ch] flex-col items-start gap-2 p-4">
        <h1 className="text-h1 font-semibold">{t('share.title')}</h1>
        <p className="text-muted">{t('share.notFound')}</p>
        <Link
          to="/create"
          className="inline-flex min-h-5 items-center rounded-control bg-accent px-2 text-small font-semibold text-on-accent"
        >
          {t('share.makeYours')}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_336px]">
      <div className="h-[60dvh] lg:h-auto">
        <Viewer url={api.sharedFileUrl(slug)} measure />
      </div>
      <aside className="flex flex-col gap-2 border-l border-line bg-surface p-2">
        {model ? (
          <>
            <h1 className="text-h2 font-semibold">{model.name}</h1>
            <p className="num text-small text-muted">
              {f.int(model.stats.triangles)} △ · {f.bytes(model.stats.fileSizeBytes)} ·{' '}
              {f.metres(model.stats.bounds.x)} × {f.metres(model.stats.bounds.y)} ×{' '}
              {f.metres(model.stats.bounds.z)}
            </p>
            <Badge tone={model.allowCommercialUse ? 'ok' : 'neutral'} className="self-start">
              {model.allowCommercialUse ? t('share.commercialYes') : t('share.commercialNo')}
            </Badge>
            <Button
              variant="primary"
              icon="download"
              onClick={() =>
                void downloadFile(api.sharedFileUrl(slug), 'model.glb')
                  .then(() => toast.success(t('export.downloaded')))
                  .catch((e) => toast.error(errorMessage(t, e)))
              }
            >
              {t('export.download')}
            </Button>
            <p className="text-caption text-muted">{t('export.license')}</p>
            <Link to="/create" className="text-small text-accent-ink underline underline-offset-4">
              {t('share.makeYours')}
            </Link>
          </>
        ) : (
          <>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-2 w-1/2" />
            <Skeleton className="h-5 w-full" />
          </>
        )}
      </aside>
    </div>
  );
}
