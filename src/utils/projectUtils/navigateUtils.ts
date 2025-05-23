export const navigateToUrl = (url: string) => {
	window.open(url, '_blank', 'noopener,noreferrer')
}

export const navigateToTab = (url: string) => {
	void chrome.tabs.create({ url })
}
