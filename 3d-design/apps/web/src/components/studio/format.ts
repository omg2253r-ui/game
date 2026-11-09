import type { MessageKey, Vars } from '../../i18n';

export function duration(t: (k: MessageKey, v?: Vars) => string, seconds: number) {
  return seconds < 90
    ? t('progress.seconds', { n: Math.max(1, Math.round(seconds)) })
    : t('progress.minutes', { n: Math.round(seconds / 60) });
}
