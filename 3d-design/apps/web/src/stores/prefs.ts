import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Locale } from '../i18n';

export type Theme = 'dark' | 'light';
export type Lighting = 'studio' | 'outdoor' | 'dramatic';

interface Prefs {
  theme: Theme;
  locale: Locale;
  /** 1..3 while the onboarding card is showing; 0 once finished or skipped. */
  onboardingStep: number;
  lighting: Lighting;
  autoRotate: boolean;
  setTheme: (t: Theme) => void;
  setLocale: (l: Locale) => void;
  setOnboardingStep: (n: number) => void;
  setLighting: (l: Lighting) => void;
  setAutoRotate: (v: boolean) => void;
}

const systemTheme = (): Theme =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';

export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({
      theme: systemTheme(),
      locale: 'th',
      onboardingStep: 1,
      lighting: 'studio',
      autoRotate: true,
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
      setOnboardingStep: (onboardingStep) => set({ onboardingStep }),
      setLighting: (lighting) => set({ lighting }),
      setAutoRotate: (autoRotate) => set({ autoRotate }),
    }),
    { name: 'd3-prefs', version: 1 },
  ),
);

// Reflect theme + language on <html> (tokens.css keys off data-theme).
usePrefs.subscribe((s) => {
  document.documentElement.dataset.theme = s.theme;
  document.documentElement.lang = s.locale;
});
document.documentElement.dataset.theme = usePrefs.getState().theme;
document.documentElement.lang = usePrefs.getState().locale;
