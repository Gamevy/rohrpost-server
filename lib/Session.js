var _ = require('underscore');
var wildcardsToRegex = require('./wildcardsToRegex.js');
/**
 * A session is valid for the time a user connects via the same client
 * instance. This is important in case the client has to perform a
 * reconnect.
 * The most important bit of information stored in here is the topic
 * whitelist that keeps track of all topics this client is allowed to
 * send or receive.
 */
module.exports = function(rawObject, hash, defaultWhitelist, redisClient) {
    var that = this;

    var newSession = !rawObject;

    that.created = (rawObject && rawObject.created) ? new Date(parseInt(rawObject.created, 10)) : new Date();
    that.whitelist = (rawObject && rawObject.whitelist) ? rawObject.whitelist.split('|') : JSON.parse(JSON.stringify(defaultWhitelist));
    that.data = {}

    _.each(rawObject, function(value, key) {
        if (key.indexOf('data_') === 0) {
            that.data[key.slice(5)] = value;
        }
    });

    that.save = function() {
        var sessionObject = {};
        _.each(that.data, function(value, key) {
            sessionObject['data_' + key] = value;
        });
        sessionObject.created = that.created.getTime();
        sessionObject.whitelist = that.whitelist.join('|');
        redisClient.hmset(hash, sessionObject);
    };

    that.whitelistTopic = function(topic) {
        if (_.contains(that.whitelist, topic)) {
            return false;
        }
        that.whitelist.push(topic);
        return true;
    }


    that.topicWhitelisted = function(topic) {
        return _.any(that.whitelist, function(topicRegex) {
            return wildcardsToRegex(topicRegex).test(topic);
        });
    }

    if (newSession) {
        that.save();
    }
}