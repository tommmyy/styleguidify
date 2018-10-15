#!/usr/bin/env node
const R = require('ramda');
const spawn = require('cross-spawn');

const args = process.argv.slice(2);

const Scripts = {
	GENERATE: 'generate',
};
const findIndexOfScript = R.findIndex(
	R.contains(R.__, R.values(Scripts))
);

const scriptIndex = findIndexOfScript(args);

const script = scriptIndex === -1 ? args[0] : args[scriptIndex];

const nodeArgs = scriptIndex > 0 ? args.slice(0, scriptIndex) : [];

process.on('unhandledRejection', err => {
	throw err;
});


const scriptName = !script ? Scripts.GENERATE : script;

if (scriptName !== Scripts.GENERATE) {
	console.log('Unknown script.');

	process.exit(1);
}

const child = spawn.sync('node', R.concat(nodeArgs, [require.resolve(`../scripts/${scriptName}`)]), {
	stdio: 'inherit',
});

if (child.signal) {
	if (child.signal === 'SIGKILL') {
		console.log(
			'The build failed because the process exited too early. ' +
				'This probably means the system ran out of memory or someone called ' +
				'`kill -9` on the process.'
		);
	} else if (child.signal === 'SIGTERM') {
		console.log(
			'The build failed because the process exited too early. ' +
				'Someone might have called `kill` or `killall`, or the system could ' +
				'be shutting down.'
		);
	}
	process.exit(1);
}
process.exit(child.status);
