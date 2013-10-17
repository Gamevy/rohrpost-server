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

// Instances
var config = require('../config.js');
var logger = require('./logger.js');

// Dependency Injection
var socket = new Socket(config, sockjs, logger);

// Start
socket.start(port);

