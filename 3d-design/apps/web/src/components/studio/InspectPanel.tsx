import { engineCompatibility, TAG_MAX, type Model } from '@3d-design/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { useFormat, useT } from '../../i18n';
import { errorMessage } from '../../lib/errors';
import { useStudio } from '../../stores/studio';
import { toast } from '../../stores/toasts';
import { Badge, Button, Field, Icon, Input, cx } from '../ui';

const ENGINE_NAME = {
  unity: 'Unity',
  unreal: 'Unreal Engine',
  godot: 'Godot',
  roblox: 'Roblox',
} as const;

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1 border-b border-line px-2 py-2 last:border-b-0">
      <h2 className="text-small font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Readout({ label, value, stack }: { label: string; value: ReactNode; stack?: boolean }) {
  return (
    <div
      className={cx(
        'py-0.5',
        stack ? 'flex flex-col' : 'flex items-baseline justify-between gap-1',
      )}
    >
      <dt className="text-small text-muted">{label}</dt>
      <dd className={cx('num text-small', !stack && 'text-right')}>{value}</dd>
    </div>
  );
}

export function InspectPanel({ model }: { model: Model }) {
  const t = useT();
  const f = useFormat();
  const { updateModel, reuseRecipe } = useStudio();
  const [name, setName] = useState(model.name);
  const [tag, setTag] = useState('');
  useEffect(() => setName(model.name), [model.id, model.name]);

  const save = async (patch: Parameters<typeof updateModel>[0], done?: string) => {
    try {
      await updateModel(patch);
      if (done) toast.success(done);
    } catch (e) {
      toast.error(errorMessage(t, e));
    }
  };

  const commitName = () => {
    const next = name.trim();
    if (!next || next === model.name) return setName(model.name);
    void save({ name: next }, t('inspect.renamed'));
  };

  const addTag = () => {
    const next = tag.trim().toLowerCase();
    setTag('');
    if (!next || model.tags.includes(next) || model.tags.length >= TAG_MAX) return;
    void save({ tags: [...model.tags, next] });
  };

  const s = model.stats;
  return (
    <div className="flex flex-col">
      <Section title={t('inspect.name')}>
        <Field label={t('inspect.name')} hideLabel>
          {({ id }) => (
            <Input
              id={id}
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') setName(model.name);
              }}
            />
          )}
        </Field>
      </Section>

      <Section title={t('inspect.stats')}>
        <dl>
          <Readout label={t('stats.triangles')} value={f.int(s.triangles)} />
          <Readout label={t('stats.vertices')} value={f.int(s.vertices)} />
          <Readout label={t('stats.materials')} value={f.int(s.materials)} />
          <Readout label={t('stats.fileSize')} value={f.bytes(s.fileSizeBytes)} />
          <Readout
            label={t('stats.texture')}
            value={s.textureMaxSize ? `${s.textureMaxSize} px` : t('stats.textureNone')}
          />
          <Readout
            stack
            label={t('stats.bounds')}
            value={
              <span className="text-accent-ink">{`${f.metres(s.bounds.x)} × ${f.metres(s.bounds.y)} × ${f.metres(s.bounds.z)}`}</span>
            }
          />
        </dl>
      </Section>

      <Section title={t('inspect.compat')}>
        <ul className="flex flex-col gap-1">
          {engineCompatibility(s).map((c) => (
            <li key={c.engine} className="flex flex-col">
              <div className="flex items-center justify-between gap-1">
                <span className="text-small font-medium">{ENGINE_NAME[c.engine]}</span>
                <Badge
                  tone={c.level === 'ready' ? 'ok' : c.level === 'needs-step' ? 'warn' : 'danger'}
                >
                  <Icon
                    name={
                      c.level === 'ready' ? 'check' : c.level === 'needs-step' ? 'info' : 'alert'
                    }
                    size={12}
                  />
                  {t(`compat.${c.level}`)}
                </Badge>
              </div>
              <span className="text-caption text-muted">{t(c.noteKey, c.vars)}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t('inspect.tags')}>
        {model.tags.length > 0 && (
          <ul className="flex flex-wrap gap-0.5">
            {model.tags.map((tg) => (
              <li key={tg}>
                <span className="inline-flex min-h-4 items-center gap-0.5 rounded-pill border border-line pl-1 pr-0.5 text-caption">
                  {tg}
                  <button
                    type="button"
                    aria-label={t('inspect.tagRemove', { tag: tg })}
                    onClick={() => void save({ tags: model.tags.filter((x) => x !== tg) })}
                    className="rounded-pill p-0.5 text-muted hover:text-text"
                  >
                    <Icon name="x" size={12} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <Field label={t('inspect.tags')} hideLabel>
          {({ id }) => (
            <Input
              id={id}
              value={tag}
              maxLength={24}
              placeholder={t('inspect.tagsPlaceholder')}
              disabled={model.tags.length >= TAG_MAX}
              onChange={(e) => setTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addTag();
                }
              }}
            />
          )}
        </Field>
      </Section>

      <Section title={t('inspect.recipe')}>
        <p className="line-clamp-4 text-small">{model.prompt}</p>
        <p className="text-caption text-muted">
          {t(`style.${model.style}`)} · {t(`quality.${model.quality}`)} ·{' '}
          <span className="num">seed {model.seed}</span>
        </p>
        <Button
          size="sm"
          variant="ghost"
          icon="reset"
          className="self-start"
          onClick={() => {
            reuseRecipe(model);
            toast.info(t('inspect.recipe.reused'));
          }}
        >
          {t('inspect.recipe.reuse')}
        </Button>
      </Section>
    </div>
  );
}
