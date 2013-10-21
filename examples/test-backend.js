/**
 * This is a backend service used for the frontend test,
 * but it's also a good place to see how to communicate with
 * the server
 */
var redis = require('redis');

var port = 6379;
var host = '127.0.0.1';

// To allow both sending and receiving we have to open two clients
var emitter = redis.createClient(port, host);
var receiver = redis.createClient(port, host);

receiver.on('pmessage', function (pattern, channel, payloadAsString) {
    // Redis gives us a string, we need to parse it first
    var payload = JSON.parse(payloadAsString);

    // This is the main data object rohrpost has received
    var data = payload.data;

    // This is the session id of the connection that created this message
    var sessionId = payload.sessionId;

    // This is a simple ping topic that echos all the data to
    // a topic called pong
    if (channel == 'anonym.ping') {
        console.log('received anonym.ping:', data);
        var responsePayload = { data: data };
        emitter.publish('anonym.pong', JSON.stringify(responsePayload));
    }

    // This is exactly like the one before but for a restriced topic
    if (channel == 'members.ping') {
        console.log('received members.ping:', data);
        var responsePayload = { data: data };
        emitter.publish('members.pong', JSON.stringify(responsePayload));
    }

    // Backends can whitelist clients for more topics
    if (channel == 'anonym.members.login') {
        console.log('member login');
        var responsePayload = {
            add: ['members.*'],
            data: null,              // Setting data to null means a message will be sent to the client
            topic: 'members.welcome' // Topics can be overwritten
        };

        // A certain connection can be directly targeted
        emitter.publish('rohrpost.client.' + sessionId + '.whitelist', JSON.stringify(responsePayload));
    }
});

// subscribe to some events
receiver.psubscribe('anonym.*');
receiver.psubscribe('members.*');