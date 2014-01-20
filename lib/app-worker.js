if (process.argv.length != 3) {
    throw "Only one argument allowed"
}
var port = parseInt(process.argv[2]);

// External imports
var sockjs = require('sockjs');
var amqp = require('amqp');

// Classes
var Socket = require('./Socket.js');
var SessionFactory = require('./SessionFactory.js');
var Session = require('./Session.js');
var SocketDataHandler = require('./SocketDataHandler.js');
var HttpRequestRouter = require('./HttpRequestRouter.js');
var Stats = require('./Stats.js');

// Instances
var path = require("path"),
    exists = require("fs").existsSync,
    configPath = process.env.ROHRPOST_CONFIG || path.resolve(__dirname, "../config/config.js");

if (!exists(configPath)) {
    configPath = "/etc/rohrpost/config.js";
}

var config = require(configPath);
var bunyan = require('bunyan');
var logger = bunyan.createLogger({
    name: 'worker',
    port: port,
    stream: process.stdout,
    level: 'debug'
});

var connection = amqp.createConnection({ host: 'localhost' });
connection.on('error', function(err) {
    logger.error('Rabbit error:', err);
});

var redisClient = require('redis').createClient(config.redis.sessionStore.port, config.redis.sessionStore.host);
redisClient.on('error', function(err) {
    logger.error('Redis error:', err);
});

// Debug
if (config.http.debugWorker) {
    logger.info('Loading webkit-devtools-agent for debugging mode');
    require("webkit-devtools-agent");
}

// Dependency Injection
var stats = Stats.create(config, logger);
var httpRequestRouter = new HttpRequestRouter(config);
var sessionFactory = new SessionFactory(config, redisClient, Session);
var socket = new Socket(config, sockjs, sessionFactory, connection, httpRequestRouter, SocketDataHandler, logger, stats);

// Start
connection.once('ready', function() {
    logger.info('Connected to rabbit');
    socket.on('ready', function() {
        if (process.connected) {
            process.send({status: 'ready'});
        } else {
            logger.error('Child process is not connected to supervisor');
            process.exit();
        }
    });
    socket.start(port);
});
