/**
 * This class handles the most of the actuall work e.g. taking
 * data received from the socket, filtering and turning it into
 * pubsub messages.
 * It also works the other way around and converts pubsub messages
 * into messages to be sent over the websocket
 */
var _ = require('underscore');
var request = require('request');
var safeJsonParser = require('./safeJsonParser.js');
var wildcardsToRegex = require('./wildcardsToRegex.js');

module.exports = function(redisPubSub, httpRequestRouter, session, sessionId, connection, logger) {
    var that = this;

    /*************************
     * From client to backend
     *************************/
    connection.on('data', function(payloadAsString) {
        try {
            var payload = JSON.parse(payloadAsString);
            var topic = payload.topic;
            var data = payload.data;

            if (data === undefined || !topic) {
                log.warn('Couldn\'t handle %s', payloadAsString)
            } else if (session.topicWhitelisted(topic)){
                // The payload we send to the backend always has a flag
                // "fromClient" to make sure it's not passed to other
                // clients. The sessionId can be used to directly target
                // one connection.
                var payload = {
                    data: data,
                    sessionData: session.data,
                    fromClient: true,
                    sessionId: sessionId
                };

                // If the route matches one of the rules defined in the config
                // make a http request, otherwise publish via redis
                var httpRoute = httpRequestRouter.route(topic);
                if (httpRoute) {

                    // Http requests can respond directly to a message, therefore
                    // we have to handle the response as if it was a pub/sub
                    // message send from the backend
                    request(httpRoute, {
                            json: true,
                            body: payload,
                            method: 'POST'
                        }, function(error, response, body) {
                            if (error) {
                                logger.warn("Couldn't handle request to %s: %s", httpRoute, body);
                            } else {

                                handleIncomingDataFromBackend(body, null);
                            }
                    });
                } else {

                    // This is the default behaviour if no route is found
                    redisPubSub.publish(topic, payload);
                }
            } else {
                log.info('User is not whitelisted for topic %s', topic)
            }

        } catch (e) {
            logger.warn('Couldn\'t handle %s', payloadAsString);
        }
    });


    /*************************
     * From backend to client
     *************************/
    function handleIncomingDataFromBackend(payloadIncoming, topic) {
        if (!payloadIncoming.fromClient) {
            if (payloadIncoming.topic) {
                topic = payloadIncoming.topic;
            }
            handleSessionChanges(payloadIncoming);
            if (payloadIncoming.data !== undefined && topic && session.topicWhitelisted(topic)) {
                var payloadOutgoing = {
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
    redisPubSub.on('rohrpost.client.' + sessionId , handleIncomingDataFromBackend);

    /**
     * Subscribe to all whitelisted topics
     */
    _.each(session.whitelist, function(whitelistedTopic) {
        redisPubSub.on(whitelistedTopic, handleIncomingDataFromBackend);
    });

    /**
     * Every incoming payload from the backend can change the topic
     * whitelist. This function handles the necessary paperwork.
     */
    function handleSessionChanges(payloadIncoming) {
        var changed = false;

        // Adding
        if (Array.isArray(payloadIncoming.add)) {
            _.each(payloadIncoming.add, function(topic) {
                redisPubSub.on(topic, handleIncomingDataFromBackend);
                session.whitelistTopic(topic);
            });
            changed = true;
        }

        // Removing
        if (Array.isArray(payloadIncoming.remove)) {
            _.each(payloadIncoming.remove, function(topic) {
                redisPubSub.removeListener(topic, handleIncomingDataFromBackend);
            });
            session.whitelist = _.difference(session.whitelist, payloadIncoming.remove);
            changed = true;
        }

        // Modifying sessionData
        if (typeof payloadIncoming.sessionData == 'object') {
            session.data = payloadIncoming.sessionData;
            changed = true;
        }

        // Only update the database if the connection object has been changed
        if (changed) {
            session.save();
        }
    }

    // TODO: Unsubscribe!
}