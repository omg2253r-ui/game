import type { MessageKey, Vars } from '../i18n';
import { ApiRequestError } from './api';

type T = (key: MessageKey, vars?: Vars) => string;

/** Every error shown to users names the cause and the fix, in the system's voice. */
export function errorMessage(t: T, e: unknown): string {
  if (e instanceof ApiRequestError) {
    if (e.code === 'network') return t('error.network');
    return t(`error.${e.code}` as MessageKey, e.detail);
  }
  return t('error.internal');
}
