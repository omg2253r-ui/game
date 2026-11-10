import type { Config } from '../config';
import type { GenerationProvider } from '../types';
import { MockProvider } from './mock';
import { MeshyProvider } from './remote/meshy';
import { TripoProvider } from './remote/tripo';

/**
 * Pick the text-to-3D backend from AI_PROVIDER. To add a vendor (Hunyuan3D,
 * TripoSR on your own GPU, …) implement GenerationProvider and add a case.
 */
export function createProvider(config: Config): GenerationProvider {
  switch (config.AI_PROVIDER) {
    case 'meshy':
      return new MeshyProvider(config.MESHY_API_KEY!);
    case 'tripo':
      return new TripoProvider(config.TRIPO_API_KEY!);
    case 'mock':
      return new MockProvider(config.MOCK_DELAY_SCALE);
  }
}
