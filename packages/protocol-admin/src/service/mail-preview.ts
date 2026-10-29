import { type MailBrandingView } from '@odudu/contracts/admin';
import { mailSchemeColours, type SchemeColours } from '@odudu/email';
import { type MailBranding, type MailColours, type MailLogo } from '@odudu/kernel';

function coloursView(colours: MailColours): MailBrandingView['light']['colours'] {
  const { buttonInk, ...rest } = colours;
  return { ...rest, button_ink: buttonInk };
}

function schemeView(scheme: SchemeColours): MailBrandingView['light'] {
  return { source: scheme.source, colours: coloursView(scheme.colours) };
}

// A logo with the address it is fetched from, or null where the mail has none.
function logoView(logo: MailLogo | null | undefined): MailBrandingView['logo'] {
  return logo === null || logo === undefined
    ? null
    : { src: logo.src, alt: logo.alt, width: logo.width, height: logo.height };
}

export function mailBrandingView(branding: MailBranding | null): MailBrandingView {
  return {
    light: schemeView(mailSchemeColours(branding, 'light')),
    dark: schemeView(mailSchemeColours(branding, 'dark')),
    logo: logoView(branding?.logo),
    dark_logo: logoView(branding?.darkLogo),
  };
}

// The origins a theme's logos are fetched from, for the policy's `img-src`.
// Each address was checked as a plain web address when the mail was built.
export function logoOrigins(branding: MailBranding | null): string[] {
  const origins = new Set<string>();
  for (const logo of [branding?.logo, branding?.darkLogo]) {
    if (logo === null || logo === undefined) continue;
    try {
      origins.add(new URL(logo.src).origin);
    } catch {
      continue;
    }
  }
  return [...origins];
}
