module.exports = {
	// Line length that Prettier will wrap on
	printWidth: 100,
	
	// Number of spaces per indentation level
	tabWidth: 2,
	
	// Use tabs instead of spaces
	useTabs: true,
	
	// Print semicolons at the ends of statements
	semi: false,
	
	// Use single quotes instead of double quotes
	singleQuote: true,
	
	// Change when properties in objects are quoted
	quoteProps: 'as-needed',
	
	// Use single quotes instead of double quotes in JSX
	jsxSingleQuote: true,
	
	// Print trailing commas wherever possible in multi-line comma-separated syntactic structures
	trailingComma: 'es5',
	
	// Print spaces between brackets in object literals
	bracketSpacing: true,
	
	// Put the > of a multi-line JSX element at the end of the last line instead of being alone on the next line
	bracketSameLine: false,
	
	// Include parentheses around a sole arrow function parameter
	arrowParens: 'avoid',
	
	// Format only files recognized by Prettier
	requirePragma: false,
	
	// Insert @format pragma to the top of files specifying that the file has been formatted with Prettier
	insertPragma: false,
	
	// Wrap prose as-is since Prettier can't infer a desired wrapping style
	proseWrap: 'preserve',
	
	// Specify the global whitespace sensitivity for HTML, Vue, Angular, and Handlebars
	htmlWhitespaceSensitivity: 'css',
	
	// Maintain existing line endings (mixed values within one file are normalized by looking at what's used after the first line)
	endOfLine: 'auto',
	
	// Enforce consistent indentation in Vue SFCs
	vueIndentScriptAndStyle: false,
	
	// Control whether Prettier formats quoted code embedded in the file
	embeddedLanguageFormatting: 'auto',
	
	// Enforce single attribute per line in HTML, Vue and JSX
	singleAttributePerLine: false,
	
	// Plugins
	plugins: []
}