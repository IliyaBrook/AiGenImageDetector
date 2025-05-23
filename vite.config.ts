import react from '@vitejs/plugin-react'
import * as path from 'path'
import { resolve } from 'path'
import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import manifestPath from './manifest'
import makeManifest from './src/utils/defaultUtils/plugins/make-manifest'
// hmr tool
import {
	extensionReloaderBuildStep,
	extensionReloaderWatchExternal,
	extensionReloaderWebSocket,
  } from "vite-plugin-extension-reloader";

const isDev = process.env.__DEV__ === 'true'
const isProduction = !isDev

const rootDir = resolve(__dirname)
const srcDir = resolve(rootDir, 'src')
const lib = resolve(srcDir, 'lib')
const assetsDir = resolve(srcDir, 'assets')
const publicJsDir = resolve(rootDir, 'public')


export default defineConfig({
	resolve: {
		alias: {
			'@src': srcDir,
			'@assets': assetsDir,
			'@lib': lib,
			'@public': publicJsDir
		}
	},
	plugins: [
		react(),
		makeManifest(manifestPath, {
			isDev,
			contentScriptCssKey: regenerateCacheInvalidationKey()
		}),
		viteStaticCopy({
			targets: [
				{
					src: 'models/deepfake-detection.onnx',
					dest: 'models'
				}
			]
		}),
		isDev && extensionReloaderBuildStep('dist/manifest.json'),
		extensionReloaderWebSocket(),
		extensionReloaderWatchExternal("src/**/*")
	],
	build: {
		modulePreload: isDev,
		minify: isProduction,
		reportCompressedSize: isProduction,
		lib: {
			entry: resolve(srcDir, 'content', 'content.ts'),
			name: 'content',
			fileName: () => "src/content/content.js",
			formats: ['es']
		},
		rollupOptions: {
			input: {
				popup: resolve(srcDir, 'popup', 'index.html'),
				logs: resolve(srcDir, 'logs', 'index.html'),
				background: resolve(srcDir, 'background', 'background.ts'),
				content: resolve(srcDir, 'content', 'content.ts'),
				onnxInit: resolve(srcDir, 'background', 'onnx-init.js')
			},
			output: {
				entryFileNames: (chunkInfo) => {
					if (chunkInfo.name === 'onnxInit') {
						return 'src/background/onnx-init.js'
					}
					return 'src/[name]/[name].js'
				},
				chunkFileNames: isDev
					? 'assets/js/[name].js'
					: 'assets/js/[name].[hash].js',
				assetFileNames: (assetInfo) => {
										const fileName =
						(assetInfo.names && assetInfo.names[0]) ||
						(assetInfo.originalFileNames && assetInfo.originalFileNames[0]) ||
						''
					const parsedPath = path.parse(fileName)
					const baseName = parsedPath.base
					const assetFolder = parsedPath.dir.split('/').at(-1)
					const name =
						assetFolder + firstUpperCase(baseName.replace(parsedPath.ext, ''))
					if (name === 'Contentstyle') {
						return `assets/css/contentStyle${cacheInvalidationKey}.chunk.css`
					}
					return `assets/[ext]/${name}.chunk.[ext]`
				}
			}
		},
		outDir: 'dist',
		emptyOutDir: true,
		copyPublicDir: true
	},
	define: {
		__IS_DEV__: JSON.stringify(isDev)
	},
	optimizeDeps: {
		exclude: ['onnxruntime-web']
	},
	publicDir: 'public',
	assetsInclude: ['**/*.onnx'],
	server: {
		headers: {
			'Cross-Origin-Opener-Policy': 'same-origin',
			'Cross-Origin-Embedder-Policy': 'require-corp'
		}
	}
})

let cacheInvalidationKey: string = generateKey()

function regenerateCacheInvalidationKey() {
	cacheInvalidationKey = generateKey()
	return cacheInvalidationKey
}

function generateKey(): string {
	return `${(Date.now() / 100).toFixed()}`
}

function firstUpperCase(str: string) {
	const firstAlphabet = new RegExp(/( |^)[a-z]/, 'g')
	return str.toLowerCase().replace(firstAlphabet, (L) => L.toUpperCase())
}
