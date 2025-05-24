import { useEffect, useState } from 'react'
import './Popup.css'

function SettingsPage({ onBack }: { onBack: () => void }) {
	const [minWidth, setMinWidth] = useState<number>(32)
	const [minHeight, setMinHeight] = useState<number>(32)
	const [enabled, setEnabled] = useState<boolean>(false)
	const [faceDetectionEnabled, setFaceDetectionEnabled] = useState<boolean>(true)
	const [faceDetectionMethod, setFaceDetectionMethod] = useState<string>('enhanced_heuristic')
	const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.6)
	const [saving, setSaving] = useState<boolean>(false)

	useEffect(() => {
		chrome.storage.local.get(
			['minImageWidth', 'minImageHeight', 'minSizeFilterEnabled', 'faceDetectionEnabled', 'faceDetectionMethod', 'confidenceThreshold'],
			(result: {
				minImageWidth?: number
				minImageHeight?: number
				minSizeFilterEnabled?: boolean
				faceDetectionEnabled?: boolean
				faceDetectionMethod?: string
				confidenceThreshold?: number
			}) => {
				setMinWidth(result.minImageWidth ?? 32)
				setMinHeight(result.minImageHeight ?? 32)
				setEnabled(result.minSizeFilterEnabled ?? false)
				setFaceDetectionEnabled(result.faceDetectionEnabled ?? true)
				setFaceDetectionMethod(result.faceDetectionMethod ?? 'enhanced_heuristic')
				setConfidenceThreshold(result.confidenceThreshold ?? 0.6)
			}
		)
	}, [])

	// Auto-save function
	const saveSettings = (updates: any) => {
		setSaving(true)
		chrome.storage.local.set(updates, () => {
			setSaving(false)
			console.log('Settings auto-saved:', updates)
		})
	}

	const handleMinWidthChange = (value: number) => {
		setMinWidth(value)
		saveSettings({ minImageWidth: value })
	}

	const handleMinHeightChange = (value: number) => {
		setMinHeight(value)
		saveSettings({ minImageHeight: value })
	}

	const handleEnabledChange = (value: boolean) => {
		setEnabled(value)
		saveSettings({ minSizeFilterEnabled: value })
	}

	const handleFaceDetectionEnabledChange = (value: boolean) => {
		setFaceDetectionEnabled(value)
		saveSettings({ faceDetectionEnabled: value })
	}

	const handleFaceDetectionMethodChange = (value: string) => {
		setFaceDetectionMethod(value)
		saveSettings({ faceDetectionMethod: value })
	}

	const handleConfidenceThresholdChange = (value: number) => {
		setConfidenceThreshold(value)
		saveSettings({ confidenceThreshold: value })
	}

	return (
		<div className='popup-root'>
			<h2 style={{ margin: 0, fontSize: 18 }}>Settings</h2>
			
			{saving && (
				<div style={{ fontSize: 12, color: '#007acc', marginTop: 4 }}>
					💾 Auto-saving...
				</div>
			)}
			
			{/* AI Detection Settings */}
			<div style={{ marginTop: 16, padding: 8, border: '1px solid #ccc', borderRadius: 4 }}>
				<h3 style={{ margin: '0 0 8px 0', fontSize: 14 }}>AI Detection</h3>
				
				<label style={{ marginBottom: 8, display: 'block' }}>
					<input 
						type='checkbox' 
						checked={faceDetectionEnabled} 
						onChange={e => handleFaceDetectionEnabledChange(e.target.checked)} 
					/>
					Enable face detection filter
				</label>
				
				<label style={{ display: 'block', marginBottom: 8 }}>
					Face Detection Method:
					<select 
						value={faceDetectionMethod} 
						onChange={e => handleFaceDetectionMethodChange(e.target.value)}
						style={{ marginLeft: 8, width: '100%', marginTop: 4 }}
						disabled={!faceDetectionEnabled}
					>
						<option value="enhanced_heuristic">Enhanced Heuristic (Fast)</option>
						<option value="mediapipe">MediaPipe (Accurate)</option>
					</select>
				</label>
				
				<label style={{ display: 'block', marginBottom: 8 }}>
					Detection Threshold:
					<input
						type="range"
						min={0.1}
						max={0.9}
						step={0.05}
						value={confidenceThreshold}
						onChange={e => handleConfidenceThresholdChange(Number(e.target.value))}
						style={{ width: '100%', marginTop: 4 }}
					/>
					<span style={{ fontSize: 12, color: '#666' }}>
						{(confidenceThreshold * 100).toFixed(0)}% - {confidenceThreshold < 0.5 ? 'Sensitive' : confidenceThreshold < 0.7 ? 'Balanced' : 'Conservative'}
					</span>
				</label>
				
				{faceDetectionEnabled && faceDetectionMethod === 'mediapipe' && (
					<div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
						⚠️ MediaPipe uses neural networks for higher accuracy but requires additional ~2MB download
					</div>
				)}
				
				{!faceDetectionEnabled && (
					<div style={{ fontSize: 12, color: '#ff6600', marginTop: 4 }}>
						⚠️ Face detection disabled - all images will be analyzed (may include graphics/drawings)
					</div>
				)}
			</div>

			{/* Image Size Filter Settings */}
			<div style={{ marginTop: 16, padding: 8, border: '1px solid #ccc', borderRadius: 4 }}>
				<h3 style={{ margin: '0 0 8px 0', fontSize: 14 }}>Image Size Filter</h3>
				
				<label style={{ marginBottom: 8, display: 'block' }}>
					<input type='checkbox' checked={enabled} onChange={e => handleEnabledChange(e.target.checked)} />
					Enable minimum image size filter
				</label>
				<div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
					<label>
						Min width (px):
						<input
							type='number'
							min={1}
							value={minWidth}
							onChange={e => handleMinWidthChange(Math.max(1, Number(e.target.value)))}
							style={{ width: 60, marginLeft: 4 }}
							disabled={!enabled}
							inputMode='numeric'
						/>
					</label>
					<label>
						Min height (px):
						<input
							type='number'
							min={1}
							value={minHeight}
							onChange={e => handleMinHeightChange(Math.max(1, Number(e.target.value)))}
							style={{ width: 60, marginLeft: 4 }}
							disabled={!enabled}
							inputMode='numeric'
						/>
					</label>
				</div>
			</div>

			<button style={{ marginTop: 16 }} onClick={onBack}>
				Back
			</button>
		</div>
	)
}

export default function Popup(): JSX.Element {
	const [enabled, setEnabled] = useState<boolean>(true)
	const [page, setPage] = useState<'main' | 'settings'>('main')

	useEffect(() => {
		chrome.storage.local.get(['analyzeEnabled'], (result: { analyzeEnabled?: boolean }) => {
			setEnabled(result.analyzeEnabled !== false)
		})
	}, [])

	const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.checked
		setEnabled(value)
		chrome.storage.local.set({ analyzeEnabled: value })
	}

	const handleViewLogs = () => {
		chrome.tabs.create({ url: chrome.runtime.getURL('src/logs/index.html') })
	}

	if (page === 'settings') {
		return <SettingsPage onBack={() => setPage('main')} />
	}

	return (
		<div className='popup-root'>
			<div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
				<button onClick={handleViewLogs}>Logs</button>
				<button onClick={() => setPage('settings')}>Settings</button>
			</div>
			<label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
				<input type='checkbox' checked={enabled} onChange={handleToggle} />
				Enable AI Image Analysis
			</label>
		</div>
	)
}
