import {
  checkPrompt,
  creditCost,
  PROMPT_MAX,
  PROMPT_MIN,
  NEGATIVE_PROMPT_MAX,
  QUALITIES,
  QUALITY_PRESETS,
  SEED_MAX,
  STYLES,
} from '@3d-design/shared';
import { useState } from 'react';
import { useFormat, useT, type MessageKey } from '../../i18n';
import { errorMessage } from '../../lib/errors';
import { selectBusy, selectCost, useStudio } from '../../stores/studio';
import { useSession } from '../../stores/session';
import { toast } from '../../stores/toasts';
import {
  Button,
  ConfirmDialog,
  Field,
  Icon,
  IconButton,
  Input,
  Segmented,
  Textarea,
  cx,
} from '../ui';
import { duration } from './format';
import { Onboarding } from './Onboarding';
import { TEMPLATES } from './templates';

const HELPERS: { part: MessageKey; text: MessageKey }[] = [
  { part: 'prompt.helper.shape', text: 'prompt.helper.shape.text' },
  { part: 'prompt.helper.material', text: 'prompt.helper.material.text' },
  { part: 'prompt.helper.color', text: 'prompt.helper.color.text' },
  { part: 'prompt.helper.mood', text: 'prompt.helper.mood.text' },
];

export function PromptPanel({
  primary,
  stickyAction,
}: {
  primary: boolean;
  stickyAction?: boolean;
}) {
  const t = useT();
  const f = useFormat();
  const { form, setForm, generate } = useStudio();
  const busy = useStudio(selectBusy);
  const cost = useStudio(selectCost);
  const credits = useSession((s) => s.credits);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);
  const [creditError, setCreditError] = useState<string | null>(null);

  const promptLen = form.prompt.trim().length;
  const tooShort = promptLen < PROMPT_MIN;
  const verdict = checkPrompt(form.prompt, form.negativePrompt);
  const blocked = verdict.ok
    ? null
    : t(
        verdict.code === 'content_copyrighted'
          ? 'prompt.blocked.copyrighted'
          : 'prompt.blocked.prohibited',
        {
          term: verdict.term,
        },
      );
  const seedInvalid =
    form.seed !== '' && !(/^\d+$/.test(form.seed) && Number(form.seed) <= SEED_MAX);
  const costLabel = t('credits.unit', { n: cost });

  const appendHint = (text: string) => {
    const base = form.prompt.trim();
    setForm({ prompt: base ? `${base} ${text}` : text });
  };

  const onCreate = () => {
    setTouched(true);
    setCreditError(null);
    if (tooShort || blocked || seedInvalid || busy) return;
    if (credits !== null && credits < cost) {
      setCreditError(
        t('generate.notEnough', { cost: costLabel, balance: t('credits.unit', { n: credits }) }),
      );
      return;
    }
    setConfirming(true);
  };

  const onConfirm = async () => {
    setSubmitting(true);
    try {
      await generate();
      setConfirming(false);
      toast.info(t('generate.started', { cost: costLabel }));
    } catch (e) {
      setConfirming(false);
      toast.error(errorMessage(t, e));
    } finally {
      setSubmitting(false);
    }
  };

  const action = (
    <div
      className={cx(
        stickyAction && 'sticky bottom-0 -mx-2 border-t border-line bg-surface px-2 py-1.5',
      )}
    >
      <Button
        variant={primary ? 'primary' : 'secondary'}
        block
        onClick={onCreate}
        disabled={busy}
        aria-describedby={creditError ? 'credit-error' : undefined}
      >
        {busy ? t('generate.busy') : t('generate.button', { cost: costLabel })}
      </Button>
      {creditError && (
        <p id="credit-error" role="alert" className="mt-1 text-caption text-danger">
          {creditError}
        </p>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-3 px-2 pt-2">
      <Onboarding />

      <div className="flex flex-col gap-1">
        <span className="text-caption text-muted">{t('home.tryTemplates')}</span>
        <div className="flex flex-wrap gap-0.5">
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() =>
                setForm({ prompt: t(tpl.prompt), style: tpl.style, quality: tpl.quality })
              }
              className="min-h-4 rounded-pill border border-line px-1 text-small hover:border-line-strong"
            >
              {t(tpl.label)}
            </button>
          ))}
        </div>
      </div>

      <Field
        label={t('prompt.label')}
        aside={t('prompt.count', { n: form.prompt.length, max: PROMPT_MAX })}
        error={
          blocked ?? (touched && tooShort ? t('prompt.tooShort', { min: PROMPT_MIN }) : undefined)
        }
      >
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            value={form.prompt}
            maxLength={PROMPT_MAX}
            rows={4}
            placeholder={t('prompt.placeholder')}
            onChange={(e) => setForm({ prompt: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onCreate();
            }}
          />
        )}
      </Field>

      <div className="-mt-2 flex flex-col gap-1">
        <div className="flex flex-wrap gap-0.5">
          {HELPERS.map((h) => (
            <button
              key={h.part}
              type="button"
              onClick={() => appendHint(t(h.text))}
              className="inline-flex min-h-4 items-center gap-0.5 rounded-control px-0.5 text-caption text-muted hover:bg-surface-2 hover:text-text"
            >
              <Icon name="plus" size={14} />
              {t('prompt.helper.add', { part: t(h.part) })}
            </button>
          ))}
        </div>
        <details className="group text-caption text-muted">
          <summary className="inline-flex min-h-4 items-center gap-0.5 rounded-control hover:text-text">
            <Icon name="chevron" size={14} className="transition-transform group-open:rotate-90" />
            {t('prompt.helper.title')}
          </summary>
          <p className="mt-0.5 max-w-prose pl-2">{t('prompt.helper.body')}</p>
        </details>
      </div>

      <Segmented
        label={t('style.label')}
        value={form.style}
        onChange={(style) => setForm({ style })}
        options={STYLES.map((s) => ({ value: s, label: t(`style.${s}`) }))}
      />

      <Segmented
        label={t('quality.label')}
        layout="stack"
        value={form.quality}
        onChange={(quality) => setForm({ quality })}
        options={QUALITIES.map((q) => {
          const p = QUALITY_PRESETS[q];
          return {
            value: q,
            label: (
              <>
                <span>{t(`quality.${q}`)}</span>
                <span className="num text-caption text-muted">
                  {t('credits.unit', { n: creditCost(q) })}
                </span>
              </>
            ),
            hint: t('quality.detail', {
              tris: f.int(p.targetTriangles),
              tex: p.textureSize,
              eta: duration(t, p.etaSeconds),
            }),
          };
        })}
      />

      <details className="group rounded-control border border-line">
        <summary className="flex min-h-5 items-center gap-1 px-1.5 text-small font-medium">
          <Icon name="chevron" size={16} className="transition-transform group-open:rotate-90" />
          {t('advanced.label')}
        </summary>
        <div className="flex flex-col gap-2 border-t border-line p-1.5">
          <Field
            label={t('advanced.negative')}
            aside={`${form.negativePrompt.length}/${NEGATIVE_PROMPT_MAX}`}
          >
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                value={form.negativePrompt}
                maxLength={NEGATIVE_PROMPT_MAX}
                placeholder={t('advanced.negativePlaceholder')}
                onChange={(e) => setForm({ negativePrompt: e.target.value })}
              />
            )}
          </Field>
          <Field
            label={t('advanced.seed')}
            help={t('advanced.seedHelp')}
            error={seedInvalid ? `0–${SEED_MAX}` : undefined}
          >
            {({ id, describedBy, invalid }) => (
              <div className="flex gap-0.5">
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  inputMode="numeric"
                  className="num"
                  value={form.seed}
                  placeholder={t('advanced.seedPlaceholder')}
                  onChange={(e) =>
                    setForm({ seed: e.target.value.replace(/\D/g, '').slice(0, 10) })
                  }
                />
                <IconButton
                  variant="secondary"
                  icon="dice"
                  label={t('advanced.seedRandom')}
                  onClick={() => setForm({ seed: String(Math.floor(Math.random() * SEED_MAX)) })}
                />
              </div>
            )}
          </Field>
        </div>
      </details>

      {action}

      <ConfirmDialog
        open={confirming}
        title={t('generate.confirm.title')}
        confirmLabel={t('generate.confirm.ok', { cost: costLabel })}
        cancelLabel={t('generate.confirm.cancel')}
        busy={submitting}
        onConfirm={onConfirm}
        onCancel={() => setConfirming(false)}
      >
        <div className="flex flex-col gap-1.5">
          <blockquote className="line-clamp-3 border-l-2 border-line-strong pl-1.5 text-text">
            {form.prompt.trim()}
          </blockquote>
          <p className="text-small">
            {t('generate.confirm.summary', {
              style: t(`style.${form.style}`),
              quality: t(`quality.${form.quality}`),
            })}
            {form.seed && <span className="num"> · seed {form.seed}</span>}
          </p>
          <p>
            {t('generate.confirm.body', {
              cost: costLabel,
              balance: t('credits.unit', { n: credits ?? 0 }),
              after: t('credits.unit', { n: Math.max(0, (credits ?? 0) - cost) }),
            })}
          </p>
        </div>
      </ConfirmDialog>
    </div>
  );
}
