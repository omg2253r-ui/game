import { useT } from '../../i18n';
import { usePrefs } from '../../stores/prefs';
import { Button, Card } from '../ui';

/** Three real steps, shown once. Inline (not a modal) so it never blocks the work. */
export function Onboarding() {
  const t = useT();
  const step = usePrefs((s) => s.onboardingStep);
  const setStep = usePrefs((s) => s.setOnboardingStep);
  if (step < 1 || step > 3) return null;
  const body = t(`onboarding.step${step}` as 'onboarding.step1');
  return (
    <Card variant="notice" aria-labelledby="onb-title">
      <div className="flex items-baseline justify-between gap-1">
        <h2 id="onb-title" className="text-small font-semibold">
          {t('onboarding.title')}
        </h2>
        <span className="text-caption text-muted">{t('onboarding.progress', { n: step })}</span>
      </div>
      <p className="text-small text-muted" aria-live="polite">
        {body}
      </p>
      <div className="flex justify-end gap-0.5">
        <Button size="sm" variant="ghost" onClick={() => setStep(0)}>
          {t('onboarding.skip')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setStep(step === 3 ? 0 : step + 1)}>
          {step === 3 ? t('onboarding.done') : t('onboarding.next')}
        </Button>
      </div>
    </Card>
  );
}
