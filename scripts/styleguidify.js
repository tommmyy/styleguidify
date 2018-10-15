/* eslint-disable import/no-extraneous-dependencies */
const R = require('ramda');
const R_ = require('ramda-extension');
const { CLIEngine } = require('eslint');
const path = require('path');
const fs = require('fs-extra');
const json2Md = require('json2md');
/* eslint-enable import/no-extraneous-dependencies */

console.log(process.argv);

json2Md.converters.link = ({ label, url }) => `[${label}](${url})`;

const configFilePath = './.eslintrc.js';
const packageJsonPath = path.join(process.cwd(), 'package.json');
const styleguidePath = path.join(process.cwd(), 'STYLEGUIDE.md');

const getConfigFile = specifiedFile => {
	if (specifiedFile) {
		if (path.isAbsolute(specifiedFile)) {
			return specifiedFile;
		}
		return path.join(process.cwd(), specifiedFile); // eslint-disable-line import/no-dynamic-require
	}
	return require(packageJsonPath).main; // eslint-disable-line import/no-dynamic-require
};

const getCliEngine = configFile =>
	new CLIEngine({
		// Ignore any config applicable depending on the location on the filesystem
		useEslintrc: false,
		configFile,
	});

const configFile = getConfigFile(configFilePath);
const cliEngine = getCliEngine(configFile);
const { rules: configRules } = cliEngine.getConfigForFile();

const getMetaDocs = R_.dotPath('meta.docs');
const loadedRules = cliEngine.getRules();

const mapToArrayOfPairs = x => [...x];

const meta = R.compose(
	R.fromPairs,
	R.map(([x, y]) => [x, getMetaDocs(y)]),
	mapToArrayOfPairs
)(loadedRules);

const rules = R_.mapKeysAndValues(([rule, options]) => [
	rule,
	{
		options,
		meta: meta[rule],
	},
])(configRules);

const saveMd = x => fs.writeFileSync(styleguidePath, x);

const convertAndSave = R.o(saveMd, json2Md);

const addHeader = R.prepend({ h1: 'Styleguide' });
const addFooter = R.append({ p: 'Generated directly from ESLint config.' });
const normalizeSeverity = R.cond([
	[R.equals(0), R.always('off')],
	[R.equals(1), R.always('warning')],
	[R.equals(2), R.always('error')],
]);

const getSeverity = R.o(R.when(R_.isNumber, normalizeSeverity), R.when(R_.isArray, R.head));
const genRuleSection = R.chain(([rule, { options = {}, meta = {} }]) => {
	if (!meta || !meta.description || !meta.url) {
		return [];
	}

	return [
		{
			h3: R_.toUpperFirst(R.trim(meta.description)),
		},
		{
			p: [
				`Rule: [*${rule}*](${meta.url})`,
				`Severity: ${getSeverity(options)}`,
				...(R_.isString(options) || R.o(R.isEmpty, R.tail)(options)
					? []
					: [`Other options: \`${JSON.stringify(R.tail(options))}\``]),
			],
		},
	];
});

const getCategory = R.o(R_.dotPath('meta.category'), R.nth(1));
const getHeadCategory = R.o(getCategory, R.head);
const genCategorySection = rulesInCategory => {
	if (R.isEmpty(rulesInCategory) || !getHeadCategory(rulesInCategory)) {
		return [];
	}

	return [{ h2: getHeadCategory(rulesInCategory) }, ...genRuleSection(rulesInCategory)];
};

const generateStyleguide = R.compose(
	addHeader,
	addFooter,
	R.chain(genCategorySection),
	R.values,
	R.groupBy(getCategory),
	R.toPairs
);
const run = R.o(convertAndSave, generateStyleguide);

run(rules);
