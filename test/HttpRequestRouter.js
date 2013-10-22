var assert = require('chai').assert;
var HttpRequestRouter = require('../lib/HttpRequestRouter.js');

describe('HttpRequestRouter', function(){
    var router = new HttpRequestRouter({
        httpTopics: {
            'foo.*': {port: 123, host: 'localhost'}
        }
    });

    it('returns null if no rule matches', function() {
        assert.isNull(router.route('bar.foo'));
    })

    it('returns connection object if it matches', function() {
        assert.equal(router.route('foo.bar'), 'http://localhost:123/foo.bar');
    })
});