var test = require('tape');
var tapBrowserEl = require('./../..');

tapBrowserEl( {

	css: false
});

runTest();

function runTest() {

	test('a test which passes', function(t) {

		t.pass('we passed');
		t.pass('we passed again');
		t.end();
	});

	test('a test which fails', function(t) {

		t.pass('we passed');
		t.fail('we failed');
		t.pass('we passed again');
		t.end();
	});
}