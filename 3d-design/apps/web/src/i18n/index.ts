import { useCallback } from 'react';
import { usePrefs } from '../stores/prefs';
import { en } from './en';
import { format, type Vars } from './format';
import { th, type Dict, type MessageKey } from './th';

export type Locale = 'th' | 'en';
export const DICTS: Record<Locale, Dict> = { th, en };
export type { MessageKey };
export type { Vars };

export { format };

export function useT() {
  const locale = usePrefs((s) => s.locale);
  return useCallback((key: MessageKey, vars?: Vars) => format(DICTS[locale], key, vars), [locale]);
}

export function useLocale(): Locale {
  return usePrefs((s) => s.locale);
}

/** Numbers with locale grouping; Thai uses Western digits in UI by convention. */
export function useFormat() {
  const locale = useLocale();
  const tag = locale === 'th' ? 'th-TH' : 'en-GB';
  return {
    int: (n: number) => new Intl.NumberFormat(tag).format(n),
    bytes: (b: number) => {
      if (b < 1024) return `${b} B`;
      if (b < 1024 * 1024)
        return `${new Intl.NumberFormat(tag, { maximumFractionDigits: 0 }).format(b / 1024)} KB`;
      return `${new Intl.NumberFormat(tag, { maximumFractionDigits: 1 }).format(b / 1024 / 1024)} MB`;
    },
    metres: (m: number) =>
      m < 1
        ? `${new Intl.NumberFormat(tag, { maximumFractionDigits: 0 }).format(m * 100)} cm`
        : `${new Intl.NumberFormat(tag, { maximumFractionDigits: 2 }).format(m)} m`,
    date: (iso: string) =>
      new Intl.DateTimeFormat(tag, { dateStyle: 'medium' }).format(new Date(iso)),
  };
}
