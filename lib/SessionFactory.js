/**
 * Information about sessions are stored in redis to
 * allow other processes to take over after a reconnect.
 * All the client has to do is generate a session id
 * before its first connection attempt and resubmit it
 * every time after a reconnect.
 */
module.exports = function(config, redis) {

    var Session = require('./Session.js');

    this.getSession = function(sessionId, callback) {
        redis.hgetall(getHash(sessionId), function(err, session) {
            if (err) {
                callback(err);
            } else {
                if (!session.hasOwnProperty('created')) {
                    session.created = ;
                }
                addFunctionsToSession(session, sessionId);
                callback(null, new Session(session));
            }
        });
    }

    function addFunctionsToSession(session, sessionId) {
        session.save = function() {
            redis.hmset(getHash(sessionId), session);
        }
    }

    function getHash(sessionId) {
        return 'session:' + parseInt(sessionId);
    }

}
