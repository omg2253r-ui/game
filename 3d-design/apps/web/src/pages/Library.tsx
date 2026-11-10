import type { Model } from '@3d-design/shared';
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useFormat, useT } from '../i18n';
import { api, downloadFile } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { toast } from '../stores/toasts';
import { AppFooter } from '../components/layout/AppHeader';
import { copyShareLink } from '../components/studio/ExportPanel';
import {
  Button,
  Card,
  ConfirmDialog,
  Icon,
  IconButton,
  Input,
  Skeleton,
  cx,
} from '../components/ui';

type Pending = { kind: 'delete' | 'share'; model: Model } | null;

export default function Library() {
  const t = useT();
  const f = useFormat();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const tag = params.get('tag') ?? '';
  const [query, setQuery] = useState(q);
  const [models, setModels] = useState<Model[] | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.models({ q: q || undefined, tag: tag || undefined });
      if (tag && !r.tags.includes(tag)) {
        // The filtered tag no longer exists (its last model was deleted): drop the filter.
        setParams(
          (p) => {
            p.delete('tag');
            return p;
          },
          { replace: true },
        );
        return;
      }
      setModels(r.models);
      setTags(r.tags);
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, [q, tag, setParams]);

  useEffect(() => {
    void load();
  }, [load]);

  // Debounce typing into the URL so results are linkable and Back works.
  useEffect(() => {
    const id = setTimeout(() => {
      if (query === q) return;
      setParams(
        (p) => {
          if (query) p.set('q', query);
          else p.delete('q');
          return p;
        },
        { replace: true },
      );
    }, 250);
    return () => clearTimeout(id);
  }, [query, q, setParams]);

  const setTag = (next: string) =>
    setParams((p) => {
      if (next) p.set('tag', next);
      else p.delete('tag');
      return p;
    });

  const confirm = async () => {
    if (!pending) return;
    setWorking(true);
    try {
      if (pending.kind === 'delete') {
        await api.deleteModel(pending.model.id);
        setModels((m) => m?.filter((x) => x.id !== pending.model.id) ?? null);
        toast.success(t('library.deleted'));
        void load(); // refresh the tag list too
      } else {
        const { model } = await api.updateModel(pending.model.id, { isPublic: true });
        setModels((m) => m?.map((x) => (x.id === model.id ? model : x)) ?? null);
        await copyShareLink(model.shareSlug!, t);
      }
      setPending(null);
    } catch (e) {
      toast.error(errorMessage(t, e));
    } finally {
      setWorking(false);
    }
  };

  const filtered = Boolean(q || tag);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-2 px-2 py-3 sm:px-3">
        <div className="enter flex flex-wrap items-end justify-between gap-2">
          <div className="flex items-baseline gap-1">
            <h1 className="text-h1 font-semibold">{t('library.title')}</h1>
            {models && (
              <span className="num text-small text-muted">
                {t('library.count', { n: models.length })}
              </span>
            )}
          </div>
          {models && models.length > 0 && (
            <Link
              to="/create"
              className="inline-flex min-h-5 items-center rounded-control bg-accent px-2 text-small font-semibold text-on-accent hover:bg-accent-hover"
            >
              {t('library.create')}
            </Link>
          )}
        </div>

        <div className="enter flex flex-col gap-1 sm:flex-row sm:items-center">
          <div className="relative sm:w-[360px]">
            <Icon
              name="search"
              size={18}
              className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 text-muted"
            />
            <Input
              type="search"
              aria-label={t('library.search')}
              placeholder={t('library.search')}
              className="pl-4"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {tags.length > 0 && (
            <div
              role="group"
              aria-label={t('library.filterTags')}
              className="flex flex-wrap gap-0.5"
            >
              {['', ...tags].map((tg) => (
                <button
                  key={tg || 'all'}
                  type="button"
                  aria-pressed={tag === tg}
                  onClick={() => setTag(tg)}
                  className={cx(
                    'min-h-4 rounded-pill border px-1 text-small',
                    tag === tg
                      ? 'border-text bg-text text-bg'
                      : 'border-line text-muted hover:text-text',
                  )}
                >
                  {tg || t('library.allTags')}
                </button>
              ))}
            </div>
          )}
        </div>

        {error ? (
          <div role="alert" className="flex flex-col items-start gap-1 py-4">
            <p>{errorMessage(t, error)}</p>
            <Button onClick={() => void load()}>{t('error.reload')}</Button>
          </div>
        ) : models === null ? (
          <ul
            aria-busy="true"
            className="grid grid-cols-[repeat(auto-fill,minmax(216px,1fr))] gap-2"
          >
            {Array.from({ length: 8 }, (_, i) => (
              <li key={i} className="flex flex-col gap-1">
                <Skeleton className="aspect-square w-full rounded-tile" />
                <Skeleton className="h-2 w-3/4" />
                <Skeleton className="h-2 w-1/2" />
              </li>
            ))}
          </ul>
        ) : models.length === 0 ? (
          <div className="flex flex-col items-start gap-2 py-6">
            <p className="text-body">
              {filtered ? t('library.emptySearch', { q: q || tag }) : t('library.empty')}
            </p>
            {filtered ? (
              <Button
                onClick={() => {
                  setQuery('');
                  setParams({});
                }}
              >
                {t('library.clearFilters')}
              </Button>
            ) : (
              <Link
                to="/create"
                className="inline-flex min-h-5 items-center rounded-control bg-accent px-2 text-small font-semibold text-on-accent"
              >
                {t('library.create')}
              </Link>
            )}
          </div>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(216px,1fr))] gap-2">
            {models.map((m) => (
              <li key={m.id} className="flex">
                <Card variant="tile" className="w-full">
                  <Link
                    to={`/create?model=${m.id}`}
                    aria-label={t('library.open', { name: m.name })}
                    className="block rounded-t-tile"
                  >
                    {m.hasThumbnail ? (
                      <img
                        src={api.thumbnailUrl(m.id)}
                        alt=""
                        loading="lazy"
                        width={480}
                        height={480}
                        className="aspect-square w-full rounded-t-tile bg-viewer object-cover"
                      />
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center rounded-t-tile bg-viewer p-2 text-center text-caption text-muted">
                        {t('library.noThumb')}
                      </div>
                    )}
                  </Link>
                  <div className="flex flex-1 flex-col gap-0.5 p-1.5">
                    <h2 className="truncate text-small font-semibold" title={m.name}>
                      {m.name}
                    </h2>
                    <p className="num text-caption text-muted">
                      {f.int(m.stats.triangles)} △ · {f.bytes(m.stats.fileSizeBytes)} ·{' '}
                      {t(`style.${m.style}`)}
                    </p>
                    <p className="text-caption text-muted">{f.date(m.createdAt)}</p>
                    {m.tags.length > 0 && (
                      <p className="truncate text-caption text-muted">#{m.tags.join(' #')}</p>
                    )}
                    <div className="mt-auto flex items-center gap-0.5 pt-1">
                      <Link
                        to={`/create?model=${m.id}`}
                        className="mr-auto inline-flex min-h-4 items-center rounded-control px-1 text-small font-medium hover:bg-surface-2"
                      >
                        {t('library.openShort')}
                      </Link>
                      <IconButton
                        icon="download"
                        label={t('library.download', { name: m.name })}
                        onClick={() =>
                          void downloadFile(api.fileUrl(m.id), `${m.id}.glb`)
                            .then(() => toast.success(t('export.downloaded')))
                            .catch((e) => toast.error(errorMessage(t, e)))
                        }
                      />
                      <IconButton
                        icon="link"
                        label={t('library.share', { name: m.name })}
                        onClick={() =>
                          m.isPublic && m.shareSlug
                            ? void copyShareLink(m.shareSlug, t)
                            : setPending({ kind: 'share', model: m })
                        }
                      />
                      <IconButton
                        icon="trash"
                        label={t('library.delete', { name: m.name })}
                        className="hover:text-danger!"
                        onClick={() => setPending({ kind: 'delete', model: m })}
                      />
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        variant={pending?.kind === 'delete' ? 'danger' : 'primary'}
        title={
          pending?.kind === 'delete'
            ? t('library.delete.title', { name: pending.model.name })
            : t('library.shareEnable.title', { name: pending?.model.name ?? '' })
        }
        confirmLabel={
          pending?.kind === 'delete' ? t('library.delete.ok') : t('library.shareEnable.ok')
        }
        cancelLabel={pending?.kind === 'delete' ? t('library.delete.cancel') : t('common.cancel')}
        busy={working}
        onConfirm={() => void confirm()}
        onCancel={() => setPending(null)}
      >
        {pending?.kind === 'delete' ? t('library.delete.body') : t('library.shareEnable.body')}
      </ConfirmDialog>
      <AppFooter />
    </div>
  );
}
