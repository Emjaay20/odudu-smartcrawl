import type { ThemeView } from '@odudu/contracts/admin';
import { useState } from 'react';
import { useRefusal } from '#/features/session';
import { useAssetUpload } from '#/features/branding/repository/useThemeAssets';
import { imageSave } from '#/features/branding/repository/themeSaves';
import {
  altEdited,
  IDLE_SLOTS,
  imageAfterUpload,
  imageField,
  imageFields,
  imageValues,
  imagesHold,
  IMAGES_TITLE,
  slotBusy,
  slotDone,
  slotFailed,
  themeRecord,
  uploadFailureOf,
  uploadRefusal,
  type ImageValues,
  type ImageSlot,
  type SlotStates,
  type ThemeScope,
} from '#/features/branding/service';
import { useSectionSave, type SectionSave } from '#/shared/repository/useSectionSave';
import { writeRefusal } from '#/shared/service/capabilities';

export interface Images {
  save: SectionSave<ImageValues>;
  blocked: string | undefined;
  slots: SlotStates;
  upload: (slot: ImageSlot, file: File) => void;
  setAlt: (slot: 'logo' | 'darkLogo', alt: string) => void;
  remove: (slot: ImageSlot) => void;
  // Takes a deleted image out of the slot that still names it.
  forget: (slot: ImageSlot, assetId: string) => void;
}

export function useImages({
  tenant,
  scope,
  view,
  tag,
  gone,
}: {
  tenant: string;
  scope: ThemeScope;
  view: ThemeView;
  tag: string;
  gone: boolean;
}): Images {
  const refusal = useRefusal(tenant);
  const uploading = useAssetUpload(tenant);
  const [slots, setSlots] = useState(IDLE_SLOTS);
  const save = useSectionSave({
    tenant,
    record: themeRecord(scope),
    section: 'images',
    label: IMAGES_TITLE,
    etag: tag,
    capability: 'manage-tenant',
    gone,
    refusal,
    explain: writeRefusal,
    fields: imageFields(imageValues(view)),
    save: imageSave(tenant, scope, view),
  });
  return {
    save,
    blocked: imagesHold(save.values),
    slots,
    upload: (slot, file) => {
      const refused = uploadRefusal(slot, file);
      if (refused !== null) {
        setSlots((was) => slotFailed(was, slot, refused));
        return;
      }
      setSlots((was) => slotBusy(was, slot));
      uploading
        .run({ kind: slot, file })
        .then((result) => {
          if (result.ok) {
            save.edit(imageField(slot), imageAfterUpload(slot, result.data.id, save.values));
            setSlots((was) => slotDone(was, slot));
            return;
          }
          refusal.report(result, 'manage-tenant');
          setSlots((was) => slotFailed(was, slot, uploadFailureOf(slot, result)));
        })
        .catch(() => {
          setSlots((was) =>
            slotFailed(was, slot, uploadFailureOf(slot, { ok: false, kind: 'defect' })),
          );
        });
    },
    setAlt: (slot, alt) => {
      const logo = altEdited(save.values, slot, alt);
      if (logo !== null) save.edit(imageField(slot), logo);
    },
    remove: (slot) => {
      save.edit(imageField(slot), null);
    },
    forget: (slot, assetId) => {
      if (save.values[imageField(slot)]?.assetId === assetId) save.edit(imageField(slot), null);
    },
  };
}
