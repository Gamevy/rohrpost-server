/**
 * This class handles the most of the actuall work e.g. taking
 * data received from the socket, filtering and turning it into
 * pubsub messages.
 * It also works the other way around and converts pubsub messages
 * into messages to be sent over the websocket
 */
module.exports = function(redisPubSub, session, connection, logger) {
    var that = this;

    connection.on('data', function(payloadAsString) {
        try {
            var payload = JSON.parse(payloadAsString);
            var topic = payload.topic;
            var data = payload.data;
            if (!data || !topic) {
                log.warn('Couldn\'t handle %s', payloadAsString)
            } else if (session.topicWhitelisted(topic)){
                console.log(topic);
                console.log(data);
            } else {
                log.warn('User is not whitelisted for topic %s', topic)
            }

        } catch (e) {
            logger.warn('Couldn\'t handle %s', payloadAsString);
        }
    });

}