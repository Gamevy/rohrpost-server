/**
 * This is a backend service used for the frontend test,
 * but it's also a good place to see how to communicate with
 * the server
 */
var redis = require('redis');
var express = require('express');

// Redis config
var redisPort = 6379;
var redisHost = '127.0.0.1';

// HTTP config
var httpPort = 97354;

// To allow both sending and receiving we have to open two clients
var emitter = redis.createClient(redisPort, redisHost);
var receiver = redis.createClient(redisPort, redisHost);

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
    // Even though it's possible to do it this way there are lots of problems
    // with scalability this way. Everything that maps to a request-response
    // pattern should probably be done with http instead (see below)
    if (channel == 'anonym.members.login') {
        console.log('member login');
        var responsePayload = {
            add: ['members.*'],
            data: null,              // Setting data to null means a message will be sent to the client
            topic: 'members.welcome' // Topics can be overwritten
        };

        // A certain connection can be directly targeted
        emitter.publish('rohrpost.client.' + sessionId, JSON.stringify(responsePayload));
    }
});

// We can also route some messages via http -
var app = express();
app.use(express.json());

// This is how a ping would look like in http
app.post('/anonym.http.ping', function(req, res) {
    var payload = req.body;
    var data = payload.data;
    console.log('anonym.http.ping:', data);
    res.send({
        data: data,
        topic: 'anonym.http.pong'
    })
});

// This is how the login would look like in http
app.post('/anonym.http.login', function(req, res) {
    var payload = req.body;
    var data = payload.data;
    console.log('member login via http:', data);
    res.send({
        add: ['members.*'],
        data: null,
        topic: 'members.welcome'
    })
});

// Removing topics from a connection is similar to adding
app.post('/members.http.logout', function(req, res) {
    var payload = req.body;
    var data = payload.data;
    console.log('member logout via http:', data);
    res.send({
        remove: ['members.*'],
        data: null,
        topic: 'anonym.members.logout.success'
    });
});

app.listen(httpPort);

// subscribe to some events
receiver.psubscribe('anonym.*');
receiver.psubscribe('members.*');