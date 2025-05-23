console.log('AI Gen Image Detector content script loaded.')
interface AnalysisResult {
	isAIGenerated: boolean
	confidence: number
	error?: string
}

type ImageDataCallback = (result: AnalysisResult) => void

let isAnalyzing = false
let pendingAnalyses: Array<{
	img: HTMLImageElement
	callback: ImageDataCallback
	requestId: string
}> = []

const getImageRepresentation = async (img: HTMLImageElement): Promise<string | null> => {
	if (
		!img.complete ||
		img.naturalWidth === 0 ||
		img.width < 32 ||
		img.height < 32 ||
		img.src.startsWith('data:image/svg')
	) {
		return null
	}

	if (img.src.startsWith('data:image/')) {
		if (img.src.length > 1024) {
			return img.src
		} else {
			return null
		}
	}

	if (
		img.src &&
		(img.src.startsWith('http:') || img.src.startsWith('https:') || img.src.startsWith('blob:'))
	) {
		return img.src
	}

	try {
		const image = new Image()
		image.crossOrigin = 'Anonymous'
		image.src = img.src

		await new Promise((resolve, reject) => {
			image.onload = resolve
			image.onerror = () =>
				reject(new Error(`Could not load image for base64 conversion: ${img.src}`))

			setTimeout(
				() => reject(new Error(`Timeout loading image for base64 conversion: ${img.src}`)),
				5000
			)
		})

		const canvas = document.createElement('canvas')
		canvas.width = image.naturalWidth
		canvas.height = image.naturalHeight
		const ctx = canvas.getContext('2d')
		if (!ctx) return null
		ctx.drawImage(image, 0, 0)

		const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
		return dataUrl.length > 1024 ? dataUrl : null
	} catch (error) {
		console.warn('ContentScript: Error getting image base64 representation:', error, img.src)

		if (
			img.src &&
			(img.src.startsWith('http:') || img.src.startsWith('https:') || img.src.startsWith('blob:'))
		) {
			return img.src
		}
		return null
	}
}

const analyzeImage = async (img: HTMLImageElement): Promise<AnalysisResult> => {
	return new Promise(async resolve => {
		const requestId = `cs-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
		const imageRepresentation = await getImageRepresentation(img)

		if (!imageRepresentation) {
			resolve({ isAIGenerated: false, confidence: 0, error: 'Invalid image or too small' })
			return
		}

		const callback = (result: AnalysisResult) => {
			console.log(`ContentScript: Callback executed for ${requestId} with result:`, result)

			if (result && !result.error && result.isAIGenerated) {
				console.log(
					`ContentScript: Calling addLabelToImage from callback for ${img.src.substring(0, 60)}...`
				)
				try {
					addLabelToImage(img, result.isAIGenerated, result.confidence)
				} catch (error) {
					console.error('ContentScript: Error in callback addLabelToImage:', error)
				}
			}

			resolve(result)
		}

		console.log(
			`ContentScript: Adding pending analysis with requestId ${requestId} for img:`,
			img.src
		)
		pendingAnalyses.push({ img, callback, requestId })

		console.log(
			`ContentScript: Sending ANALYZE_IMAGE_REQUEST for ${requestId}, url: ${
				imageRepresentation.startsWith('data:image/')
					? 'data:image/...'
					: imageRepresentation.substring(0, 60) + '...'
			}`
		)

		chrome.runtime.sendMessage(
			{
				type: 'ANALYZE_IMAGE_REQUEST',
				[imageRepresentation.startsWith('data:image/') ? 'imageData' : 'imageUrl']:
					imageRepresentation,
				requestId: requestId,
			},
			response => {
				if (chrome.runtime.lastError) {
					console.error(
						`ContentScript: Error sending message to background for ${requestId}: ${chrome.runtime.lastError.message}`
					)

					const requestIndex = pendingAnalyses.findIndex(p => p.requestId === requestId)
					if (requestIndex !== -1) {
						const [{ callback: cb }] = pendingAnalyses.splice(requestIndex, 1)
						cb({
							isAIGenerated: false,
							confidence: 0,
							error: `Communication error: ${chrome.runtime.lastError.message}`,
						})
					}
					return
				}

				console.log(`ContentScript: Message for ${requestId} sent, background response:`, response)

				if (response && response.type === 'ANALYSIS_RESULT' && response.result) {
					console.log(
						`ContentScript: Got immediate result in sendMessage callback for ${requestId}`
					)
					const requestIndex = pendingAnalyses.findIndex(p => p.requestId === requestId)
					if (requestIndex !== -1) {
						const [{ callback: cb }] = pendingAnalyses.splice(requestIndex, 1)
						cb(response.result)
					}
				} else if (response && response.error) {
					console.error(
						`ContentScript: Background returned initial error for ${requestId}: ${response.error}`
					)
					const requestIndex = pendingAnalyses.findIndex(p => p.requestId === requestId)
					if (requestIndex !== -1) {
						const [{ callback: cb }] = pendingAnalyses.splice(requestIndex, 1)
						cb({
							isAIGenerated: false,
							confidence: 0,
							error: `Background error: ${response.error}`,
						})
					}
				}
			}
		)
	})
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	console.log('ContentScript: Received message:', message)

	if (message.type === 'ANALYSIS_RESULT' && message.requestId) {
		console.log(`ContentScript: Received ANALYSIS_RESULT for ${message.requestId}:`, message.result)

		const requestIndex = pendingAnalyses.findIndex(p => p.requestId === message.requestId)
		console.log(
			`ContentScript: Found pending analysis? ${requestIndex !== -1}, pendingAnalyses:`,
			pendingAnalyses.map(p => p.requestId)
		)

		if (requestIndex !== -1) {
			const [{ callback, img }] = pendingAnalyses.splice(requestIndex, 1)
			console.log(
				`ContentScript: Found pending analysis for request ${message.requestId}, calling callback for img:`,
				img.src
			)

			callback(message.result)

			if (img && message.result && !message.result.error && message.result.isAIGenerated) {
				console.log(
					`ContentScript: Directly calling addLabelToImage from message handler for ${img.src}`
				)
				try {
					setTimeout(() => {
						try {
							addLabelToImage(img, message.result.isAIGenerated, message.result.confidence)
						} catch (innerErr) {
							console.error('ContentScript: Error in delayed addLabelToImage:', innerErr)
						}
					}, 500)
				} catch (err) {
					console.error('ContentScript: Error in direct call to addLabelToImage:', err)
				}
			}
		} else {
			console.warn(
				`ContentScript: Received ANALYSIS_RESULT for unknown requestId: ${message.requestId}`
			)
		}
		sendResponse({ received: true })
		return true
	}
	return false
})

const addLabelToImage = (
	img: HTMLImageElement,
	isAIGenerated: boolean,
	confidence: number
): void => {
	console.log(
		`ContentScript: Adding label to image: isAIGenerated=${isAIGenerated}, confidence=${confidence}`,
		img.src
	)

	if (!isAIGenerated) {
		console.log('ContentScript: Image is real, skipping label')
		return
	}

	console.log(
		`ContentScript: Image is AI-generated with confidence ${confidence}, will add robot icon`
	)

	if (!document.body) {
		console.error('ContentScript: Cannot access document.body to add label')
		return
	}

	try {
		if (img.dataset.aiDetectorLabel) {
			console.log(
				`ContentScript: Label already exists for this image (${img.dataset.aiDetectorLabel})`
			)
			return
		}

		const addIconWithDelay = () => {
			console.log(`ContentScript: Executing addIconWithDelay for ${img.src}`)

			const labelId = `ai-detector-label-${Date.now()}-${Math.random().toString(16).slice(2)}`
			img.dataset.aiDetectorLabel = labelId
			console.log(`ContentScript: Created new label ID: ${labelId}`)

			const icon = document.createElement('div')
			icon.id = labelId

			icon.style.position = 'absolute'
			icon.style.width = '24px'
			icon.style.height = '24px'
			icon.style.backgroundColor = 'red'
			icon.style.borderRadius = '50%'
			icon.style.zIndex = '2147483647'
			icon.style.pointerEvents = 'none'
			icon.style.boxShadow = '0 0 5px rgba(0,0,0,0.7)'

			icon.innerHTML = '&#129302;'
			icon.style.display = 'flex'
			icon.style.alignItems = 'center'
			icon.style.justifyContent = 'center'
			icon.style.fontSize = '16px'
			icon.style.fontWeight = 'bold'
			icon.style.color = 'white'

			icon.dataset.debug = `icon-for-${img.src.substring(0, 30)}...`

			const imgWidth = img.width || img.naturalWidth || 100
			const imgHeight = img.height || img.naturalHeight || 100

			console.log(`ContentScript: Image dimensions: ${imgWidth}x${imgHeight}`)

			const rect = img.getBoundingClientRect()
			console.log(`ContentScript: Image rect:`, rect)

			if (rect.width === 0 || rect.height === 0) {
				console.log(
					'ContentScript: Image rectangle has zero dimensions, using fallback positioning'
				)

				icon.style.position = 'fixed'
				icon.style.bottom = '10px'
				icon.style.left = '10px'
			} else {
				const absoluteTop = rect.top + window.scrollY + imgHeight - 30
				const absoluteLeft = rect.left + window.scrollX + 5

				console.log(`ContentScript: Icon position: top=${absoluteTop}, left=${absoluteLeft}`)

				icon.style.top = `${absoluteTop}px`
				icon.style.left = `${absoluteLeft}px`
			}

			document.body.appendChild(icon)
			console.log(`ContentScript: Robot icon added to DOM with ID ${labelId}`)

			try {
				const notification = document.createElement('div')
				notification.style.position = 'fixed'
				notification.style.top = '10px'
				notification.style.right = '10px'
				notification.style.backgroundColor = 'rgba(255, 0, 0, 0.9)'
				notification.style.color = 'white'
				notification.style.padding = '10px'
				notification.style.borderRadius = '5px'
				notification.style.zIndex = '2147483647'
				notification.style.fontFamily = 'Arial, sans-serif'
				notification.style.fontSize = '14px'
				notification.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)'

				const range = 0.05 - -0.2
				const position = confidence - -0.2
				const percentage = Math.round((position / range) * 100)
				const displayPercentage = Math.min(Math.max(percentage, 1), 99)

				notification.textContent = `AI Generated Image Detected! (${displayPercentage}% уверенность)`
				document.body.appendChild(notification)

				setTimeout(() => {
					if (document.body.contains(notification)) {
						document.body.removeChild(notification)
					}
				}, 3000)
			} catch (notifyError) {
				console.error('ContentScript: Error showing notification:', notifyError)
			}

			const updateIconPosition = () => {
				if (icon && document.body.contains(icon)) {
					const updatedRect = img.getBoundingClientRect()

					if (
						updatedRect.width > 0 &&
						updatedRect.height > 0 &&
						document.visibilityState === 'visible'
					) {
						const newTop = updatedRect.top + window.scrollY + updatedRect.height - 30
						const newLeft = updatedRect.left + window.scrollX + 5

						console.log(`ContentScript: Updating icon position: top=${newTop}, left=${newLeft}`)

						icon.style.top = `${newTop}px`
						icon.style.left = `${newLeft}px`
						icon.style.display = 'flex'
					} else {
						icon.style.display = 'none'
					}
				} else {
					window.removeEventListener('scroll', updateIconPosition)
					window.removeEventListener('resize', updateIconPosition)
				}
			}

			setTimeout(updateIconPosition, 500)

			window.addEventListener('scroll', updateIconPosition)
			window.addEventListener('resize', updateIconPosition)

			const observer = new MutationObserver(() => {
				if (document.body.contains(img)) {
					updateIconPosition()
				} else {
					if (icon && document.body.contains(icon)) {
						icon.remove()
					}
					observer.disconnect()
				}
			})

			if (img.parentElement) {
				observer.observe(img.parentElement, {
					childList: true,
					subtree: true,
					attributes: true,
					attributeFilter: ['style', 'class'],
				})
			}

			console.log(`ContentScript: Robot icon added for AI image: ${img.src.substring(0, 60)}...`)
		}

		setTimeout(addIconWithDelay, 100)
	} catch (error) {
		console.error('ContentScript: Error adding robot icon:', error)
	}
}

const processedImages = new WeakSet<HTMLImageElement>()
let analysisTimeout: number | null = null

const setupImageAnalysis = (): void => {
	chrome.storage.local.get(
		['analyzeEnabled', 'minSizeFilterEnabled', 'minImageWidth', 'minImageHeight'],
		(result: {
			analyzeEnabled?: boolean
			minSizeFilterEnabled?: boolean
			minImageWidth?: number
			minImageHeight?: number
		}) => {
			if (result.analyzeEnabled === false) {
				console.log('ContentScript: AI Image Analysis is disabled in settings. Skipping analysis.')
				return
			}

			const minSizeFilterEnabled = result.minSizeFilterEnabled === true
			const minWidth = typeof result.minImageWidth === 'number' ? result.minImageWidth : 32
			const minHeight = typeof result.minImageHeight === 'number' ? result.minImageHeight : 32

			const images = Array.from(document.querySelectorAll('img'))
			console.log(`ContentScript: Found ${images.length} images on the page.`)

			images.forEach(img => {
				if (processedImages.has(img)) {
					return
				}

				if (minSizeFilterEnabled) {
					if (
						(img.naturalWidth || img.width) < minWidth ||
						(img.naturalHeight || img.height) < minHeight
					) {
						console.log(`ContentScript: Skipping image due to min size filter: ${img.src}`)
						return
					}
				}

				const observer = new IntersectionObserver(
					entries => {
						entries.forEach(async entry => {
							if (entry.isIntersecting) {
								processedImages.add(img)
								observer.unobserve(img)

								if (analysisTimeout) clearTimeout(analysisTimeout)
								analysisTimeout = window.setTimeout(async () => {
									try {
										const imageRep = await getImageRepresentation(img)
										if (imageRep) {
											console.log(
												`ContentScript: Analyzing image (intersecting): ${img.src.substring(0, 60)}...`
											)
											const result = await analyzeImage(img)
											console.log(
												`ContentScript: Analysis complete for ${img.src.substring(0, 60)}..., result:`,
												result
											)
											if (result && !result.error) {
												console.log(
													`ContentScript: Calling addLabelToImage for ${img.src.substring(0, 60)}...`
												)
												addLabelToImage(img, result.isAIGenerated, result.confidence)
											} else if (result && result.error) {
												console.warn(
													`ContentScript: Analysis error for ${img.src}: ${result.error}`
												)
											}
										} else {
											console.log(
												`ContentScript: Skipping analysis for non-valid image (intersecting): ${img.src}`
											)
										}
									} catch (error) {
										console.error(
											`ContentScript: Error during intersection analysis for ${img.src}:`,
											error
										)
									}
								}, 300)
							}
						})
					},
					{ threshold: 0.1 }
				)
				observer.observe(img)
			})
		}
	)
}

const mutationObserver = new MutationObserver(mutationsList => {
	for (const mutation of mutationsList) {
		if (mutation.type === 'childList' || mutation.type === 'attributes') {
			if (mutation.type === 'childList') {
				mutation.addedNodes.forEach(node => {
					if (node.nodeName === 'IMG' && !processedImages.has(node as HTMLImageElement)) {
						setupImageAnalysis()
					} else if (node.childNodes && node.childNodes.length > 0) {
						;(node.childNodes as NodeListOf<HTMLImageElement>).forEach(childNode => {
							if (childNode.nodeName === 'IMG' && !processedImages.has(childNode)) {
								setupImageAnalysis()
							}
						})
					}
				})
			} else if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
				const targetImage = mutation.target as HTMLImageElement
				if (targetImage.nodeName === 'IMG' && processedImages.has(targetImage)) {
					processedImages.delete(targetImage)

					if (targetImage.dataset.aiDetectorLabel) {
						const oldLabel = document.getElementById(targetImage.dataset.aiDetectorLabel)
						if (oldLabel) oldLabel.remove()
						delete targetImage.dataset.aiDetectorLabel
					}
					setupImageAnalysis()
				}
			}
		}
	}
})

const initializeExtension = async (): Promise<void> => {
	console.log('ContentScript: Initializing extension features...')

	const retryInitialization = (delay = 2000) => {
		console.log(`ContentScript: Will retry initialization in ${delay}ms`)
		setTimeout(initializeExtension, delay)
	}

	chrome.runtime.sendMessage({ type: 'GET_ONNX_STATUS' }, response => {
		if (chrome.runtime.lastError) {
			console.error('ContentScript: Error getting ONNX status:', chrome.runtime.lastError.message)

			retryInitialization(3000)
			return
		}

		if (response && response.initialized) {
			console.log('ContentScript: Background ONNX is initialized. Setting up image analysis.')
			setupImageAnalysis()
			mutationObserver.observe(document.body, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ['src'],
			})
		} else if (response && response.initializing) {
			console.log('ContentScript: Background ONNX is initializing. Will retry later.')
			retryInitialization()
		} else {
			const errorMessage = response?.error || 'Unknown error with ONNX initialization'
			console.error('ContentScript: Background ONNX failed to initialize:', errorMessage)

			console.log(
				'ContentScript: Will proceed with image analysis despite ONNX initialization issues'
			)
			setupImageAnalysis()
			mutationObserver.observe(document.body, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ['src'],
			})
		}
	})
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializeExtension)
} else {
	initializeExtension()
}

;(window as Window & typeof globalThis & any).aiGenDetectorContent = {
	analyzeImage,
	setupImageAnalysis,
	processedImages,
}
