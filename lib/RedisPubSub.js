/**
 * This a simple wrapper for pubsub via redis.
 *
 * Behaves pretty much like events.EventEmitter with the difference
 * that emit() calls the internal event handlers without publishing
 * to a topic whilst publish() is the function that actually sends
 * a message to redis.
 *
 * All the usual functions from EventEmitter work like you'd expect,
 * e.g. on(), once(), setMaxListeners(), removeListener() and
 * removeAllListeners(). See http://nodejs.org/api/events.html
 *
 * Wildcards "*" are allowed for on() and once() are allowd as
 * described in http://redis.io/topics/pubsub
 *
 * Listeners will receive two parameters, a payload as javascript
 * object and the actual channel name (useful in case wildcards have
 * been used).
 *
 * Multiple subscriptions to the same topic will not create multiple
 * subscriptions with redis, it's therefore safe to subscribe to the
 * same topic(-pattern) more than once. If all listeners are removed
 * from one topic the subscription will be removed from redis.
 */
var EventEmitter = require('events').EventEmitter;

module.exports = function(redisEmitter, redisReceiver) {
    var that = this;

    /************
     * Receiving
     ************/
    var subscribedMessages = {}; // Object for quicker lookup

    that.on('newListener', function(topic) {
        if (topic == 'removeListener') {
            return;
        }
        if (!subscribedMessages.hasOwnProperty(topic)) {
            redisReceiver.psubscribe(topic);
            subscribedMessages[topic] = true;
        }
    });

    that.on('removeListener', function(topic) {
        if (EventEmitter.listenerCount(that, topic) == 0 && subscribedMessages[topic]) {
            redisReceiver.punsubscribe(topic);
            delete subscribedMessages[topic];
        }
    });

    redisReceiver.on('pmessage', function (pattern, channel, payload) {
        try {
            that.emit(pattern, JSON.parse(payload), channel);
        } catch (e) {
            console.log("Warning: Counldn't parse topic on channel %s with payload %s", channel, payload);
        }
    });

    /************
     * Publishing
     ************/
    that.publish = function(topic, message) {
        redisEmitter.publish(topic, JSON.stringify(message));
    }

}

require('util').inherits(module.exports, EventEmitter);