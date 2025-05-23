declare module '*.json' {
	const value: any
	export default value
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
