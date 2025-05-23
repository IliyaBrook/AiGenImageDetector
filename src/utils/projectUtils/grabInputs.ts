import { getId } from '@utils'

export function grabInputs(
	target: HTMLElement,
	types: RegExp
): (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)[] {
	const inputs = new Set<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>()

	target.querySelectorAll("input, textarea, select, [type='file'], [name]").forEach(el => {
		if (el instanceof HTMLInputElement) {
			if (getId(el) && types.test(el.type)) {
				inputs.add(el)
			} else if (el.type === 'file') {
				inputs.add(el)
			}
		} else if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
			if (getId(el)) {
				inputs.add(el)
			}
		}
	})

	return Array.from(inputs)
}
