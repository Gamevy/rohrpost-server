var assert = require('chai').assert;
var sinon = require('sinon');
var Session = require('../lib/Session.js');

describe('Session', function(){

    var redisClient = null;

    beforeEach(function() {
        redisClient = {
            hmset: sinon.spy()
        };
    });

    it('can be created with an initial object', function() {
        var obj = {
            created: '1382105518000',
            whitelist: '1|2'
        }
        var session = new Session(obj, 'session:test', ['3', '4'], redisClient);

        assert.equal(session.created.getTime(), 1382105518000);
        assert.deepEqual(session.whitelist, ['1', '2']);
    });

    it('will default to an intial object', function() {
        var now = new Date().getTime();
        var session = new Session(null, 'session:test', ['3', '4'], redisClient);

        assert.ok(session.created.getTime() >= now);
        assert.ok(session.created.getTime() < now + 2000);
        assert.deepEqual(session.whitelist, ['3', '4']);
    });

    it('will save the session when it\'s creating itself', function() {
        var session = new Session(null, 'session:test', ['3', '4'], redisClient);
        assert.ok(redisClient.hmset.calledOnce);
    });

    it('can whitelist topics', function() {
        var session = new Session(null, 'session:test', ['1', '2'], redisClient);
        session.whitelistTopic('3');
        assert.deepEqual(session.whitelist, ['1', '2', '3']);
    });

    it('can be saved', function() {
        var obj = {
            created: '1382105518000',
            whitelist: '1|2'
        }
        var session = new Session(obj, 'session:test', [], redisClient);
        session.whitelistTopic('3');
        session.save();

        assert.equal(redisClient.hmset.lastCall.args[0], 'session:test');
        assert.equal(redisClient.hmset.lastCall.args[1].whitelist, '1|2|3');
        assert.equal(redisClient.hmset.lastCall.args[1].created, '1382105518000');
    });

    it('allows white listed topics', function() {
        var session = new Session(null, 'session:test', ['1', '2'], redisClient);
        assert.equal(session.topicWhitelisted('2'), true);
    });

    it('does not allow other topics', function() {
        var session = new Session(null, 'session:test', ['1', '2'], redisClient);
        assert.equal(session.topicWhitelisted('3'), false);
    });

    it('does handle regex correctly', function() {
        var session = new Session(null, 'session:test', ['test.h*'], redisClient);
        assert.equal(session.topicWhitelisted('test.hello'), true);
    });

    it('scans the whole topic', function() {
        var session = new Session(null, 'session:test', ['test.h'], redisClient);
        assert.equal(session.topicWhitelisted('test.hello'), false);
    });

    it('does not get confused with dots', function() {
        var session = new Session(null, 'session:test', ['test.hello'], redisClient);
        assert.equal(session.topicWhitelisted('testxhello'), false);
    });

});