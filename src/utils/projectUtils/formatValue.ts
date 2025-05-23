export function formatValue(value: string): string {
	return value.replace(/(?:\\n)|(?:<br\s*\/?>)/g, '\n')
}
