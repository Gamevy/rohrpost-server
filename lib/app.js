#!/usr/bin/env node

// Node API
var child_process = require('child_process');

// Classes
var HttpServer = require('./HttpServer.js');
var Supervisor = require('./Supervisor.js');
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
    name: 'supervisor',
    stream: process.stdout,
    level: 'info'
});

// Dependency Injection
var stats = Stats.create(config);
var supervisor = new Supervisor(config, child_process, logger, stats);
var httpServer = new HttpServer(config, supervisor, logger);

// Start
supervisor.start();
httpServer.start();

