import initReloadClient from '../initReloadClient'

export default function addHmrIntoView(watchPath: string) {
	let pendingReload = false

	initReloadClient({
		watchPath,
		onUpdate: () => {
			if (document.hidden) {
				pendingReload = true
				return
			}
			reload()
		},
	})

	function reload(): void {
		pendingReload = false
		window.location.reload()
	}

	function reloadWhenTabIsVisible(): void {
		!document.hidden && pendingReload && reload()
	}

	document.addEventListener('visibilitychange', reloadWhenTabIsVisible)
}
