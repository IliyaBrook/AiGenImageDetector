import '../background/onnx-init.js'
//@ts-ignore
import * as ort from 'onnxruntime-web/all'
declare const chrome: any

let ortSession: any = null
let ortLib: any = null
let isInitialized = false
let isInitializing = false
let initError: Error | null = null

const MODEL_URL = chrome.runtime.getURL('models/deepfake-detection.onnx')
const WASM_PATH = chrome.runtime.getURL('js/wasm/')

interface AnalysisResult {
	isAIGenerated: boolean
	confidence: number
	error?: string
}

async function initOnnxWasmEnvironment() {
	const isServiceWorker = typeof window === 'undefined' || typeof window.document === 'undefined'
	const supportThreads = !isServiceWorker && navigator.hardwareConcurrency > 1
    
	if (typeof self !== 'undefined') {
		//@ts-ignore
		self.ortWasmBackendFolder = WASM_PATH
		//@ts-ignore
		self.ortDisableThreads = !supportThreads
	}

	if (typeof globalThis !== 'undefined') {
		globalThis.ortWasmBackendFolder = WASM_PATH
		globalThis.ortDisableThreads = !supportThreads
	}
	return {
		wasmPaths: WASM_PATH,
		enableThreads: supportThreads,
		numThreads: supportThreads ? Math.min(navigator.hardwareConcurrency - 1, 4) : 1,
	}
}

async function loadOnnxRuntime() {
	try {
		if (
			!ort ||
			typeof ort !== 'object' ||
			!ort.InferenceSession ||
			typeof ort.InferenceSession.create !== 'function'
		) {
			throw new Error(
				"ONNX Runtime (ort) is loaded but doesn't have required properties or methods. Check if the correct version is imported."
			)
		}

		return ort
	} catch (err) {
		console.error('Background: Failed to prepare ONNX runtime:', err)
		throw err
	}
}

async function loadOnnxModel(currentOrtLib: any, options: any): Promise<any> {
	try {
		const modelArrayBuffer = await fetch(MODEL_URL).then(response => {
			if (!response.ok) {
				throw new Error(`Failed to fetch model: ${response.status} ${response.statusText}`)
			}
			return response.arrayBuffer()
		})
		const session = await currentOrtLib.InferenceSession.create(
			new Uint8Array(modelArrayBuffer),
			options
		)
		return session
	} catch (error) {
		console.error('Failed to load ONNX model:', error)
		throw error
	}
}

async function initializeOnnx() {
	if (isInitialized) return true
	if (isInitializing) {
		return new Promise(resolve => {
			const interval = setInterval(() => {
				if (isInitialized || initError) {
					clearInterval(interval)
					resolve(isInitialized)
				}
			}, 100)
		})
	}

	isInitializing = true
	initError = null

	try {

		const wasmConfig = await initOnnxWasmEnvironment()
		console.log('Background: WASM environment configured', wasmConfig)

		ortLib = await loadOnnxRuntime()
		console.log('Background: ONNX Runtime loaded', ortLib)

		const options = {
			executionProviders: ['webnn', 'wasm'],
			graphOptimizationLevel: 'all',
			enableCpuMemArena: true,
			wasmPaths: wasmConfig.wasmPaths,
		}

		console.log('Background: Creating ONNX session with options', options)

		ortSession = await loadOnnxModel(ortLib, options)
		console.log('Background: ONNX Model loaded and session created')

		isInitialized = true
		isInitializing = false
		console.log('Background: ONNX initialization successful')
		return true
	} catch (err: any) {
		isInitializing = false
		initError = err
		console.error('Background: ONNX Initialization failed:', err)
		return false
	}
}

async function loadImageFromUrl(url: string): Promise<ImageBitmap | HTMLImageElement | null> {
	try {
		if (url.startsWith('blob:')) {
			return fetch(url)
				.then(response => response.blob())
				.then(blob => createImageBitmap(blob))
		}

		if (url.startsWith('data:image/')) {
			return new Promise((resolve, reject) => {
				const img = new Image()
				img.onload = () => resolve(img)
				img.onerror = e => reject(new Error(`Failed to load data URL image: ${e}`))
				img.src = url
			})
		}
		const response = await fetch(url, { mode: 'cors' })
		const blob = await response.blob()
		return createImageBitmap(blob)
	} catch (error) {
		console.warn(
			'loadImageFromUrl: Fetch/ImageBitmap failed, trying direct Image load for URL:',
			url,
			error
		)
		return new Promise((resolve, reject) => {
			const img = new Image()
			if (url.startsWith('http')) {
				img.crossOrigin = 'anonymous'
			}
			img.onload = () => resolve(img)
			img.onerror = e => reject(new Error(`Failed to load image from URL ${url}: ${e}`))
			img.src = url
		})
	}
}

function imageToImageData(img: ImageBitmap | HTMLImageElement): ImageData | null {
	if (typeof OffscreenCanvas !== 'undefined') {
		try {
			const canvas = new OffscreenCanvas(
				img instanceof ImageBitmap ? img.width : img.naturalWidth || img.width,
				img instanceof ImageBitmap ? img.height : img.naturalHeight || img.height
			)
			const ctx = canvas.getContext('2d')
			if (!ctx) {
				console.error('Failed to get OffscreenCanvas 2D context')
				return null
			}
			ctx.drawImage(img, 0, 0)

			return ctx.getImageData(0, 0, canvas.width, canvas.height)
		} catch (e) {
			console.error('Error using OffscreenCanvas:', e)
			return null
		}
	} else {
		console.warn('OffscreenCanvas is not available. Image processing might be unreliable or fail.')
		try {
			const canvas = document.createElement('canvas')
			canvas.width = img instanceof ImageBitmap ? img.width : img.naturalWidth || img.width
			canvas.height = img instanceof ImageBitmap ? img.height : img.naturalHeight || img.height
			const ctx = canvas.getContext('2d')
			if (!ctx) {
				console.error('Failed to get HTMLCanvasElement 2D context')
				return null
			}
			ctx.drawImage(img, 0, 0)

			return ctx.getImageData(0, 0, canvas.width, canvas.height)
		} catch (e) {
			console.error("Error using document.createElement('canvas'):", e)
			return null
		}
	}
}

async function preprocessImage(imageData: globalThis.ImageData): Promise<Float32Array> {
	const size = 224
	const { width, height } = imageData

	if (typeof OffscreenCanvas === 'undefined') {
		console.error('OffscreenCanvas is required for preprocessing but not available.')
		throw new Error('OffscreenCanvas unavailable for image preprocessing.')
	}

	const canvas = new OffscreenCanvas(size, size)
	const ctx = canvas.getContext('2d')
	if (!ctx) throw new Error('Failed to get 2D context for preprocessing canvas')

	if (typeof self.createImageBitmap === 'function') {
		try {
			const bitmap = await self.createImageBitmap(imageData)
			ctx.drawImage(bitmap, 0, 0, width, height, 0, 0, size, size)
			bitmap.close()
			const resized = ctx.getImageData(0, 0, size, size)
			return normalizeAndConvert(resized.data, size)
		} catch (err) {
			console.error('Error creating ImageBitmap for preprocessing:', err)
			throw err
		}
	} else {
		const tempCanvas = new OffscreenCanvas(width, height)
		const tempCtx = tempCanvas.getContext('2d')
		if (!tempCtx) throw new Error('Failed to get 2D context for temporary canvas')
		tempCtx.putImageData(imageData, 0, 0)
		ctx.drawImage(tempCanvas, 0, 0, width, height, 0, 0, size, size)
		const resized = ctx.getImageData(0, 0, size, size)
		return normalizeAndConvert(resized.data, size)
	}
}

function normalizeAndConvert(data: Uint8ClampedArray, size: number): Float32Array {
	const floatData = new Float32Array(3 * size * size)
	for (let i = 0; i < size * size; i++) {
		floatData[i] = data[i * 4] / 255
		floatData[i + size * size] = data[i * 4 + 1] / 255
		floatData[i + 2 * size * size] = data[i * 4 + 2] / 255
	}
	return floatData
}

// not used for now
async function detectFaces(imageData: globalThis.ImageData): Promise<boolean> {
	try {
		const { data, width, height } = imageData

		const centerX = Math.floor(width / 2)
		const centerY = Math.floor(height / 2)
		const regionSize = Math.min(width, height) / 4

		let skinTonePixels = 0
		let totalPixels = 0

		for (
			let y = Math.max(0, centerY - regionSize);
			y < Math.min(height, centerY + regionSize);
			y++
		) {
			for (
				let x = Math.max(0, centerX - regionSize);
				x < Math.min(width, centerX + regionSize);
				x++
			) {
				const index = (y * width + x) * 4
				const r = data[index]
				const g = data[index + 1]
				const b = data[index + 2]

				if (
					r > 95 &&
					g > 40 &&
					b > 20 &&
					Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
					Math.abs(r - g) > 15 &&
					r > g &&
					r > b
				) {
					skinTonePixels++
				}
				totalPixels++
			}
		}

		const skinToneRatio = skinTonePixels / totalPixels
		const hasFace = skinToneRatio > 0.1

		console.log(
			`Background: Face detection - skin tone ratio: ${skinToneRatio.toFixed(3)}, has face: ${hasFace}`
		)
		return hasFace
	} catch (error) {
		console.warn('Background: Error in face detection, proceeding with analysis:', error)
		return true
	}
}

// not used for now
async function isPhotographicImage(imageData: globalThis.ImageData): Promise<boolean> {
	try {
		const { data, width, height } = imageData

		const colorSet = new Set<string>()
		let gradientSum = 0
		let gradientCount = 0

		for (let y = 0; y < height; y += 10) {
			for (let x = 0; x < width; x += 10) {
				const index = (y * width + x) * 4
				const r = data[index]
				const g = data[index + 1]
				const b = data[index + 2]

				const color = `${Math.floor(r / 8) * 8}-${Math.floor(g / 8) * 8}-${Math.floor(b / 8) * 8}`
				colorSet.add(color)

				if (x < width - 10 && y < height - 10) {
					const nextXIndex = (y * width + x + 10) * 4
					const nextYIndex = ((y + 10) * width + x) * 4

					const gradX = Math.abs(data[index] - data[nextXIndex])
					const gradY = Math.abs(data[index] - data[nextYIndex])
					gradientSum += gradX + gradY
					gradientCount++
				}
			}
		}

		const uniqueColors = colorSet.size
		const avgGradient = gradientCount > 0 ? gradientSum / gradientCount : 0
		const sampledPixels = Math.ceil(width / 10) * Math.ceil(height / 10)
		const colorDiversity = uniqueColors / sampledPixels

		const isPhoto = colorDiversity > 0.3 && avgGradient > 5

		console.log(
			`Background: Image type analysis - colors: ${uniqueColors}, diversity: ${colorDiversity.toFixed(3)}, gradient: ${avgGradient.toFixed(1)}, is photo: ${isPhoto}`
		)
		return isPhoto
	} catch (error) {
		console.warn('Background: Error in image type detection, proceeding with analysis:', error)
		return true
	}
}

async function analyzeImageWithOnnx(imageUrlOrData: string): Promise<AnalysisResult> {
	try {
		if (!isInitialized) {
			console.log('Background: ONNX not initialized, initializing now...')
			if (!(await initializeOnnx())) {
				console.error('Background: Failed to initialize ONNX:', initError)
				return {
					error: `Failed to initialize ONNX Runtime: ${initError?.message || 'Unknown error'}`,
					isAIGenerated: false,
					confidence: 0,
				}
			}
		}

		if (!ortSession || !ortLib) {
			console.error('Background: ONNX session or library not available after initialization')
			return {
				error: 'ONNX session or library not available',
				isAIGenerated: false,
				confidence: 0,
			}
		}

		const image = await loadImageFromUrl(imageUrlOrData)
		if (!image) {
			console.error('Background: Failed to load image')
			return {
				error: 'Failed to load image',
				isAIGenerated: false,
				confidence: 0,
			}
		}

		const imageData = imageToImageData(image)
		if (!imageData) {
			console.error('Background: Failed to convert image to ImageData')
			return {
				error: 'Failed to convert image to ImageData',
				isAIGenerated: false,
				confidence: 0,
			}
		}
		console.log('Background: Image converted to ImageData', {
			width: imageData.width,
			height: imageData.height,
		})
        // Todo rm this fund for now
		// const isPhoto = await isPhotographicImage(imageData)
		// if (!isPhoto) {
		// 	console.log(
		// 		'Background: Skipping analysis - image appears to be a graphic/drawing, not a photograph'
		// 	)
		// 	return {
		// 		isAIGenerated: false,
		// 		confidence: 0,
		// 		error: 'Skipped: Not a photographic image',
		// 	}
		// }

		// const hasFaces = await detectFaces(imageData)
		// if (!hasFaces) {
		// 	console.log('Background: Skipping analysis - no faces detected in image')
		// 	return {
		// 		isAIGenerated: false,
		// 		confidence: 0,
		// 		error: 'Skipped: No faces detected',
		// 	}
		// }

		const preprocessedImage = await preprocessImage(imageData)
		const inputTensor = new ortLib.Tensor('float32', preprocessedImage, [1, 3, 224, 224])
		const feeds = {}
		feeds[ortSession.inputNames[0]] = inputTensor
		const results = await ortSession.run(feeds)

		const outputData = results[ortSession.outputNames[0]].data as Float32Array

		let deepfakeScore: number
		let realScore: number

		if (outputData.length >= 2) {
			deepfakeScore = outputData[0]
			realScore = outputData[1]
		} else {
			const logit = outputData[0]
			deepfakeScore = 1 / (1 + Math.exp(-logit))
			realScore = 1 - deepfakeScore
		}

		const confidence = deepfakeScore
		const isAIGenerated = deepfakeScore > realScore

		console.log('Background: Analysis complete', {
			deepfakeScore: deepfakeScore.toFixed(3),
			realScore: realScore.toFixed(3),
			isAIGenerated,
			confidence: confidence.toFixed(3),
		})

		return {
			isAIGenerated,
			confidence,
		}
	} catch (error: any) {
		console.error('Background: Error during image analysis:', error)
		return {
			error: `Image analysis error: ${error?.message || error?.toString() || 'Unknown error'}`,
			isAIGenerated: false,
			confidence: 0,
		}
	}
}

function saveToLog(logEntry: any) {
	chrome.storage.local.get(['analyzeLogs'], (data: { analyzeLogs?: any[] }) => {
		const logs = Array.isArray(data.analyzeLogs) ? data.analyzeLogs : []
		logs.unshift(logEntry)
		if (logs.length > 100) logs.length = 100
		chrome.storage.local.set({ analyzeLogs: logs })
	})
}

chrome.runtime.onMessage.addListener(
	(message: any, sender: any, sendResponse: (response?: any) => void) => {
		if (message.type === 'ANALYZE_IMAGE_REQUEST') {
			chrome.storage.local.get(['analyzeEnabled'], (data: { analyzeEnabled?: boolean }) => {
				if (data.analyzeEnabled === false) {
					console.log('Background: AI Image Analysis is disabled in settings. Skipping analysis.')
					sendResponse({
						type: 'ANALYSIS_RESULT',
						result: { error: 'Analysis disabled in settings', isAIGenerated: false, confidence: 0 },
						requestId: message.requestId,
					})
					return
				}

				const { imageUrl, imageData, requestId } = message
				const analysisUrl = imageUrl || imageData

				if (!analysisUrl) {
					sendResponse({
						type: 'ANALYSIS_RESULT',
						result: { error: 'No image data or URL provided', isAIGenerated: false, confidence: 0 },
						requestId,
					})
					return
				}

				;(async () => {
					try {
						console.log(
							`Background: Received image analysis request (ID: ${requestId}) for:`,
							typeof analysisUrl === 'string'
								? analysisUrl.substring(0, 100) + '...'
								: '[imageData]'
						)
						const result = await analyzeImageWithOnnx(analysisUrl)

						saveToLog({
							time: new Date().toISOString(),
							imageUrl:
								imageUrl ||
								(typeof imageData === 'string' && imageData.startsWith('data:')
									? 'base64_data'
									: 'unknown_source'),
							isAIGenerated: result.error ? undefined : result.isAIGenerated,
							confidence: result.error ? undefined : result.confidence,
							error: result.error,
							requestId,
						})

						sendResponse({ type: 'ANALYSIS_RESULT', result, requestId })
					} catch (error: any) {
						console.error(
							`Background: Error processing ANALYZE_IMAGE_REQUEST (ID: ${requestId}):`,
							error
						)
						sendResponse({
							type: 'ANALYSIS_RESULT',
							result: {
								error: error.message || 'Unknown analysis error',
								isAIGenerated: false,
								confidence: 0,
							},
							requestId,
						})
					}
				})()
			})
			return true
		}

		if (message.type === 'GET_MODEL_DATA') {
			console.warn('Background: GET_MODEL_DATA is deprecated. Analysis is now done in background.')
			sendResponse({
				success: false,
				error: 'Deprecated: Model analysis is handled by the background script.',
			})
			return false
		}

		if (message.type === 'LOG_ANALYSIS_RESULT') {
			const { result, imageUrl } = message
			if (!result.error) {
				saveToLog({
					time: new Date().toISOString(),
					imageUrl: imageUrl || sender?.tab?.url || 'unknown_url',
					isAIGenerated: result.isAIGenerated,
					confidence: result.confidence,
					source: 'external',
				})
			}
			sendResponse({ success: true })
			return false
		}

		if (message.type === 'GET_ONNX_STATUS') {
			const isOrtValid =
				ortLib &&
				typeof ortLib.InferenceSession === 'object' &&
				typeof ortLib.InferenceSession.create === 'function'

			sendResponse({
				initialized: isInitialized && isOrtValid,
				initializing: isInitializing,
				error: initError
					? initError.message
					: isInitialized && !isOrtValid
						? 'ONNX Runtime loaded but InferenceSession.create not available'
						: null,
			})
			return false
		}

		return false
	}
)

initializeOnnx()
	.then(success => {
		console.log('Background: ONNX initialization on startup:', success ? 'successful' : 'failed')
		if (!success && initError) {
			console.error('Background: Startup initialization error:', initError)
		}
	})
	.catch(error => {
		console.error('Background: Uncaught error during startup ONNX initialization:', error)
	})

chrome.runtime.onInstalled.addListener(() => {
	console.log('AI Image Detector extension installed/updated.')
})