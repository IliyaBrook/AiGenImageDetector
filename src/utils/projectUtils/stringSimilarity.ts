export function levenshteinDistance(a: string, b: string): number {
	const matrix: number[][] = []

	for (let i = 0; i <= a.length; i++) {
		matrix[i] = [i]
	}
	for (let j = 0; j <= b.length; j++) {
		matrix[0][j] = j
	}

	for (let i = 1; i <= a.length; i++) {
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1
			matrix[i][j] = Math.min(
				matrix[i - 1][j] + 1,
				matrix[i][j - 1] + 1,
				matrix[i - 1][j - 1] + cost
			)
		}
	}

	return matrix[a.length][b.length]
}

export function stringSimilarity(a: string, b: string): number {
	if (a === b) return 1
	if (a.length === 0 || b.length === 0) return 0

	const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase())
	const maxLength = Math.max(a.length, b.length)

	return 1 - distance / maxLength
}

export function findMostSimilarKey(target: string, keys: string[], threshold = 0.5): string | null {
	if (!target || keys.length === 0) return null

	let bestMatch = null
	let highestSimilarity = 0

	for (const key of keys) {
		const similarity = stringSimilarity(target, key)
		if (similarity > highestSimilarity) {
			highestSimilarity = similarity
			bestMatch = key
		}
	}

	return highestSimilarity >= threshold ? bestMatch : null
}
