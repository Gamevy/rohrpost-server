/**
 * This class keeps a pre-processed version of the httpTopic rules defined in
 * the config around to allow quick lookups
 */
var wildcardsToRegex = require('../lib/wildcardsToRegex.js');
var _ = require('underscore');

module.exports = function(config) {
    var that = this;

    // Pre-process all the rules
    var httpRegExps = [];
    _.each(config.httpTopics, function(connection, rule) {
        httpRegExps.push({
            regExp: wildcardsToRegex(rule),
            connection: connection
        });
    });

    /**
     * Looks up a topic and returns null or a connection object as defined in
     * the config.
     */
    that.route = function(topic) {
        var result = _.find(httpRegExps, function(data) {
            return data.regExp.test(topic);
        });
        if (!result) {
            return null;
        }
        return 'http://' + result.connection.host + ':'
            + result.connection.port + '/'
            + encodeURIComponent(topic);
    }
}