import '#/zodConfig';
import '#/shared/view/fonts.css';
import '#/shared/view/tokens.css';
import '#/shared/view/global.css';
import { createRoot } from 'react-dom/client';
import { App } from '#/app/App';
import { createConsoleRouter } from '#/app/router';
import { applyRememberedTheme } from '#/shared/repository/themeChoice';

applyRememberedTheme();

const root = document.getElementById('root');
if (root === null) throw new Error('the console shell has no #root element');
createRoot(root).render(<App router={createConsoleRouter()} />);
