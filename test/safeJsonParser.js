var assert = require('chai').assert;
var sinon = require('sinon');
var safeJsonParser = require('../lib/safeJsonParser.js');

describe('safeJsonParser', function(){
    it('does parse null', function() {
        assert.isNull(safeJsonParser('null'));
    });

    it('does parse normal object', function() {
        assert.deepEqual(safeJsonParser('{"foo":"bar"}'), {"foo":"bar"});
    });
});