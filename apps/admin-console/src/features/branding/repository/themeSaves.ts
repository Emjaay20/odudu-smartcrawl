import type { ThemeView } from '@odudu/contracts/admin';
import { putTheme } from '#/features/branding/adapter/theme';
import {
  colourRequest,
  imageRequest,
  stylesheetRequest,
  templateRequest,
  type ColourValues,
  type ImageValues,
  type StylesheetValues,
  type TemplateValues,
  type ThemeScope,
} from '#/features/branding/service';
import type { SaveInput } from '#/shared/repository/useSectionSave';
import type { Gateway } from '#/shared/transport/gateway';

// Each section saves the whole draft: its own part as edited, the rest as the
// record last held it.
export function colourSave(tenant: string, scope: ThemeScope, view: ThemeView) {
  return (gateway: Gateway, { values, ifMatch }: SaveInput<ColourValues>) =>
    putTheme(gateway, tenant, scope, colourRequest(view, values), ifMatch);
}

export function imageSave(tenant: string, scope: ThemeScope, view: ThemeView) {
  return (gateway: Gateway, { values, ifMatch }: SaveInput<ImageValues>) =>
    putTheme(gateway, tenant, scope, imageRequest(view, values), ifMatch);
}

export function templateSave(tenant: string, scope: ThemeScope, view: ThemeView) {
  return (gateway: Gateway, { values, ifMatch }: SaveInput<TemplateValues>) =>
    putTheme(gateway, tenant, scope, templateRequest(view, values), ifMatch);
}

export function stylesheetSave(tenant: string, scope: ThemeScope, view: ThemeView) {
  return (gateway: Gateway, { values, ifMatch }: SaveInput<StylesheetValues>) =>
    putTheme(gateway, tenant, scope, stylesheetRequest(view, values), ifMatch);
}
