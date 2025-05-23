export function getId(el: HTMLElement): string {
	const attributesOptions: string[] = ['name', 'id', 'data-testid']
	let id = attributesOptions.find(attr => el.getAttribute(attr)) || ''
	if (!id) {
		id = (el.getAttribute('placeholder') || '').replace(/\s/g, '_')
	}
	return id
}
