import { colorLog } from '../../../utils/defaultUtils/utils'
import * as fs from 'fs'
import * as path from 'path'
import ManifestParser from '../manifest-parser'
import type { PluginOption } from 'vite'
const { resolve } = path
const rootDir = process.cwd()
const distDir = resolve(rootDir, 'dist')
const publicDir = resolve(rootDir, 'public')

export default function makeManifest(
	manifest: chrome.runtime.ManifestV3,
	config: { isDev: boolean; contentScriptCssKey?: string }
): PluginOption {
	function makeManifest(to: string) {
		if (!fs.existsSync(to)) {
			fs.mkdirSync(to)
		}
		const manifestPath = resolve(to, 'manifest.json')

		if (config.contentScriptCssKey) {
			manifest.content_scripts.forEach(script => {
				if (script?.css && Array.isArray(script.css) && script.css.length > 0) {
					script.css = script.css.map(css => css.replace('<KEY>', config.contentScriptCssKey))
				}
			})
		}

		fs.writeFileSync(manifestPath, ManifestParser.convertManifestToString(manifest))

		colorLog(`Manifest file copy complete: ${manifestPath}`, 'success')
	}

	return {
		name: 'make-manifest',
		buildStart() {
			if (config.isDev) {
				makeManifest(distDir)
			}
		},
		buildEnd() {
			if (config.isDev) {
				return
			}
			makeManifest(publicDir)
		},
	}
}
