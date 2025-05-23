if (typeof self !== 'undefined') {
	try {
		const wasmPath = chrome.runtime.getURL('js/wasm/')
		console.log('Setting ONNX WASM path to:', wasmPath)

		const isServiceWorker = typeof window === 'undefined' || typeof window.document === 'undefined'

		const supportThreads = !isServiceWorker && navigator.hardwareConcurrency > 1

		self.ortWasmBackendFolder = wasmPath
		self.ortDisableThreads = !supportThreads

		console.log('ONNX Runtime environment configured in service worker with settings:', {
			wasmPath: self.ortWasmBackendFolder,
			isServiceWorker: isServiceWorker,
			hardwareConcurrency: navigator.hardwareConcurrency,
			supportThreads: supportThreads,
			threadsDisabled: self.ortDisableThreads,
		})
	} catch (err) {
		console.error('Failed to configure ONNX Runtime environment in service worker:', err)
	}
}
