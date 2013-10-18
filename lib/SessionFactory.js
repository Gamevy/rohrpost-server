/**
 * Information about sessions are stored in redis to
 * allow other processes to take over after a reconnect.
 * All the client has to do is generate a session id
 * before its first connection attempt and resubmit it
 * every time after a reconnect.
 */
module.exports = function(config, redisClient, Session) {

    var Session = require('./Session.js');

    this.getSession = function(sessionId, callback) {
        var hash = getHash(sessionId);
        redisClient.hgetall(hash, function(err, session) {
            if (err) {
                callback(err);
            } else {
                callback(null, new Session(session, hash, config.defaultWhitelist, redisClient));
            }
        });
    }

    function getHash(sessionId) {
        return 'session:' + sessionId;
    }

}
