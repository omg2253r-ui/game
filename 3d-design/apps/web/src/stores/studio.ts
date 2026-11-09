import {
  creditCost,
  type Job,
  type Model,
  type Quality,
  type Style,
  type UpdateModel,
} from '@3d-design/shared';
import { create } from 'zustand';
import { api, watchJob } from '../lib/api';
import { useSession } from './session';

export interface StudioForm {
  prompt: string;
  negativePrompt: string;
  style: Style;
  quality: Quality;
  /** Empty string = let the server pick. */
  seed: string;
}

interface Studio {
  form: StudioForm;
  job: Job | null;
  model: Model | null;
  modelError: unknown;
  wireframe: boolean;
  clay: boolean;
  measure: boolean;
  setForm: (patch: Partial<StudioForm>) => void;
  setViewer: (patch: Partial<Pick<Studio, 'wireframe' | 'clay' | 'measure'>>) => void;
  /** Debits credits. Callers must have shown the confirm dialog first. */
  generate: () => Promise<Job>;
  openModel: (id: string) => Promise<void>;
  clearModel: () => void;
  updateModel: (patch: UpdateModel) => Promise<Model>;
  reuseRecipe: (m: Model) => void;
}

let unwatch: (() => void) | null = null;
let onFinished: ((job: Job) => void) | null = null;

/**
 * The studio page registers what happens when a job ends (open the model via
 * the URL, toast). Null while the studio is not mounted: the result is picked
 * up from `job` when the user returns.
 */
export function onJobFinished(fn: ((job: Job) => void) | null) {
  onFinished = fn;
}

export const useStudio = create<Studio>((set, get) => ({
  form: { prompt: '', negativePrompt: '', style: 'stylized', quality: 'standard', seed: '' },
  job: null,
  model: null,
  modelError: null,
  wireframe: false,
  clay: false,
  measure: false,

  setForm: (patch) => set({ form: { ...get().form, ...patch } }),
  setViewer: (patch) => set(patch),

  generate: async () => {
    const { form } = get();
    const seed = form.seed.trim() === '' ? undefined : Number(form.seed);
    const { job, credits } = await api.generate({
      mode: 'text',
      prompt: form.prompt,
      negativePrompt: form.negativePrompt,
      style: form.style,
      quality: form.quality,
      seed,
      requestId: crypto.randomUUID(),
    });
    useSession.getState().setCredits(credits);
    set({ job });
    unwatch?.();
    unwatch = watchJob(job.id, (j) => {
      set({ job: j });
      if (j.status === 'succeeded' && j.modelId) onFinished?.(j);
      if (j.status === 'failed') {
        // Server refunded; resync the balance.
        void useSession.getState().load();
        onFinished?.(j);
      }
    });
    return job;
  },

  openModel: async (id) => {
    try {
      const { model } = await api.model(id);
      set({ model, modelError: null });
    } catch (modelError) {
      set({ model: null, modelError });
    }
  },

  clearModel: () => set({ model: null, modelError: null, job: null }),

  updateModel: async (patch) => {
    const current = get().model;
    if (!current) throw new Error('no model');
    const { model } = await api.updateModel(current.id, patch);
    set({ model });
    return model;
  },

  reuseRecipe: (m) =>
    set({
      form: {
        prompt: m.prompt,
        negativePrompt: m.negativePrompt,
        style: m.style,
        quality: m.quality,
        seed: String(m.seed),
      },
    }),
}));

export const selectCost = (s: Studio) => creditCost(s.form.quality);
export const selectBusy = (s: Studio) => s.job?.status === 'queued' || s.job?.status === 'running';
