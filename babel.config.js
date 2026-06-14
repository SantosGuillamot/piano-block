/**
 * Babel configuration for Jest unit tests.
 *
 * Extends the default WordPress preset and adds a minimal inline plugin that
 * lets babel-jest handle `import.meta.url` in scripts/check-build.js. When
 * Babel transforms ESM → CJS for Jest, `import.meta` remains as-is and Node
 * rejects it as a syntax error in a CommonJS context. The inline plugin below
 * replaces `import.meta.url` with the CJS-equivalent expression so the
 * transformed module runs cleanly under Jest.
 */

/** @type {import('@babel/core').TransformOptions} */
module.exports = {
	presets: [ "@wordpress/babel-preset-default" ],
	plugins: [
		// Allow Babel to parse `import.meta` nodes.
		"@babel/plugin-syntax-import-meta",
		// Replace `import.meta.url` with the CommonJS equivalent so
		// scripts/check-build.js can be required by Jest.
		function replaceImportMetaUrl( { types: t } ) {
			return {
				name: "replace-import-meta-url",
				visitor: {
					MetaProperty( path ) {
						if (
							path.node.meta.name === "import" &&
							path.node.property.name === "meta"
						) {
							// Replace `import.meta` with an object whose `url`
							// property mirrors what Node sets in a real ESM
							// module: a file:// URL for the current file.
							//
							// `require('url').pathToFileURL(__filename).href`
							path.replaceWith(
								t.objectExpression( [
									t.objectProperty(
										t.identifier( "url" ),
										t.memberExpression(
											t.callExpression(
												t.memberExpression(
													t.callExpression(
														t.identifier(
															"require"
														),
														[
															t.stringLiteral(
																"url"
															),
														]
													),
													t.identifier(
														"pathToFileURL"
													)
												),
												[ t.identifier( "__filename" ) ]
											),
											t.identifier( "href" )
										)
									),
								] )
							);
						}
					},
				},
			};
		},
	],
};
