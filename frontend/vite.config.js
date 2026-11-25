import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const configRoot = fileURLToPath(new URL('.', import.meta.url));
  const env = loadEnv(mode, configRoot, 'VITE_');
  const productionEnabled = env.VITE_ENABLE_PRODUCTION !== 'false';
  const environment = mode === 'production' ? 'production' : mode === 'demo' ? 'demo' : env.VITE_APP_ENV || (productionEnabled ? 'production' : 'demo');
  if (!productionEnabled && environment === 'production') throw new Error('Production đang tạm dừng (VITE_ENABLE_PRODUCTION=false). Dùng npm run dev hoặc npm run build để chạy Demo.');
  if (!['demo', 'production'].includes(environment) || (env.VITE_APP_ENV && env.VITE_APP_ENV !== environment)) throw new Error('VITE_APP_ENV không khớp chế độ build.');
  const productionApi = env.VITE_PRODUCTION_API_URL || (environment === 'production' ? env.VITE_API_URL : '') || '/api';
  const demoApi = env.VITE_DEMO_API_URL || (environment === 'demo' ? env.VITE_API_URL : '') || '/demo-api';
  for (const api of [productionApi, demoApi]) {
    if (!api || !(api.startsWith('/') && !api.startsWith('//') || /^https?:\/\//.test(api))) throw new Error('Production bắt buộc có VITE_API_URL riêng hoặc /api qua reverse proxy.');
    const url = new URL(api, 'http://localhost');
    if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('API phải dùng HTTPS (trừ localhost), không chứa thông tin đăng nhập, query hoặc fragment.');
  }
  if (productionApi.replace(/\/$/, '') === demoApi.replace(/\/$/, '')) throw new Error('API Production và Demo phải có địa chỉ riêng.');
  const proxy = {
    '/demo-api': { target: 'http://localhost:5000', changeOrigin: true, rewrite: path => path.replace(/^\/demo-api/, '/api') },
    ...(productionEnabled ? { '/api': { target: 'http://localhost:5001', changeOrigin: true } } : {}),
  };
  return {
  envDir: configRoot,
  define: { 'import.meta.env.VITE_APP_ENV': JSON.stringify(environment), 'import.meta.env.VITE_ENABLE_PRODUCTION': JSON.stringify(productionEnabled ? 'true' : 'false'), 'import.meta.env.VITE_PRODUCTION_API_URL': JSON.stringify(productionApi), 'import.meta.env.VITE_DEMO_API_URL': JSON.stringify(demoApi) },
  build: { outDir: environment === 'production' ? 'dist-production' : 'dist' },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    port:3000,
    open:true,
    proxy,
  },
  preview: { proxy },
  }
})
