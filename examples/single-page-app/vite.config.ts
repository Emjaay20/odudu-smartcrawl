import { defineConfig } from 'vite';

// Vite answers any path with index.html, which is how `/callback` reaches the app.
export default defineConfig({ server: { host: 'localhost' }, preview: { host: 'localhost' } });
