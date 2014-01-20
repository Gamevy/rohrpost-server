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

module.exports = function(rabbit, httpRequestRouter, session, sessionId, connection, logger, stats) {
    var that = this;
    var queues = {};

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
                // make a http request, otherwise publish via rabbit
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
                    rabbit.publish(topic, payload);

                    stats.increment('incoming.valid.rabbit_publish');
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
                if (payloadIncoming.data !== undefined && topic && session.topicWhitelisted(topic)) {
                    var payloadOutgoing = {
                        topic: topic,
                        data: payloadIncoming.data
                    };
                    connection.write(JSON.stringify(payloadOutgoing));
                    stats.increment('outgoing.all');
                } 
            }
        }
    }

    function handleIncomingDataFromBackendViaTopic(message, header, deliveryInfo) {
        logger.info('Received message from rabbit. Message: %j, Header: %j, Delivery info: %j', message, header, deliveryInfo);
        /*if (!message.fromClient) {
            if (topic && session.topicWhitelisted(topic)) {
                handleSessionChanges(message);
            }
            handleIncomingDataFromBackend(message, topic);
        }*/
    }

    /** Special topic especially for this connection
     * Can be used for changing the whitelist without sending
     * a message through to the client
     */
    rabbit.queue('rohrpost.client.' + sessionId , function(queue) {
        queue.subscribe(function(message, headers, deliveryInfo) {
            if (!message.fromClient) {
                handleSessionChanges(message);
                handleIncomingDataFromBackend(message, queue.name);
            }
        });
    });

    /**
     * Subscribe to all whitelisted topics
     */
    _.each(session.whitelist, function(whitelistedTopic) {
        rabbit.queue(whitelistedTopic, function(queue) {
            queue.subscribe(handleIncomingDataFromBackendViaTopic)
                .addCallback(function(ok) {
                    logger.info('Successfully subscribed to %s. ok: %j', whitelistedTopic, ok);
                    queues[whitelistedTopic] = { queue: queue, ctag: ok.consumerTag };
                });
        });
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
                        rabbit.queue(topic, function(queue) {
                            queue.subscribe(handleIncomingDataFromBackendViaTopic)
                                .addCallback(function(ok) {
                                    logger.info('Successfully subscribed to %s. ok: %j', topic, ok);
                                    queues[topic] = { queue: queue, ctag: ok.consumerTag };
                                });
                        });
                        stats.increment('session.whitelist.add');
                    }
                });
                changed = true;
                logger.info('New whitelist for ' + sessionId + ':', session.whitelist);
            }

            // Removing
            if (Array.isArray(payloadIncoming.remove)) {
                _.each(payloadIncoming.remove, function(topic) {
                    var queueRef = queues[topic];
                    queueRef.queue.unsubscribe(queueRef.ctag);
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
