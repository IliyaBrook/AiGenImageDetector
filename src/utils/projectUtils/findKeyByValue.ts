export function findKeysByValue<T extends Record<string, any>>(
	obj: Record<string, T>,
	searchValue: any,
	searchKeys: (keyof T)[] = ['value', 'name']
): string[] {
	const matchingKeys: string[] = []
	for (const key in obj) {
		if (obj.hasOwnProperty(key)) {
			for (const searchKey of searchKeys) {
				if (obj[key][searchKey] === searchValue) {
					matchingKeys.push(key)
					break
				}
			}
		}
	}
	return matchingKeys
}
