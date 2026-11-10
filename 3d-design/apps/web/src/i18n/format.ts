import type { Dict, MessageKey } from './th';

export type Vars = Record<string, string | number>;

/** Replace {name} placeholders. Unknown placeholders are left visible so they get noticed. */
export function format(dict: Dict, key: MessageKey, vars?: Vars): string {
  const template = dict[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in vars ? String(vars[name]) : m,
  );
}
