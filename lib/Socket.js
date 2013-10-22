module.exports = function(config, sockjs, sessionFactory, redisPubSub, httpRequestRouter, SocketDataHandler, logger) {
	var that = this;

	var http  = require('http');
	var https = require('https');

	var _ = require('underscore');

	var terminating = false;

	var connectionCount = 0;

	that.start = function(port) {
		var sockjsServer = sockjs.createServer();

		// Proxy sockjs log message through to winston
		sockjsServer.log = function(severity, message) {
			if (severity == 'debug') {
				log.info(message); // Afaik there's no debug in winston yet.
			} else if (severity == 'info') {
				log.info(message);
			} else if (severity == 'error') {
				log.error(message);
			} else {
				log.warn('Unknown sockjs severity level %s. Message: %s', severity, message);
			}
		};

		sockjsServer.on('connection', function(conn) {
			if (terminating) {
				conn.close(100, 'This server is terminating - please reconnect');
			}

			that.once('terminating', function() {
				conn.close(100, 'This server is terminating - please reconnect');
				decreaseConnectionCount();
			});

		    conn.once('data', function(sessionId) {
		    	sessionId = sessionId.replace('.', '');
		    	var session = sessionFactory.getSession(sessionId, function(err, session) {
		    		if (err) {
		    			logger.error("Something went wrong whilst looking up a session:", err);
		    		} else {
		    			conn.write('ok:' + sessionId);

		 				new SocketDataHandler(redisPubSub, httpRequestRouter, session, sessionId, conn, logger);
		    		}
		    	});
		    });

		    increaseConnectionCount();
		    conn.on('close', _.once(function() {
		    	decreaseConnectionCount();
		    }));
		});

		var server = null;
		if(config.http.https) {
			server = https.createServer(config.http.httpsOptions);
		} else {
			server = http.createServer();
		}
		sockjsServer.installHandlers(server, {prefix:'/rohrpost'});
		server.listen(port, config.http.host);

		logger.info("Websocket server listening on %s:%s", config.http.host, port);
	};

	/**
	 * Connection counter
	 * This is important for shutdowns and graphs. I like graphs.
	 */
	function increaseConnectionCount() {
		connectionCount++;
	}

	function decreaseConnectionCount() {
		connectionCount--;
		checkForExit();
	}

	function checkForExit() {
		if (terminating && connectionCount == 0) {
			logger.info("No connections open. Bye!");
			process.exit(1);
		}
	}

	/**
	 * Gracefull shutdown
	 * Send reconnect-message to all connections
	 */

	function gracefulShutdown() {
		terminating = true;
		that.emit('terminating');
		checkForExit();
		logger.info('Waiting for clients to disconnect, forcefully shutting down in 20 sec');
		setTimeout(function() {
			logger.info('Still %d clients connected. Shutting down anyway.', connectionCount);
			process.exit(1);
		}, 20000);
	}

	process.on('SIGINT', gracefulShutdown).on('SIGTERM', gracefulShutdown) ;
}

require('util').inherits(module.exports, require("events").EventEmitter);