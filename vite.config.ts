import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Plugin para forçar o tipo MIME correto em downloads de APKs
const apkMimePlugin = () => ({
  name: 'apk-mime-plugin',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      if (req.url && req.url.split('?')[0].endsWith('.apk')) {
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      }
      next();
    });
  },
  configurePreviewServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      if (req.url && req.url.split('?')[0].endsWith('.apk')) {
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      }
      next();
    });
  }
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apkMimePlugin()],
  build: {
    target: ['es2015', 'chrome60'],
  },
  preview: {
    allowedHosts: true,
  },
})
