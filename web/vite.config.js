import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// دو خروجی:
//   npm run build        -> dist/index.html        (نسخه واقعی، متصل به سرور)
//   npm run build:preview -> preview/index.html    (نسخه نمایش طراحی با داده‌های نمونه)
export default defineConfig(({ mode }) => {
  const demo = mode === 'demo'
  return {
    plugins: [react(), viteSingleFile({ removeViteModuleLoader: true, useRecommendedBuildConfig: true })],
    build: {
      outDir: demo ? 'preview' : 'dist',
      emptyOutDir: true,
      assetsInlineLimit: 100000000,
      cssCodeSplit: false,
      reportCompressedSize: false,
    },
    define: demo ? { 'import.meta.env.VITE_DEMO': '"1"' } : {},
  }
})
