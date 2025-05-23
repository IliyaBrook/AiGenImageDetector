export function getElementsByXPath(xpath: string, context?: Document | Element): HTMLElement[] {
	try {
		const result = document.evaluate(
			xpath,
			context,
			null,
			XPathResult.ORDERED_NODE_ITERATOR_TYPE,
			null
		)

		const elements: HTMLElement[] = []
		let node = result.iterateNext()

		while (node) {
			if (node instanceof HTMLElement) {
				elements.push(node)
			}
			node = result.iterateNext()
		}

		return elements
	} catch {}
}
