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

module.exports = function(redisPubSub, httpRequestRouter, session, sessionId, connection, logger, stats) {
    var that = this;

    /*************************
     * From client to backend
     *************************/
    connection.on('data', function(payloadAsString) {
        try {
            //logger.info('received from client: ', payloadAsString);
            var payload = JSON.parse(payloadAsString);
            var topic = payload.topic;
            var data = payload.data;

            if (data === undefined || !topic) {
                logger.warn('Couldn\'t handle %s', payloadAsString);
                stats.increment('incoming.invalid');
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
                                logger.error("Couldn't handle request to %s: %s", httpRoute, error);
                                
                                stats.increment('incoming.unhandled_http_request');
                            } else {
                                handleSessionChanges(body);
                                handleIncomingDataFromBackend(body, null);

                                stats.increment('incoming.valid.http');
                            }
                    });                    
                } else {
                    // This is the default behaviour if no route is found
                    redisPubSub.publish(topic, payload);

                    stats.increment('incoming.valid.redis_pubsub');
                }
            } else {
                logger.info('User is not whitelisted for topic %s', topic)
                stats.increment('incoming.not_whitelisted');
            }

        } catch (e) {
            logger.warn('Couldn\'t handle', payloadAsString, e);
        }
    });


    /*************************
     * From backend to client
     *************************/
    function handleIncomingDataFromBackend(payloadIncoming, topic) {
        if (typeof payloadIncoming === 'object') {
            if (!payloadIncoming.fromClient) {
                if (payloadIncoming.topic) {
                    topic = payloadIncoming.topic;
                }
                if (payloadIncoming.data !== undefined && topic) {
                    if (session.topicWhitelisted(topic)) {
                        var payloadOutgoing = {
                            topic: topic,
                            data: payloadIncoming.data
                        };
                        connection.write(JSON.stringify(payloadOutgoing));
                        stats.increment('outgoing.all');
                    } else {
                        logger.warn('Topic not whitelisted, dropping message', topic, payloadIncoming);
                    }
                } 
            }
        }
    }

    function handleIncomingDataFromBackendViaTopic(payloadIncoming, topic) {
        if (!payloadIncoming.fromClient) {
            if (topic && session.topicWhitelisted(topic)) {
                handleSessionChanges(payloadIncoming);
            }
            handleIncomingDataFromBackend(payloadIncoming, topic);
        }
    }

    /** Special topic especially for this connection
     * Can be used for changing the whitelist without sending
     * a message through to the client
     */
    redisPubSub.on('rohrpost.client.' + sessionId , function(payloadIncoming, topic) {
        if (!payloadIncoming.fromClient) {
            handleSessionChanges(payloadIncoming);
            handleIncomingDataFromBackend(payloadIncoming, topic);
        }
    });

    /**
     * Subscribe to all whitelisted topics
     */
    _.each(session.whitelist, function(whitelistedTopic) {
        redisPubSub.on(whitelistedTopic, handleIncomingDataFromBackendViaTopic);
    });

    /**
     * Every incoming payload from the backend can change the topic
     * whitelist. This function handles the necessary paperwork.
     */
    function handleSessionChanges(payloadIncoming) {
        if (typeof payloadIncoming === 'object') {
            var changed = false;

            // Adding
            if (Array.isArray(payloadIncoming.add)) {
                _.each(payloadIncoming.add, function(topic) {
                    // Only add an event listener if that topic isn't in there yet
                    if (session.whitelistTopic(topic)) {
                        redisPubSub.on(topic, handleIncomingDataFromBackendViaTopic);
                        stats.increment('session.whitelist.add');
                    }
                });
                changed = true;
                logger.info('New whitelist for ' + sessionId + ':', session.whitelist);
            }

            // Removing
            if (Array.isArray(payloadIncoming.remove)) {
                _.each(payloadIncoming.remove, function(topic) {
                    redisPubSub.removeListener(topic, handleIncomingDataFromBackendViaTopic);
                    stats.increment('session.whitelist.remove');
                });
                session.whitelist = _.difference(session.whitelist, payloadIncoming.remove);
                changed = true;
            }

            // Modifying sessionData
            if (typeof payloadIncoming.sessionData == 'object') {
                session.data = payloadIncoming.sessionData;
                changed = true;
                stats.increment('session.add');
            }

            // Only update the database if the connection object has been changed
            if (changed) {
                session.save();
                stats.increment('session.save');
            }
        }
    }

    // TODO: Unsubscribe!
}
