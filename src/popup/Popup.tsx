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

	const getThresholdLabel = (value: number) => {
		if (value < 0.5) return 'Sensitive'
		if (value < 0.7) return 'Balanced'
		return 'Conservative'
	}

	return (
		<div className='popup-root'>
			<h2><span className="icon">⚙️</span> Settings</h2>
			
			{saving && (
				<div className="auto-save-indicator">
					<span className="icon">💾</span>
					Auto-saving...
				</div>
			)}
			
			{/* AI Detection Settings */}
			<div className="settings-section">
				<h3><span className="icon">🤖</span> AI Detection</h3>
				
				<div className="checkbox-container">
					<input 
						type='checkbox' 
						id="faceDetection"
						checked={faceDetectionEnabled} 
						onChange={e => handleFaceDetectionEnabledChange(e.target.checked)} 
					/>
					<label htmlFor="faceDetection">Enable face detection filter</label>
				</div>
				
				<div className="form-group">
					<label className="form-label">
						<span className="icon">🔍</span> Face Detection Method:
					</label>
					<select 
						value={faceDetectionMethod} 
						onChange={e => handleFaceDetectionMethodChange(e.target.value)}
						disabled={!faceDetectionEnabled}
					>
						<option value="enhanced_heuristic">Enhanced Heuristic (Fast)</option>
						<option value="mediapipe">MediaPipe (Accurate)</option>
					</select>
				</div>
				
				<div className="form-group">
					<label className="form-label">
						<span className="icon">🎯</span> Detection Threshold:
					</label>
					<div className="range-container">
						<input
							type="range"
							min={0.1}
							max={0.9}
							step={0.05}
							value={confidenceThreshold}
							onChange={e => handleConfidenceThresholdChange(Number(e.target.value))}
						/>
						<div className="range-value">
							{(confidenceThreshold * 100).toFixed(0)}% - {getThresholdLabel(confidenceThreshold)}
						</div>
					</div>
				</div>
				
				{faceDetectionEnabled && faceDetectionMethod === 'mediapipe' && (
					<div className="warning-message info">
						<span className="icon">⚠️</span> MediaPipe uses neural networks for higher accuracy but requires additional ~2MB download
					</div>
				)}
				
				{!faceDetectionEnabled && (
					<div className="warning-message warning">
						<span className="icon">⚠️</span> Face detection disabled - all images will be analyzed (may include graphics/drawings)
					</div>
				)}
			</div>

			{/* Image Size Filter Settings */}
			<div className="settings-section">
				<h3><span className="icon">📐</span> Image Size Filter</h3>
				
				<div className="checkbox-container">
					<input 
						type='checkbox' 
						id="sizeFilter"
						checked={enabled} 
						onChange={e => handleEnabledChange(e.target.checked)} 
					/>
					<label htmlFor="sizeFilter">Enable minimum image size filter</label>
				</div>
				
				<div className="input-group">
					<div className="input-field">
						<label>Min width (px):</label>
						<input
							type='number'
							min={1}
							value={minWidth}
							onChange={e => handleMinWidthChange(Math.max(1, Number(e.target.value)))}
							disabled={!enabled}
							inputMode='numeric'
						/>
					</div>
					<div className="input-field">
						<label>Min height (px):</label>
						<input
							type='number'
							min={1}
							value={minHeight}
							onChange={e => handleMinHeightChange(Math.max(1, Number(e.target.value)))}
							disabled={!enabled}
							inputMode='numeric'
						/>
					</div>
				</div>
			</div>

			<button className="secondary-button back-button" onClick={onBack}>
				<span className="icon">⬅️</span> Back
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
		<div className='popup-root main-menu'>
			<h2><span className="icon">🤖</span> AI Image Detector</h2>
			
			<div className="button-group">
				<button className="secondary-button" onClick={handleViewLogs}>
					<span className="icon">📊</span> Logs
				</button>
				<button className="secondary-button" onClick={() => setPage('settings')}>
					<span className="icon">⚙️</span> Settings
				</button>
			</div>
			
			<div className="toggle-container">
				<label className="toggle-label" htmlFor="mainToggle">
					<input 
						id="mainToggle"
						type='checkbox' 
						checked={enabled} 
						onChange={handleToggle} 
					/>
					<span className="icon">{enabled ? '✅' : '❌'}</span>
					Enable AI Image Analysis
				</label>
			</div>
		</div>
	)
}
