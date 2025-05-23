/// <reference types="vite/client" />

declare module '*.json' {
	const content: string
	export default content
}

declare module '@public/js/ort.min.js' {
	export const InferenceSession: any

	const ort: any
	export default ort
}

declare module '*.svg' {
	import React = require('react')
	export const ReactComponent: React.SFC<React.SVGProps<SVGSVGElement>>
	const src: string
	export default src
}

declare module '*.jpg' {
	const content: string
	export default content
}

declare module '*.png' {
	const content: string
	export default content
}

type Self = Window & typeof globalThis

declare global {
	interface WorkerGlobalScope {
		ortWasmBackendFolder?: string
		ortDisableThreads?: boolean
	}
	interface Window {
		ortWasmBackendFolder?: string
		ortDisableThreads?: boolean
	}
}

declare module "@src/global" {
	const refreshOnUpdate: (watchPath: string) => void;
	export default refreshOnUpdate;
}

declare namespace chrome {
	export default Chrome
}

// declare module "virtual:reload-on-update-in-view" {
// 	const refreshOnUpdate: (watchPath: string) => void
// 	export default refreshOnUpdate
// }


