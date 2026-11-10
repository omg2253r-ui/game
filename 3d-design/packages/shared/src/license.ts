export interface LicenseInput {
  modelId: string;
  ownerId: string;
  createdAt: string;
  provider: string;
  allowCommercialUse: boolean;
}

export const LICENSE_VERSION = '2026-11';

/**
 * Plain-English licence notice embedded in every exported file
 * (glTF `asset.copyright` + `asset.extras.license`). Final wording must be
 * reviewed by counsel; see docs/legal.md.
 */
export function licenseNotice(i: LicenseInput): string {
  const thirdParty = i.allowCommercialUse
    ? 'Others who receive this file may use it commercially.'
    : 'Others who receive this file may use it for personal, non-commercial purposes only.';
  return [
    `Created with 3D Design on ${i.createdAt.slice(0, 10)} (model ${i.modelId}).`,
    `The creator (account ${i.ownerId}) owns this output and may use it commercially,`,
    `subject to the 3D Design Terms of Use v${LICENSE_VERSION}.`,
    thirdParty,
  ].join(' ');
}
