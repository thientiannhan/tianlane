import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { handleApiAndHealthRequest } from './server/apiRouter.mjs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'tianlane-stateless-api-and-health',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const handled = await handleApiAndHealthRequest(req, res);
          if (!handled) {
            next();
          }
        });
      },
    },
  ],
  server: {
    port: 5173,
    host: true,
  },
});
