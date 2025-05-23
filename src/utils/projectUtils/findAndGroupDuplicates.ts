interface IFindDuplicatesResult<T> {
	uniqueObject: Record<string, T>
	duplicateKeys: string[]
	duplicates: Record<string, T[]>
}

export function findAndGroupDuplicates<T>(
	object: Record<string, T>,
	keyExtractor: (item: T) => string
): IFindDuplicatesResult<T> {
	const uniqueObject: Record<string, T> = {}
	const duplicates: Record<string, T[]> = {}

	Object.values(object).forEach(item => {
		const key = keyExtractor(item).toLowerCase()

		if (uniqueObject[key]) {
			if (!duplicates[key]) {
				duplicates[key] = [uniqueObject[key]]
			}
			duplicates[key].push(item)
		} else {
			uniqueObject[key] = item
		}
	})

	return { uniqueObject, duplicateKeys: Object.keys(duplicates), duplicates }
}
