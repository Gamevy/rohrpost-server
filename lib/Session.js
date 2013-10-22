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
    that.whitelist = (rawObject && rawObject.whitelist) ? rawObject.whitelist.split('|') : defaultWhitelist;

    that.save = function() {
        redisClient.hmset(hash, {
            created: that.created.getTime(),
            whitelist: that.whitelist.join('|')
        });
    };

    that.whitelistTopic = function(topic) {
        that.whitelist.push(topic);
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