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
var RedisPubSub = require('./RedisPubSubFactory.js');
var SocketDataHandler = require('./SocketDataHandler.js');
var HttpRequestRouter = require('./HttpRequestRouter.js');

// Instances
var config = require('/etc/rohrpost/config.js');
var logger = require('./logger.js');
var redisClient = require('redis').createClient(config.redis.sessionStore.port, config.redis.sessionStore.host);
var redisPubSub = RedisPubSub.createClient(config.redis.pubSub.port, config.redis.pubSub.host);

// Dependency Injection
var httpRequestRouter = new HttpRequestRouter(config);
var sessionFactory = new SessionFactory(config, redisClient, Session);
var socket = new Socket(config, sockjs, sessionFactory, redisPubSub, httpRequestRouter, SocketDataHandler, logger);

// Start
redisClient.on('ready', function() {
    socket.start(port);
});

