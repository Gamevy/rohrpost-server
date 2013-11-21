#!/usr/bin/env node

// Node API
var child_process = require('child_process');

// Classes
var HttpServer = require('./HttpServer.js');
var Supervisor = require('./Supervisor.js');

// Instances
var path = require("path"),
    exists = require("fs").existsSync,
    configPath = process.env.ROHRPOST_CONFIG || path.resolve(__dirname, "../config/config.js");

if (!exists(configPath)) {
    configPath = "/etc/rohrpost/config.js";
}

var config = require(configPath);
var logger = require('./logger.js');

// Dependency Injection
var supervisor = new Supervisor(config, child_process, logger);
var httpServer = new HttpServer(config, supervisor, logger);

// Start
supervisor.start();
httpServer.start();

