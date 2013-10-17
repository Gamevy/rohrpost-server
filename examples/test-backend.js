/**
 * This is a backend service used for the frontend test,
 * but it's also a good place to see how to communicate with
 * the server
 */
var redis = require('redis');

var port = 6379;
var host = 127.0.0.1;

// To allow both sending and receiving we have to open two clients
var emitter = redis.createClient(port, host);
var receiver = redis.createClient(port, host);

receiver.on('pmessage', function (pattern, channel, payloadAsString) {
    // Redis gives us a string, we need to parse it first
    var payload = JSON.parse(payloadAsString);

    // This is the main data object rohrpost has received
    var data = payload.data;

    // This is a simple ping topic that echos all the data to
    // a topic called pong
    if (pattern == 'anonym.ping') {
        var responsePayload = { data: data };
        emitter.publish('anonym.pong', JSON.stringify(responsePayload));
    }
});

// subscribe to some events
this.receiver.psubscribe('anonym.ping');