/**
 * This class handles the most of the actuall work e.g. taking
 * data received from the socket, filtering and turning it into
 * pubsub messages.
 * It also works the other way around and converts pubsub messages
 * into messages to be sent over the websocket
 */
var _ = require('underscore');
var safeJsonParser = require('./safeJsonParser.js');
module.exports = function(redisPubSub, session, sessionId, connection, logger) {
    var that = this;

    /*************************
     * From client to backend
     *************************/
    connection.on('data', function(payloadAsString) {
        try {
            var payload = safeJsonParser(payloadAsString);
            var topic = payload.topic;
            var data = payload.data;
            if (data === undefined || !topic) {
                log.warn('Couldn\'t handle %s', payloadAsString)
            } else if (session.topicWhitelisted(topic)){
                var payload = {
                    data: data,
                    fromClient: true,
                    sessionId: sessionId
                }
                redisPubSub.publish(topic, payload);
            } else {
                log.warn('User is not whitelisted for topic %s', topic)
            }

        } catch (e) {
            logger.warn('Couldn\'t handle %s', payloadAsString);
        }
    });


    /*************************
     * From backend to client
     *************************/
    function handleIncomingData(payloadIncoming, topic) {
        if (!payloadIncoming.fromClient) {
            if (payloadIncoming.topic) {
                topic = payloadIncoming.topic;
            }
            handleWhitelistChanges(payloadIncoming);
            if (payloadIncoming.data !== undefined && session.topicWhitelisted(topic)) {
                payloadOutgoing = {
                    topic: topic,
                    data: payloadIncoming.data
                };
                connection.write(JSON.stringify(payloadOutgoing));
            }
        }
    }

    /** Special topic especially for this connection
     * Can be used for changing the whitelist without sending
     * a message through to the client
     */
    redisPubSub.on('rohrpost.client.' + sessionId + '.whitelist', handleIncomingData);

    /**
     * Subscribe to all whitelisted topics
     */
    _.each(session.whitelist, function(whitelistedTopic) {
        redisPubSub.on(whitelistedTopic, handleIncomingData);
    });

    /**
     * Every incoming payload from the backend can change the topic
     * whitelist. This function handles the necessary paperwork.
     */
    function handleWhitelistChanges(payloadIncoming) {
        var changed = false;
        if (Array.isArray(payloadIncoming.add)) {
            _.each(payloadIncoming.add, function(topic) {
                redisPubSub.on(topic, handleIncomingData);
                session.whitelistTopic(topic);
            });
            changed = true;
        }
        if (Array.isArray(payloadIncoming.remove)) {
            _.each(payloadIncoming.remove, function(topic) {
                redisPubSub.removeListener(topic, subscribeForTopic);
            });
            session.whitelist = _.difference(session.whitelist, payloadIncoming.remove);
            changed = true;
        }
        if (changed) {
            session.save();
        }
    }

    // TODO: Unsubscribe!
}