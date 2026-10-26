import path from 'node:path';
import type { Plugin } from '@docusaurus/types';

// The theme's code blocks import `prism-react-renderer`, which is a tokenizer
// plus its grammars. The build highlights the blocks (plugins/code-tokens.ts),
// so the site's own module stands in for the library in both bundles.
export default function codeHighlight(): Plugin {
  return {
    name: 'odudu-code-highlight',
    configureWebpack() {
      return {
        resolve: {
          alias: {
            'prism-react-renderer$': path.resolve(__dirname, '../src/features/code-block/prism.ts'),
          },
        },
      };
    },
  };
}
