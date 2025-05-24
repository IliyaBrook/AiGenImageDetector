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

		const faceDetectionEnabled = await new Promise<boolean>(resolve => {
			chrome.storage.local.get(['faceDetectionEnabled'], (data: { faceDetectionEnabled?: boolean }) => {
				const enabled = data.faceDetectionEnabled !== false
				console.log('Background: Face detection enabled setting:', enabled)
				resolve(enabled)
			})
		})

		if (faceDetectionEnabled) {
			const isFaceDetected = await detectFacesAdvanced(imageData)
			if (!isFaceDetected) {
				console.log('Background: Skipping analysis - no faces detected in image')
				return {
					error: 'Skipped: No faces detected in image',
					isAIGenerated: false,
					confidence: 0,
				}
			} else {
				console.log('Background: Face detected, proceeding with AI analysis')
			}
		} else {
			console.log('Background: Face detection disabled, proceeding with AI analysis')
		}

		const preprocessedImage = await preprocessImage(imageData)
		const inputTensor = new ortLib.Tensor('float32', preprocessedImage, [1, 3, 224, 224])
		const feeds = {}
		feeds[ortSession.inputNames[0]] = inputTensor
		const results = await ortSession.run(feeds)

		const outputData = results[ortSession.outputNames[0]].data as Float32Array

		const applySoftmax = (logits: Float32Array): [number, number] => {
			const exp0 = Math.exp(logits[0])
			const exp1 = Math.exp(logits[1])
			const sum = exp0 + exp1
			return [exp0 / sum, exp1 / sum]
		}

		const applySigmoidDiff = (logits: Float32Array): [number, number] => {
			const diff = logits[0] - logits[1]
			const fakeProb = 1 / (1 + Math.exp(-diff))
			return [fakeProb, 1 - fakeProb]
		}

		let deepfakeScore: number
		let realScore: number

		if (outputData.length >= 2) {
			const [softmax0, softmax1] = applySoftmax(outputData)
			const [sigmoidFake, sigmoidReal] = applySigmoidDiff(outputData)

			console.log('Raw logits fake:', outputData[0])
			console.log('Raw logits real:', outputData[1])
			console.log('Softmax (0=fake, 1=real) fake:', softmax0)
			console.log('Softmax (0=fake, 1=real) real:', softmax1)
			console.log('Softmax (0=real, 1=fake) fake:', softmax1)
			console.log('Softmax (0=real, 1=fake) real:', softmax0)
			console.log('Sigmoid diff (fake-real): fake ', sigmoidFake)
			console.log('Sigmoid diff (fake-real): real ', sigmoidReal)

			const processingMethod = await new Promise<string>(resolve => {
				chrome.storage.local.get(['processingMethod'], (data: { processingMethod?: string }) => {
					resolve(data.processingMethod || 'inverted_softmax')
				})
			})

			if (processingMethod === 'inverted_softmax') {
				const testLogitDifference = outputData[0] - outputData[1]
				const testThreshold = 0.6

				if (testLogitDifference > testThreshold) {
					deepfakeScore = 0.2
					realScore = 0.8
				} else {
					deepfakeScore = 0.8
					realScore = 0.2
				}

				console.log(
					`Inverted: logit_diff=${testLogitDifference.toFixed(3)}, threshold=${testThreshold}, result=${testLogitDifference > testThreshold ? 'REAL' : 'FAKE'}`
				)
			} else if (processingMethod === 'adaptive') {
				deepfakeScore = softmax1
				realScore = softmax0

				const adaptiveLogitDiff = Math.abs(outputData[0] - outputData[1])
				if (adaptiveLogitDiff < 0.2) {
					deepfakeScore *= 0.8
					realScore *= 0.8
				} else if (adaptiveLogitDiff > 0.8) {
					deepfakeScore = Math.min(deepfakeScore * 1.1, 1.0)
					realScore = Math.min(realScore * 1.1, 1.0)
				}

				console.log('Adaptive: Using corrected interpretation (0=real, 1=fake)')
			} else {
				switch (processingMethod) {
					case 'softmax_0_real':
						deepfakeScore = softmax1
						realScore = softmax0
						break
					case 'softmax_0_fake':
						deepfakeScore = softmax0
						realScore = softmax1
						break
					case 'sigmoid_diff':
						const sigmoidLogitDiff = outputData[0] - outputData[1]
						const sigmoidValue = 1 / (1 + Math.exp(-sigmoidLogitDiff))

						if (sigmoidLogitDiff > 0.6) {
							deepfakeScore = 1 - sigmoidValue
							realScore = sigmoidValue
						} else if (sigmoidLogitDiff > 0.3) {
							deepfakeScore = 1 - sigmoidValue * 0.8
							realScore = sigmoidValue * 0.8
						} else {
							deepfakeScore = sigmoidValue
							realScore = 1 - sigmoidValue
						}
						console.log(
							`Sigmoid diff enhanced: logitDiff=${sigmoidLogitDiff.toFixed(3)}, sigmoid=${sigmoidValue.toFixed(3)}`
						)
						break
					case 'raw_logits':
						deepfakeScore = outputData[0] > 0 ? outputData[0] : 0
						realScore = outputData[1] > 0 ? outputData[1] : 0
						if (deepfakeScore + realScore === 0) {
							deepfakeScore = 0.5
							realScore = 0.5
						}
						break
				}
			}

			console.log(`Using processing method: ${processingMethod}`)
		} else {
			const logit = outputData[0]
			deepfakeScore = 1 / (1 + Math.exp(-logit))
			realScore = 1 - deepfakeScore
		}

		const mainLogitDiff = Math.abs(outputData[0] - outputData[1])
		const logitMax = Math.max(Math.abs(outputData[0]), Math.abs(outputData[1]))

		let adaptiveThreshold = 0.6

		if (mainLogitDiff > 0.5 && logitMax > 0.3) {
			adaptiveThreshold = 0.55
		} else if (mainLogitDiff < 0.2 || logitMax < 0.15) {
			adaptiveThreshold = 0.75
		}

		const userThreshold = await new Promise<number>(resolve => {
			chrome.storage.local.get(
				['confidenceThreshold'],
				(data: { confidenceThreshold?: number }) => {
					const threshold = data.confidenceThreshold || adaptiveThreshold
					console.log('Background: User confidence threshold:', data.confidenceThreshold, 'final threshold:', threshold)
					resolve(threshold)
				}
			)
		})

		const finalThreshold = userThreshold
		const confidence = Math.max(deepfakeScore, realScore)

		let isAIGenerated = false
		let decisionReason = ''

		const confidenceDiff = Math.abs(deepfakeScore - realScore)
		const isWeakSignal = confidenceDiff < 0.1

		if (isWeakSignal) {
			const weakSignalThreshold = 0.8
			if (deepfakeScore > realScore && deepfakeScore >= weakSignalThreshold) {
				isAIGenerated = true
				decisionReason = `Weak signal fake with high threshold (${deepfakeScore.toFixed(3)} >= ${weakSignalThreshold})`
			} else {
				isAIGenerated = false
				decisionReason = `Weak signal, classified as real (diff: ${confidenceDiff.toFixed(3)})`
			}
		} else {
			if (deepfakeScore > realScore) {
				if (deepfakeScore >= finalThreshold) {
					isAIGenerated = true
					decisionReason = `High confidence fake (${deepfakeScore.toFixed(3)} >= ${finalThreshold})`
				} else {
					isAIGenerated = false
					decisionReason = `Low confidence fake (${deepfakeScore.toFixed(3)} < ${finalThreshold})`
				}
			} else {
				isAIGenerated = false
				decisionReason = `Real predicted (real: ${realScore.toFixed(3)} > fake: ${deepfakeScore.toFixed(3)})`
			}
		}

		console.log('Background: Analysis complete:', {
			deepfakeScore: deepfakeScore.toFixed(3),
			realScore: realScore.toFixed(3),
			isAIGenerated,
			confidence: confidence.toFixed(3),
			confidenceDiff: confidenceDiff.toFixed(3),
			isWeakSignal,
			threshold: finalThreshold,
			adaptiveThreshold: adaptiveThreshold.toFixed(3),
			decisionReason,
			signalStrength: {
				logitDiff: mainLogitDiff.toFixed(3),
				logitMax: logitMax.toFixed(3),
			},
			rawLogits: { fake: outputData[0], real: outputData[1] },
		})

		const analysisDetails = {
			rawLogits: [outputData[0], outputData[1]],
			processingMethod: await new Promise<string>(resolve => {
				chrome.storage.local.get(['processingMethod'], (data: { processingMethod?: string }) => {
					resolve(data.processingMethod || 'inverted_softmax')
				})
			}),
			deepfakeScore,
			realScore,
			confidence,
			isAIGenerated,
		}

		return {
			isAIGenerated,
			confidence,
			...analysisDetails,
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

		if (message.type === 'TEST_PROCESSING_METHODS') {
			const { testData } = message

			const methods = [
				'inverted_softmax',
				'adaptive',
				'softmax_0_fake',
				'softmax_0_real',
				'sigmoid_diff',
				'raw_logits',
			]
			const results: Record<string, any> = {}

			for (const method of methods) {
				results[method] = {
					correct: 0,
					total: testData.length,
					predictions: [],
				}

				for (const data of testData) {
					const [logit0, logit1] = data.logits
					let deepfakeScore: number
					let realScore: number

					const exp0 = Math.exp(logit0)
					const exp1 = Math.exp(logit1)
					const sum = exp0 + exp1
					const softmax0 = exp0 / sum
					const softmax1 = exp1 / sum

					const diff = logit0 - logit1
					const sigmoidFake = 1 / (1 + Math.exp(-diff))
					const sigmoidReal = 1 - sigmoidFake

					switch (method) {
						case 'inverted_softmax':
							const testLogitDifference = logit0 - logit1
							const testThreshold = 0.6

							if (testLogitDifference > testThreshold) {
								deepfakeScore = 0.2
								realScore = 0.8
							} else {
								deepfakeScore = 0.8
								realScore = 0.2
							}
							break
						case 'adaptive':
							deepfakeScore = softmax1
							realScore = softmax0

							const logitDiff = Math.abs(logit0 - logit1)
							if (logitDiff < 0.2) {
								deepfakeScore *= 0.8
								realScore *= 0.8
							} else if (logitDiff > 0.8) {
								deepfakeScore = Math.min(deepfakeScore * 1.1, 1.0)
								realScore = Math.min(realScore * 1.1, 1.0)
							}
							break
						case 'softmax_0_real':
							deepfakeScore = softmax1
							realScore = softmax0
							break
						case 'softmax_0_fake':
							deepfakeScore = softmax0
							realScore = softmax1
							break
						case 'sigmoid_diff':
							const sigmoidLogitDiff = logit0 - logit1
							const sigmoidValue = 1 / (1 + Math.exp(-sigmoidLogitDiff))

							if (sigmoidLogitDiff > 0.6) {
								deepfakeScore = 1 - sigmoidValue
								realScore = sigmoidValue
							} else if (sigmoidLogitDiff > 0.3) {
								deepfakeScore = 1 - sigmoidValue * 0.8
								realScore = sigmoidValue * 0.8
							} else {
								deepfakeScore = sigmoidValue
								realScore = 1 - sigmoidValue
							}
							console.log(
								`Sigmoid diff enhanced: logitDiff=${sigmoidLogitDiff.toFixed(3)}, sigmoid=${sigmoidValue.toFixed(3)}`
							)
							break
						case 'raw_logits':
							deepfakeScore = logit0
							realScore = logit1
							break
					}

					const predicted = deepfakeScore > realScore
					const isCorrect = predicted === data.expected

					results[method].predictions.push({
						logits: data.logits,
						expected: data.expected,
						predicted,
						isCorrect,
						deepfakeScore: deepfakeScore.toFixed(3),
						realScore: realScore.toFixed(3),
					})

					if (isCorrect) results[method].correct++
				}

				results[method].accuracy = (
					(results[method].correct / results[method].total) *
					100
				).toFixed(1)
			}

			sendResponse({ success: true, results })
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

// Advanced face detection functions
async function detectFacesAdvanced(imageData: globalThis.ImageData): Promise<boolean> {
	try {
		const faceDetectionMethod = await new Promise<string>(resolve => {
			chrome.storage.local.get(['faceDetectionMethod'], (data: { faceDetectionMethod?: string }) => {
				resolve(data.faceDetectionMethod || 'enhanced_heuristic')
			})
		})

		console.log(`Background: Using face detection method: ${faceDetectionMethod}`)

		switch (faceDetectionMethod) {
			case 'mediapipe':
				return await detectFacesWithMediaPipe(imageData)
			case 'enhanced_heuristic':
			default:
				return await detectFacesEnhancedHeuristic(imageData)
		}
	} catch (error) {
		console.warn('Background: Error in face detection, proceeding with analysis:', error)
		return true // Default to true if detection fails
	}
}

async function detectFacesEnhancedHeuristic(imageData: globalThis.ImageData): Promise<boolean> {
	try {
		const { data, width, height } = imageData
		
		// Multi-stage detection approach
		const skinRegions = findSkinRegions(data, width, height)
		const eyeRegions = findEyeRegions(data, width, height)
		const faceSymmetry = analyzeFaceSymmetry(data, width, height)
		const faceProportions = analyzeFaceProportions(data, width, height)
		
		// Enhanced scoring system
		let faceScore = 0
		let maxScore = 0

		// Skin tone analysis (improved)
		if (skinRegions.totalSkinPixels > 0) {
			const skinRatio = skinRegions.totalSkinPixels / (width * height)
			const skinClustering = skinRegions.clusterScore
			
			if (skinRatio > 0.02 && skinRatio < 0.8) { // Lowered from 0.05 to 0.02, increased upper bound
				faceScore += Math.min(skinRatio * 30, 15) // Max 15 points
				if (skinClustering > 0.4) { // Lowered from 0.6 to 0.4
					faceScore += 10 // Clustered skin regions
				}
			}
		}
		maxScore += 25

		// Eye detection (much improved)
		if (eyeRegions.eyePairs > 0) {
			faceScore += eyeRegions.eyePairs * 20 // Strong indicator
			if (eyeRegions.eyeSymmetry > 0.5) { // Lowered from 0.7 to 0.5
				faceScore += 15 // Symmetric eye placement
			}
		}
		maxScore += 35

		// Face symmetry analysis
		if (faceSymmetry.horizontalSymmetry > 0.4) {
			faceScore += faceSymmetry.horizontalSymmetry * 15
		}
		if (faceSymmetry.verticalBalance > 0.3) {
			faceScore += faceSymmetry.verticalBalance * 10
		}
		maxScore += 25

		// Face proportions (golden ratio analysis)
		if (faceProportions.goldenRatioScore > 0.3) {
			faceScore += faceProportions.goldenRatioScore * 15
		}
		maxScore += 15

		const finalScore = faceScore / maxScore
		const threshold = 0.25 // Lowered threshold for much better sensitivity

		const hasFace = finalScore >= threshold

		console.log(`Background: Enhanced face detection - score: ${finalScore.toFixed(3)}, threshold: ${threshold}, has face: ${hasFace}`, {
			skinRegions: {
				ratio: (skinRegions.totalSkinPixels / (width * height)).toFixed(3),
				clusters: skinRegions.clusterScore.toFixed(3)
			},
			eyeRegions: {
				pairs: eyeRegions.eyePairs,
				symmetry: eyeRegions.eyeSymmetry.toFixed(3)
			},
			faceSymmetry: {
				horizontal: faceSymmetry.horizontalSymmetry.toFixed(3),
				vertical: faceSymmetry.verticalBalance.toFixed(3)
			},
			faceProportions: {
				goldenRatio: faceProportions.goldenRatioScore.toFixed(3)
			}
		})

		return hasFace
	} catch (error) {
		console.warn('Background: Error in enhanced heuristic face detection:', error)
		return true
	}
}

function findSkinRegions(data: Uint8ClampedArray, width: number, height: number) {
	let totalSkinPixels = 0
	const skinRegions: Array<{x: number, y: number}> = []
	
	// Multiple skin tone detection algorithms
	for (let y = 0; y < height; y += 2) {
		for (let x = 0; x < width; x += 2) {
			const index = (y * width + x) * 4
			const r = data[index]
			const g = data[index + 1]
			const b = data[index + 2]

			if (isSkinTone(r, g, b)) {
				totalSkinPixels++
				skinRegions.push({x, y})
			}
		}
	}

	// Analyze skin clustering
	const clusterScore = analyzeSkinClustering(skinRegions, width, height)

	return {
		totalSkinPixels,
		clusterScore,
		regions: skinRegions
	}
}

function isSkinTone(r: number, g: number, b: number): boolean {
	// Multiple skin detection algorithms combined
	
	// Algorithm 1: RGB bounds
	const rgb1 = r > 95 && g > 40 && b > 20 && 
		Math.max(r, g, b) - Math.min(r, g, b) > 15 && 
		Math.abs(r - g) > 15 && r > g && r > b

	// Algorithm 2: HSV conversion
	const max = Math.max(r, g, b)
	const min = Math.min(r, g, b)
	const delta = max - min
	
	let h = 0
	if (delta !== 0) {
		if (max === r) h = ((g - b) / delta) % 6
		else if (max === g) h = (b - r) / delta + 2
		else h = (r - g) / delta + 4
	}
	h = h * 60
	if (h < 0) h += 360

	const s = max === 0 ? 0 : delta / max
	const v = max / 255

	const hsv = h >= 0 && h <= 50 && s >= 0.23 && s <= 0.68 && v >= 0.35 && v <= 0.95

	// Algorithm 3: YCbCr color space
	const y = 0.299 * r + 0.587 * g + 0.114 * b
	const cb = -0.169 * r - 0.331 * g + 0.5 * b + 128
	const cr = 0.5 * r - 0.419 * g - 0.081 * b + 128
	
	const ycbcr = y > 80 && cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173

	// Combine algorithms
	return rgb1 || hsv || ycbcr
}

function analyzeSkinClustering(skinRegions: Array<{x: number, y: number}>, width: number, height: number): number {
	if (skinRegions.length < 5) return 0 // Lowered from 10 to 5

	// Analyze if skin pixels form clusters (faces) rather than scattered noise
	const gridSize = 20
	const gridWidth = Math.ceil(width / gridSize)
	const gridHeight = Math.ceil(height / gridSize)
	const grid = new Array(gridWidth * gridHeight).fill(0)

	// Count skin pixels in each grid cell
	for (const region of skinRegions) {
		const gridX = Math.floor(region.x / gridSize)
		const gridY = Math.floor(region.y / gridSize)
		const gridIndex = gridY * gridWidth + gridX
		if (gridIndex >= 0 && gridIndex < grid.length) {
			grid[gridIndex]++
		}
	}

	// Find cells with significant skin concentration
	const threshold = skinRegions.length / (gridWidth * gridHeight) * 5 // 5x average
	const clusteredCells = grid.filter(count => count > threshold).length
	const totalCells = gridWidth * gridHeight

	return Math.min(clusteredCells / totalCells * 4, 1) // Normalize to 0-1
}

function findEyeRegions(data: Uint8ClampedArray, width: number, height: number) {
	const eyeCandidates: Array<{x: number, y: number, strength: number}> = []
	
	// Look for dark circular regions (eyes)
	for (let y = 10; y < height - 10; y += 3) {
		for (let x = 10; x < width - 10; x += 3) {
			const eyeStrength = analyzeEyeCandidate(data, x, y, width, height)
			if (eyeStrength > 0.4) {
				eyeCandidates.push({x, y, strength: eyeStrength})
			}
		}
	}

	// Find eye pairs
	const eyePairs = findEyePairs(eyeCandidates, width)
	const eyeSymmetry = calculateEyeSymmetry(eyePairs, width, height)

	return {
		eyePairs: eyePairs.length,
		eyeSymmetry,
		candidates: eyeCandidates
	}
}

function analyzeEyeCandidate(data: Uint8ClampedArray, centerX: number, centerY: number, width: number, height: number): number {
	const radius = 4
	let darkCenter = 0
	let lightSurround = 0
	let centerPixels = 0
	let surroundPixels = 0

	// Analyze center (should be dark)
	for (let dy = -radius; dy <= radius; dy++) {
		for (let dx = -radius; dx <= radius; dx++) {
			const distance = Math.sqrt(dx * dx + dy * dy)
			if (distance <= radius / 2) {
				const x = centerX + dx
				const y = centerY + dy
				if (x >= 0 && x < width && y >= 0 && y < height) {
					const index = (y * width + x) * 4
					const brightness = (data[index] + data[index + 1] + data[index + 2]) / 3
					darkCenter += brightness
					centerPixels++
				}
			}
		}
	}

	// Analyze surrounding area (should be lighter)
	for (let dy = -radius * 2; dy <= radius * 2; dy++) {
		for (let dx = -radius * 2; dx <= radius * 2; dx++) {
			const distance = Math.sqrt(dx * dx + dy * dy)
			if (distance > radius && distance <= radius * 2) {
				const x = centerX + dx
				const y = centerY + dy
				if (x >= 0 && x < width && y >= 0 && y < height) {
					const index = (y * width + x) * 4
					const brightness = (data[index] + data[index + 1] + data[index + 2]) / 3
					lightSurround += brightness
					surroundPixels++
				}
			}
		}
	}

	if (centerPixels === 0 || surroundPixels === 0) return 0

	const avgCenter = darkCenter / centerPixels
	const avgSurround = lightSurround / surroundPixels

	// Eye should have dark center and lighter surround
	const contrast = (avgSurround - avgCenter) / 255
	return Math.max(0, Math.min(1, contrast))
}

function findEyePairs(eyeCandidates: Array<{x: number, y: number, strength: number}>, width: number) {
	const pairs: Array<{left: any, right: any}> = []
	
	for (let i = 0; i < eyeCandidates.length; i++) {
		for (let j = i + 1; j < eyeCandidates.length; j++) {
			const eye1 = eyeCandidates[i]
			const eye2 = eyeCandidates[j]
			
			const distance = Math.sqrt((eye1.x - eye2.x) ** 2 + (eye1.y - eye2.y) ** 2)
			const avgY = (eye1.y + eye2.y) / 2
			const yDiff = Math.abs(eye1.y - eye2.y)
			
			// Eyes should be horizontally aligned and reasonable distance apart
			if (distance > width * 0.1 && distance < width * 0.6 && yDiff < distance * 0.3) {
				pairs.push({
					left: eye1.x < eye2.x ? eye1 : eye2,
					right: eye1.x < eye2.x ? eye2 : eye1
				})
			}
		}
	}
	
	return pairs
}

function calculateEyeSymmetry(eyePairs: Array<{left: any, right: any}>, width: number, height: number): number {
	if (eyePairs.length === 0) return 0

	let symmetryScore = 0
	for (const pair of eyePairs) {
		const centerX = (pair.left.x + pair.right.x) / 2
		const faceCenter = width / 2
		const symmetry = 1 - Math.abs(centerX - faceCenter) / (width / 2)
		
		const yAlignment = 1 - Math.abs(pair.left.y - pair.right.y) / height
		
		symmetryScore += (symmetry + yAlignment) / 2
	}
	
	return symmetryScore / eyePairs.length
}

function analyzeFaceSymmetry(data: Uint8ClampedArray, width: number, height: number) {
	// Analyze horizontal symmetry (left vs right side)
	let leftBrightness = 0
	let rightBrightness = 0
	let pixelCount = 0

	const centerX = width / 2
	
	for (let y = 0; y < height; y += 4) {
		for (let x = 0; x < centerX; x += 4) {
			const leftIndex = (y * width + x) * 4
			const rightIndex = (y * width + (width - 1 - x)) * 4
			
			if (leftIndex < data.length - 3 && rightIndex < data.length - 3) {
				const leftBright = (data[leftIndex] + data[leftIndex + 1] + data[leftIndex + 2]) / 3
				const rightBright = (data[rightIndex] + data[rightIndex + 1] + data[rightIndex + 2]) / 3
				
				leftBrightness += leftBright
				rightBrightness += rightBright
				pixelCount++
			}
		}
	}

	const horizontalSymmetry = pixelCount > 0 ? 
		1 - Math.abs(leftBrightness - rightBrightness) / (leftBrightness + rightBrightness) : 0

	// Analyze vertical balance (top vs bottom)
	let topBrightness = 0
	let bottomBrightness = 0
	const centerY = height / 2
	let verticalPixels = 0

	for (let y = 0; y < centerY; y += 4) {
		for (let x = 0; x < width; x += 4) {
			const topIndex = (y * width + x) * 4
			const bottomIndex = ((height - 1 - y) * width + x) * 4
			
			if (topIndex < data.length - 3 && bottomIndex < data.length - 3) {
				const topBright = (data[topIndex] + data[topIndex + 1] + data[topIndex + 2]) / 3
				const bottomBright = (data[bottomIndex] + data[bottomIndex + 1] + data[bottomIndex + 2]) / 3
				
				topBrightness += topBright
				bottomBrightness += bottomBright
				verticalPixels++
			}
		}
	}

	const verticalBalance = verticalPixels > 0 ? 
		1 - Math.abs(topBrightness - bottomBrightness) / (topBrightness + bottomBrightness) : 0

	return {
		horizontalSymmetry: Math.max(0, horizontalSymmetry),
		verticalBalance: Math.max(0, verticalBalance)
	}
}

function analyzeFaceProportions(data: Uint8ClampedArray, width: number, height: number) {
	// Analyze if the image has face-like proportions using golden ratio
	const aspectRatio = width / height
	const goldenRatio = 1.618
	
	// Face ideal proportions
	const idealFaceRatio = 1.4 // Slightly less than golden ratio
	const ratioDeviation = Math.abs(aspectRatio - idealFaceRatio) / idealFaceRatio
	const goldenRatioScore = Math.max(0, 1 - ratioDeviation)

	return {
		aspectRatio,
		goldenRatioScore
	}
}

// MediaPipe Face Detection (modern approach)
let faceDetectionModel: any = null
let isLoadingFaceModel = false

async function detectFacesWithMediaPipe(imageData: globalThis.ImageData): Promise<boolean> {
	try {
		// Load model if not loaded
		if (!faceDetectionModel && !isLoadingFaceModel) {
			isLoadingFaceModel = true
			try {
				// Try to import face detection dynamically (may fail in service worker)
				// @ts-ignore - Optional import that may not be available
				const faceDetection = await import('@tensorflow-models/face-detection').catch(() => null)
				
				if (!faceDetection) {
					console.warn('Background: Face detection module not available, using heuristic method')
					isLoadingFaceModel = false
					return await detectFacesEnhancedHeuristic(imageData)
				}
				
				const model = faceDetection.SupportedModels.MediaPipeFaceDetector
				const detectorConfig = {
					runtime: 'tfjs' as const,
					maxFaces: 5,
					refineLandmarks: false
				}
				
				faceDetectionModel = await faceDetection.createDetector(model, detectorConfig)
				console.log('Background: MediaPipe face detection model loaded')
			} catch (error) {
				console.warn('Background: Failed to load MediaPipe face detection, falling back to heuristic:', error)
				isLoadingFaceModel = false
				return await detectFacesEnhancedHeuristic(imageData)
			} finally {
				isLoadingFaceModel = false
			}
		}

		if (!faceDetectionModel) {
			return await detectFacesEnhancedHeuristic(imageData)
		}

		// Convert ImageData to format expected by face detection
		const canvas = new OffscreenCanvas(imageData.width, imageData.height)
		const ctx = canvas.getContext('2d')
		if (!ctx) throw new Error('Failed to get canvas context')
		
		ctx.putImageData(imageData, 0, 0)

		// Detect faces
		const faces = await faceDetectionModel.estimateFaces(canvas)
		
		const hasFaces = faces && faces.length > 0
		
		console.log(`Background: MediaPipe face detection - detected ${faces?.length || 0} faces, has faces: ${hasFaces}`)
		
		return hasFaces
	} catch (error) {
		console.warn('Background: MediaPipe face detection error, falling back to heuristic:', error)
		return await detectFacesEnhancedHeuristic(imageData)
	}
}
