import type { Model } from '@3d-design/shared';
import { useState } from 'react';
import { useT } from '../../i18n';
import { api, downloadFile } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { useStudio } from '../../stores/studio';
import { toast } from '../../stores/toasts';
import { Button, Icon, Switch } from '../ui';
import { Section } from './InspectPanel';

export async function copyShareLink(slug: string, t: ReturnType<typeof useT>) {
  const link = api.shareLink(slug);
  try {
    await navigator.clipboard.writeText(link);
    toast.success(t('export.copied'));
  } catch {
    // Clipboard blocked (http, permissions): show the link so it can be copied by hand.
    toast.info(link);
  }
}

export function ExportPanel({ model, primary }: { model: Model; primary: boolean }) {
  const t = useT();
  const updateModel = useStudio((s) => s.updateModel);
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      await downloadFile(api.fileUrl(model.id), `${model.id}.glb`);
      toast.success(t('export.downloaded'));
    } catch (e) {
      toast.error(errorMessage(t, e));
    } finally {
      setDownloading(false);
    }
  };

  const toggle = async (
    patch: { isPublic?: boolean; allowCommercialUse?: boolean },
    message: string,
  ) => {
    setSaving(true);
    try {
      const m = await updateModel(patch);
      toast.success(message);
      if (patch.isPublic && m.shareSlug) await copyShareLink(m.shareSlug, t);
    } catch (e) {
      toast.error(errorMessage(t, e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title={t('export.title')}>
      <Button
        variant={primary ? 'primary' : 'secondary'}
        icon="download"
        block
        onClick={download}
        disabled={downloading}
      >
        {downloading ? t('export.downloading') : t('export.download')}
      </Button>
      {model.provider === 'mock' && (
        // Transparency: results from the offline stand-in are labelled as such.
        <p className="flex gap-0.5 text-caption text-accent-ink">
          <Icon name="info" size={14} className="mt-0.5 shrink-0" />
          {t('viewer.sampleBadge')}
        </p>
      )}
      <p className="text-caption text-muted">{t('export.license')}</p>
      <p className="text-caption text-muted">{t('export.formats')}</p>
      <div className="mt-1 flex flex-col gap-2 border-t border-line pt-2">
        <Switch
          label={t('export.share')}
          help={t('export.shareHelp')}
          checked={model.isPublic}
          disabled={saving}
          onChange={(v) =>
            void toggle({ isPublic: v }, v ? t('export.shareOn') : t('export.shareOff'))
          }
        />
        {model.isPublic && model.shareSlug && (
          <Button
            size="sm"
            variant="secondary"
            icon="link"
            className="self-start"
            onClick={() => void copyShareLink(model.shareSlug!, t)}
          >
            {t('export.copyLink')}
          </Button>
        )}
        <Switch
          label={t('export.commercial')}
          help={t('export.commercialHelp')}
          checked={model.allowCommercialUse}
          disabled={saving}
          onChange={(v) =>
            void toggle(
              { allowCommercialUse: v },
              v ? t('export.commercialOn') : t('export.commercialOff'),
            )
          }
        />
      </div>
    </Section>
  );
}
