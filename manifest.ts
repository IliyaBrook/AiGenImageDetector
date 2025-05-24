// @ts-ignore
import packageJson from './package.json'

const typedPackageJson = packageJson as typeof packageJson & { description: string }

const manifest: chrome.runtime.ManifestV3 = {
	name: 'AI Gen Image Detector',
	version: packageJson.version,
	description: typedPackageJson.description,
	manifest_version: 3,
	permissions: ['storage', 'scripting', 'tabs', 'notifications', 'activeTab'],
	icons: {
		'16': 'icon/16.png',
		'32': 'icon/32.png',
		'48': 'icon/48.png',
		'96': 'icon/96.png',
		'128': 'icon/128.png'
	},
	action: {
		default_popup: 'src/popup/index.html'
	},
	background: {
		service_worker: 'src/background/background.js',
		type: 'module',
	},
	content_scripts: [
		{
			matches: ['http://*/*', 'https://*/*', '<all_urls>'],
			js: ['src/content/content.js'],
			all_frames: true,
			match_about_blank: true,
			run_at: 'document_end'
		}
	],
	host_permissions: ['*://*/*'],
	content_security_policy: {
		extension_pages: "script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; object-src 'self'; connect-src 'self' https:; img-src 'self' data: https: blob:;"
	},
	web_accessible_resources: [
		{
			resources: [
				'src/logs/index.html',
				'models/*',
				'js/wasm/*',
				'js/*.js',
				'js/*.wasm',
				'src/background/*.js',
				'assets/*'
			],
			matches: ['<all_urls>']
		}
	],
	sandbox: {
		pages: []
	}
}

export default manifest
