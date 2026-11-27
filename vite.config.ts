import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {defineConfig} from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  return {
    envPrefix: ['VITE_', 'SUPABASE_'],
    plugins: [
      react(),
      tailwindcss(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(rootDir, 'dist');
          const srcAssets = path.resolve(rootDir, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }

          const indexHtmlPath = path.resolve(distDir, 'index.html');
          if (fs.existsSync(indexHtmlPath)) {
            let html = fs.readFileSync(indexHtmlPath, 'utf8');
            html = html.replace(/<link\b[^>]*>/gi, (fullTag) => {
              if (!/\brel=["']stylesheet["']/i.test(fullTag)) {
                return fullTag;
              }
              const hrefMatch = fullTag.match(/\bhref=["'](\/assets\/[^"']+\.css)["']/i);
              if (!hrefMatch) {
                return fullTag;
              }
              const cssHref = hrefMatch[1];
              const cssPath = path.resolve(distDir, cssHref.replace(/^\/+/, ''));
              if (!fs.existsSync(cssPath)) {
                return fullTag;
              }
              const cssContent = fs
                .readFileSync(cssPath, 'utf8')
                .replace(/<\/style/gi, '<\\/style');
              return `<style data-inlined-href="${cssHref}">${cssContent}</style>`;
            });
            fs.writeFileSync(indexHtmlPath, html, 'utf8');
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': rootDir,
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
