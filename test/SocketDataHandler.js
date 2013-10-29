var assert = require('chai').assert;
var sinon = require('sinon');
var express = require('express');
var SocketDataHandler = require('../lib/SocketDataHandler.js');
var HttpRequestRouter = require('../lib/HttpRequestRouter.js');
var EventEmitter = require('events').EventEmitter;
var logger = require('./mocks/logger.js');

describe('SocketDataHandler', function(){

    var redisPubSub = null;
    var httpRequestRouter = new HttpRequestRouter({
        httpTopics: {
            'http.*': {port: 98236, host: 'localhost'}
        }
    });
    var session = null;
    var sessionId = 'abc';
    var connection = null;
    var socketDataHandler = null;

    beforeEach(function() {
        redisPubSub = new EventEmitter();
        redisPubSub.publish = sinon.spy();
        session = {
            whitelist: ['redis.public.*', 'http.public.*'],
            whitelistTopic: sinon.stub().returns(true),
            data: { bar: "foo" }
        };
        session.topicWhitelisted = sinon.stub().returns(true);
        session.save = sinon.spy();
        connection = new EventEmitter();
        connection.write = sinon.spy(function() { });
        socketDataHandler = new SocketDataHandler(redisPubSub, httpRequestRouter, session, sessionId, connection, logger);
    });

    it('does nothing if data is not valid', function() {
        connection.emit('data', 'asdf');
        assert.equal(session.topicWhitelisted.callCount, 0);
    });

    it('does nothing if no topic is defined', function() {
        connection.emit('data', '{"data":{}}');
        assert.equal(session.topicWhitelisted.callCount, 0);
    });

    it('does nothing if data is not defined', function() {
        connection.emit('data', '{"topic":"test"}');
        assert.equal(session.topicWhitelisted.callCount, 0);
    });

    it('does check whitelist when both topic and data are defined', function() {
        connection.emit('data', '{"topic":"test", "data": null}');
        assert.ok(session.topicWhitelisted.calledWith('test'));
    });

    it('does not publish anything if topic is not whitelisted', function() {
        session.topicWhitelisted.returns(false);
        connection.emit('data', '{"topic":"test", "data": null}');
        assert.equal(redisPubSub.publish.callCount, 0);
    });

    it('does publish message to redis if topic is whitelisted', function() {
        connection.emit('data', '{"topic":"redis.public","data":{"foo":"bar"}}');
        assert.equal(redisPubSub.publish.callCount, 1);
        assert.equal(redisPubSub.publish.firstCall.args[0], 'redis.public');
        assert.equal(redisPubSub.publish.firstCall.args[1].data.foo, 'bar');
        assert.equal(redisPubSub.publish.firstCall.args[1].sessionData.bar, 'foo');
    });

    describe('does handle http topics', function() {
        var app;
        var server;

        beforeEach(function(done) {
            app = express();
            app.use(express.json());
            server = app.listen(98236, done);
        });

        afterEach(function() {
            server.close();
        });

        it('and passes them through to a server', function(done) {
            app.post('/http.public', function(req, res) {
                assert.equal(req.body.data.foo, 'bar');
                assert.equal(req.body.fromClient, true);
                assert.equal(req.body.sessionId, sessionId);
                done();
            });
            connection.emit('data', '{"topic":"http.public","data":{"foo":"bar"}}');
        });

        it('and handles response data', function(done) {
            app.post('/http.public', function(req, res) {
                res.send({"data":{"bar":"foo"},"topic":"http.public.send"});
            });
            connection.write = sinon.spy(function(payloadAsString) {
                assert.equal(payloadAsString, '{"topic":"http.public.send","data":{"bar":"foo"}}');
                done();
            });
            connection.emit('data', '{"topic":"http.public","data":{"foo":"bar"}}');
        });
    });

    it('does broadcast messages received from the backend', function() {
        redisPubSub.emit('redis.public.*', {"data": {"foo":"bar"}}, 'redis.public.test');
        assert.equal(connection.write.callCount, 1);
        assert.equal(connection.write.firstCall.args[0], '{"topic":"redis.public.test","data":{"foo":"bar"}}');
    });

    it('ignores data coming from other clients', function() {
        redisPubSub.emit('redis.public.*', {"data":{}, "fromClient": true}, 'redis.public.test');
        assert.equal(connection.write.callCount, 0);
    });

    it('ignores topics that are not in the connection whitelist', function() {
        redisPubSub.emit('redis.private.*', {"data":{}}, 'redis.private.test');
        assert.equal(connection.write.callCount, 0);
    });

    it('does send message to single connection when client topic is used', function() {
        redisPubSub.emit('rohrpost.client.' + sessionId, {"data": {"foo":"bar"}, 'topic': 'redis.public.test'});
        assert.equal(connection.write.callCount, 1);
        assert.equal(connection.write.firstCall.args[0], '{"topic":"redis.public.test","data":{"foo":"bar"}}');
    });

    it('does allow new topics to be added', function() {
        assert.equal(redisPubSub.listeners('redis.private.*').length, 0);
        redisPubSub.emit('rohrpost.client.' + sessionId, {"add": ['redis.private.*']});
        assert.equal(session.whitelistTopic.lastCall.args[0], 'redis.private.*');
        assert.equal(redisPubSub.listeners('redis.private.*').length, 1);
    });

    it('does not add event listeners twice', function() {
        redisPubSub.emit('rohrpost.client.' + sessionId, {"add": ['redis.private.*']});
        session.whitelistTopic = sinon.stub().returns(false);
        redisPubSub.emit('rohrpost.client.' + sessionId, {"add": ['redis.private.*']});
        assert.equal(redisPubSub.listeners('redis.private.*').length, 1);
    });

    it('does allow topics to be deleted', function() {
        assert.equal(redisPubSub.listeners('http.public.*').length, 1);
        redisPubSub.emit('rohrpost.client.' + sessionId, {"remove": ['http.public.*']});
        assert.deepEqual(session.whitelist, ['redis.public.*']);
        assert.equal(redisPubSub.listeners('http.public.*').length, 0);
    });

    it('does allow sessionData to be changed', function() {
        redisPubSub.emit('rohrpost.client.' + sessionId, {"sessionData": {key: "value"}});
        assert.deepEqual(session.data, {key: 'value'});
    });

});