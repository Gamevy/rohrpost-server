if (process.argv.length != 3) {
	throw "Only one argument allowed"
}
var port = parseInt(process.argv[2]);

// Node API
var childProcesses = require('child_process');

// External imports
var sockjs = require('sockjs');

// Classes
var Socket = require('./Socket.js');
var SessionFactory = require('./SessionFactory.js');
var Session = require('./Session.js');
var RedisPubSub = require('./RedisPubSub.js');
var SocketDataHandler = require('./SocketDataHandler.js');

// Instances
var config = require('../config.js');
var logger = require('./logger.js');
var redisClient = require('redis').createClient(config.redis.sessionStore.port, config.redis.sessionStore.host);

// Dependency Injection=
var sessionFactory = new SessionFactory(config, redisClient, Session);
var redisPubSub = new RedisPubSub(config);
var socket = new Socket(config, sockjs, sessionFactory, redisPubSub, SocketDataHandler, logger);

// Start
redisClient.on('ready', function() {
    logger.info('Connected to sessionStore');
    socket.start(port);
});

