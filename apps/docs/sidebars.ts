import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';
import { SECTIONS } from './nav';

export const SECTION_ITEMS = SECTIONS.map((section) => ({
  type: 'doc' as const,
  id: section.id,
  label: section.label,
}));

const sidebars: SidebarsConfig = { docs: SECTION_ITEMS };

export default sidebars;
