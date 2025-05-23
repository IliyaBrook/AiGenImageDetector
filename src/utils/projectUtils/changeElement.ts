export function changeElement(element: HTMLElement, value: string = ' ') {
	try {
		const o: KeyboardEventInit = {
			code: value === ' ' ? 'Space' : value.toUpperCase(),
			key: value,
			bubbles: true,
		}
		element.dispatchEvent(new KeyboardEvent('keydown', o))
		element.dispatchEvent(new KeyboardEvent('keyup', o))
		;['change', 'input'].forEach(evt => {
			element.dispatchEvent(new Event(evt, { bubbles: true }))
		})
	} catch (e) {}
}
