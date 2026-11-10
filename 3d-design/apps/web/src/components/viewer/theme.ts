import { useEffect, useState } from 'react';
import { usePrefs } from '../../stores/prefs';

export interface ViewerColors {
  ink: string;
  accent: string;
  accentInk: string;
  line: string;
}

const read = (): ViewerColors => {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string) => s.getPropertyValue(name).trim();
  return {
    ink: v('--viewer-ink'),
    accent: v('--accent'),
    accentInk: v('--accent-ink'),
    line: v('--line-strong'),
  };
};

/** Three.js needs concrete colours; read them from the tokens and follow the theme. */
export function useViewerColors(): ViewerColors {
  const theme = usePrefs((s) => s.theme);
  const [colors, setColors] = useState(read);
  useEffect(() => {
    // data-theme is applied by a store subscription; read after it lands.
    const id = requestAnimationFrame(() => setColors(read()));
    return () => cancelAnimationFrame(id);
  }, [theme]);
  return colors;
}

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}
