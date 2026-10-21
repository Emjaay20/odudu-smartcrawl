import { SECTIONS, START_ROUTES, type Section } from '@site/nav';

function sectionOf(route: string): Section {
  const found = SECTIONS.find((candidate) => candidate.route === route);
  if (found === undefined) throw new Error(`nav.ts has no section at ${route}`);
  return found;
}

export interface HomeMapSections {
  readonly start: readonly Section[];
  readonly guides: Section;
  readonly deeper: readonly Section[];
}

// Where to begin, the guides the journeys belong to, and every other section.
export function homeMapSections(): HomeMapSections {
  const guides = sectionOf('guides/');
  return {
    start: START_ROUTES.map(sectionOf),
    guides,
    deeper: SECTIONS.filter(
      (section) => section !== guides && !START_ROUTES.includes(section.route),
    ),
  };
}
