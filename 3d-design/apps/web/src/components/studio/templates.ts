import type { Quality, Style } from '@3d-design/shared';
import type { MessageKey } from '../../i18n';

export const TEMPLATES: {
  id: string;
  label: MessageKey;
  prompt: MessageKey;
  style: Style;
  quality: Quality;
}[] = [
  {
    id: 'sword',
    label: 'template.sword',
    prompt: 'template.sword.prompt',
    style: 'stylized',
    quality: 'standard',
  },
  {
    id: 'tree',
    label: 'template.tree',
    prompt: 'template.tree.prompt',
    style: 'low-poly',
    quality: 'standard',
  },
  {
    id: 'car',
    label: 'template.car',
    prompt: 'template.car.prompt',
    style: 'realistic',
    quality: 'standard',
  },
];
