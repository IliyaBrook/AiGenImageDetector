import { useEffect, useState } from 'react'
import './Popup.css'

function SettingsPage({ onBack }: { onBack: () => void }) {
	const [minWidth, setMinWidth] = useState<number>(32)
	const [minHeight, setMinHeight] = useState<number>(32)
	const [enabled, setEnabled] = useState<boolean>(false)
	const [saving, setSaving] = useState<boolean>(false)

	useEffect(() => {
		chrome.storage.local.get(
			['minImageWidth', 'minImageHeight', 'minSizeFilterEnabled'],
			(result: {
				minImageWidth?: number
				minImageHeight?: number
				minSizeFilterEnabled?: boolean
			}) => {
				setMinWidth(result.minImageWidth ?? 32)
				setMinHeight(result.minImageHeight ?? 32)
				setEnabled(result.minSizeFilterEnabled ?? false)
			}
		)
	}, [])

	const handleSave = () => {
		setSaving(true)
		chrome.storage.local.set(
			{
				minImageWidth: minWidth,
				minImageHeight: minHeight,
				minSizeFilterEnabled: enabled,
			},
			() => setSaving(false)
		)
	}

	return (
		<div className='popup-root'>
			<h2 style={{ margin: 0, fontSize: 18 }}>Settings</h2>
			<label style={{ marginTop: 8 }}>
				<input type='checkbox' checked={enabled} onChange={e => setEnabled(e.target.checked)} />
				Enable minimum image size filter
			</label>
			<div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
				<label>
					Min width (px):
					<input
						type='number'
						min={1}
						value={minWidth}
						onChange={e => setMinWidth(Math.max(1, Number(e.target.value)))}
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
						onChange={e => setMinHeight(Math.max(1, Number(e.target.value)))}
						style={{ width: 60, marginLeft: 4 }}
						disabled={!enabled}
						inputMode='numeric'
					/>
				</label>
			</div>
			<button style={{ marginTop: 16 }} onClick={handleSave} disabled={saving}>
				{saving ? 'Saving...' : 'Save'}
			</button>
			<button style={{ marginTop: 8 }} onClick={onBack}>
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
