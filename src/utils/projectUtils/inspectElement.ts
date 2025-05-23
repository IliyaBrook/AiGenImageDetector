export function inspectElement(node: HTMLElement): string[] {
	let results: string[] = []
	const attributesToCheck = ['placeholder', 'data-testid', 'aria-label', 'title', 'name', 'id']
	const one = (node: HTMLElement) => {
		if (node instanceof HTMLInputElement) {
			results.push(node.value)
		}

		attributesToCheck.forEach(attr => {
			const attrValue = node.getAttribute(attr)
			if (attrValue) {
				results.push(attrValue)
			}
		})

		if (node.tagName !== 'SELECT' && !node.querySelector('select')) {
			results.push(node.textContent || '')
		}
	}

	one(node)

	if (node.parentElement) {
		one(node.parentElement)

		node.parentElement.querySelectorAll('*').forEach(child => {
			if (child instanceof HTMLElement) one(child)
		})
	}

	if (node.id) {
		const associatedLabels = document.querySelectorAll(`label[for="${node.id}"]`)
		associatedLabels.forEach(label => {
			if (label instanceof HTMLElement) {
				results.push(label.textContent || '')
			}
		})
	}

	return results.map(s => s.trim()).filter((s, i, arr) => s && s.length > 0 && arr.indexOf(s) === i)
}
