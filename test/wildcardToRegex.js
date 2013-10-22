var assert = require('chai').assert;
var wildcardsToRegex = require('../lib/wildcardsToRegex.js');

describe('wildcardsToRegex', function(){
    it('does match simple text with simple rules', function() {
        assert.ok(wildcardsToRegex('foo').test('foo'));
    });

    it('does only match on the full rule (end)', function() {
        assert.notOk(wildcardsToRegex('foo').test('foobar'));
    });

    it('does only match on the full rule (beginning)', function() {
        assert.notOk(wildcardsToRegex('foo').test('barfoo'));
    });

    it('does not match completely unrelated strings', function() {
        assert.notOk(wildcardsToRegex('foo').test('bar'));
    });

    it('does match wildcards correctly', function() {
        assert.ok(wildcardsToRegex('foo*bar').test('footestbar'));
    });

    it('does allow wildcards to not be used', function() {
        assert.ok(wildcardsToRegex('foo*bar').test('foobar'));
    });

    it('does handle dots in the rule correctly', function() {
        assert.ok(wildcardsToRegex('foo.bar').test('foo.bar'));
        assert.notOk(wildcardsToRegex('foo.bar').test('fooxbar'));
    });

    it('does handle slashed in the rule correctly', function() {
        assert.ok(wildcardsToRegex('foo\\.bar').test('foo\\.bar'));
        assert.notOk(wildcardsToRegex('foo\\.bar').test('foo.bar'));
    });

    it('does handle other regex special cases in the rule correctly', function() {
        assert.ok(wildcardsToRegex('foo^bar').test('foo^bar'));
        assert.ok(wildcardsToRegex('foo$bar').test('foo$bar'));
        assert.ok(wildcardsToRegex('foo?bar').test('foo?bar'));
        assert.ok(wildcardsToRegex('foo+bar').test('foo+bar'));
        assert.ok(wildcardsToRegex('foo(bar').test('foo(bar'));
        assert.ok(wildcardsToRegex('foo)bar').test('foo)bar'));
        assert.ok(wildcardsToRegex('foo[bar').test('foo[bar'));
        assert.ok(wildcardsToRegex('foo]bar').test('foo]bar'));
        assert.ok(wildcardsToRegex('foo{bar').test('foo{bar'));
        assert.ok(wildcardsToRegex('foo}bar').test('foo}bar'));
    });

});