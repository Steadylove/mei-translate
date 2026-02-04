import { defineConfig, build } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  copyFileSync,
  mkdirSync,
  existsSync,
  writeFileSync,
  readFileSync,
  rmSync,
  cpSync,
} from 'fs'

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Custom plugin to build content script as IIFE
function buildContentScript(mode: string) {
  return {
    name: 'build-content-script',
    async closeBundle() {
      console.log('\n📦 Building content script as IIFE...')

      await build({
        configFile: false,
        build: {
          emptyOutDir: false,
          outDir: 'dist',
          lib: {
            entry: resolve(__dirname, 'src/content/index.tsx'),
            name: 'WebTransContent',
            formats: ['iife'],
            fileName: () => 'content.js',
          },
          rollupOptions: {
            output: {
              extend: true,
              globals: {},
            },
          },
          minify: mode === 'production',
          sourcemap: mode === 'development',
        },
        define: {
          'process.env.NODE_ENV': JSON.stringify(
            mode === 'development' ? 'development' : 'production'
          ),
          'import.meta.env.VITE_API_URL': JSON.stringify(
            mode === 'development'
              ? 'http://localhost:8787'
              : 'https://webtrans-api.meitrans.workers.dev'
          ),
          'import.meta.env.MODE': JSON.stringify(mode),
          'import.meta.env.DEV': JSON.stringify(mode === 'development'),
          'import.meta.env.PROD': JSON.stringify(mode === 'production'),
        },
        resolve: {
          alias: {
            '@': resolve(__dirname, 'src'),
          },
        },
        plugins: [react()],
        logLevel: 'warn',
      })

      console.log('✅ Content script built: dist/content.js')
    },
  }
}

// Custom plugin to build background script
function buildBackgroundScript(mode: string) {
  return {
    name: 'build-background-script',
    async closeBundle() {
      console.log('\n📦 Building background script...')

      await build({
        configFile: false,
        build: {
          emptyOutDir: false,
          outDir: 'dist',
          lib: {
            entry: resolve(__dirname, 'src/background/index.ts'),
            formats: ['es'],
            fileName: () => 'background.js',
          },
          rollupOptions: {
            output: {
              entryFileNames: 'background.js',
            },
          },
          minify: mode === 'production',
          sourcemap: mode === 'development',
        },
        define: {
          'import.meta.env.VITE_API_URL': JSON.stringify(
            mode === 'development'
              ? 'http://localhost:8787'
              : 'https://webtrans-api.meitrans.workers.dev'
          ),
          'import.meta.env.MODE': JSON.stringify(mode),
          'import.meta.env.DEV': JSON.stringify(mode === 'development'),
          'import.meta.env.PROD': JSON.stringify(mode === 'production'),
        },
        resolve: {
          alias: {
            '@': resolve(__dirname, 'src'),
          },
        },
        logLevel: 'warn',
      })

      console.log('✅ Background script built: dist/background.js')
    },
  }
}

// Custom plugin to copy and process manifest
function processManifest() {
  return {
    name: 'process-manifest',
    closeBundle() {
      console.log('\n📦 Processing manifest.json...')

      const manifest = JSON.parse(readFileSync(resolve(__dirname, 'src/manifest.json'), 'utf-8'))

      // Update paths for production build
      manifest.background = {
        service_worker: 'background.js',
        type: 'module',
      }

      manifest.content_scripts = [
        {
          matches: ['<all_urls>'],
          js: ['content.js'],
          all_frames: true,
          run_at: 'document_idle',
        },
      ]

      manifest.action.default_popup = 'popup.html'
      manifest.options_ui.page = 'options.html'

      // Ensure dist directory exists
      if (!existsSync('dist')) {
        mkdirSync('dist', { recursive: true })
      }

      writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2))
      console.log('✅ Manifest processed: dist/manifest.json')
    },
  }
}

// Custom plugin to copy static assets
function copyAssets() {
  return {
    name: 'copy-assets',
    closeBundle() {
      console.log('\n📦 Copying assets...')

      const assetsDir = 'dist/assets'
      if (!existsSync(assetsDir)) {
        mkdirSync(assetsDir, { recursive: true })
      }

      // Copy icons
      const icons = ['icon16.png', 'icon48.png', 'icon128.png']
      icons.forEach((icon) => {
        const src = resolve(__dirname, `public/assets/${icon}`)
        const dest = resolve(__dirname, `dist/assets/${icon}`)
        if (existsSync(src)) {
          copyFileSync(src, dest)
        }
      })

      // Copy PDF.js viewer (official Mozilla PDF.js with selection script injected)
      const pdfjsSrc = resolve(__dirname, 'src/assets/pdfjs-5.4.624-dist')
      const pdfjsDest = resolve(__dirname, 'dist/pdfjs')
      if (existsSync(pdfjsSrc)) {
        // Remove old pdfjs folder if exists
        if (existsSync(pdfjsDest)) {
          rmSync(pdfjsDest, { recursive: true })
        }
        // Copy entire pdfjs folder
        cpSync(pdfjsSrc, pdfjsDest, { recursive: true })
        console.log('✅ PDF.js viewer copied')
      }

      console.log('✅ Assets copied')
    },
  }
}

// Custom plugin to fix HTML paths after build
function fixHtmlPaths() {
  return {
    name: 'fix-html-paths',
    closeBundle() {
      console.log('\n📦 Fixing HTML paths...')

      // Move popup HTML
      const popupSrc = resolve(__dirname, 'dist/src/popup/index.html')
      const popupDest = resolve(__dirname, 'dist/popup.html')
      if (existsSync(popupSrc)) {
        // Read and fix paths in HTML - convert ../../ to ./
        let html = readFileSync(popupSrc, 'utf-8')
        html = html.replace(/src="\.\.\/\.\.\/popup\.js"/g, 'src="./popup.js"')
        html = html.replace(/href="\.\.\/\.\.\/chunks\//g, 'href="./chunks/')
        html = html.replace(/href="\.\.\/\.\.\/globals\.css"/g, 'href="./globals.css"')
        writeFileSync(popupDest, html)
      }

      // Move options HTML
      const optionsSrc = resolve(__dirname, 'dist/src/options/index.html')
      const optionsDest = resolve(__dirname, 'dist/options.html')
      if (existsSync(optionsSrc)) {
        let html = readFileSync(optionsSrc, 'utf-8')
        html = html.replace(/src="\.\.\/\.\.\/options\.js"/g, 'src="./options.js"')
        html = html.replace(/href="\.\.\/\.\.\/chunks\//g, 'href="./chunks/')
        html = html.replace(/href="\.\.\/\.\.\/globals\.css"/g, 'href="./globals.css"')
        writeFileSync(optionsDest, html)
      }

      // Clean up src directory
      const srcDir = resolve(__dirname, 'dist/src')
      if (existsSync(srcDir)) {
        rmSync(srcDir, { recursive: true })
      }

      console.log('✅ HTML paths fixed')
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    processManifest(),
    copyAssets(),
    fixHtmlPaths(),
    buildContentScript(mode),
    buildBackgroundScript(mode),
  ],
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(
      mode === 'development' ? 'http://localhost:8787' : 'https://webtrans-api.meitrans.workers.dev'
    ),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return '[name][extname]'
          }
          return 'assets/[name][extname]'
        },
      },
    },
  },
}))
