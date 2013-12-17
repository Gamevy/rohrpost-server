module.exports = function(config, sockjs, sessionFactory, redisPubSub, httpRequestRouter, SocketDataHandler, logger, stats) {
    var that = this;

    var http  = require('http');
    var https = require('https');

    var _ = require('underscore');

    var terminating = false;

    var connectionCount = 0;

    that.start = function(port) {
        var sockjsServer = sockjs.createServer({
            log:  function(severity, message) {
                if (severity == 'debug') {
                    logger.debug(message);
                } else if (severity == 'info') {
                    logger.info(message);
                } else if (severity == 'error') {
                    logger.error(message);
                } else {
                    logger.warn('Unknown sockjs severity level %s. Message: %s', severity, message);
                }
            }
        });

        sockjsServer.on('connection', function(conn) {
            function close() {
                conn.removeAllListeners('close');
                conn.close(100, 'This server is terminating - please reconnect');
                decreaseConnectionCount();
                that.removeListener('terminating', close);
            }

            if (terminating) {
                close();
            }

            that.once('terminating', close);

            conn.once('data', function(sessionId) {
                sessionId = sessionId.replace('.', '');
                sessionFactory.getSession(sessionId, function(err, session) {
                    if (err) {
                        logger.error("Something went wrong whilst looking up a session:", err);
                    } else {
                        conn.write('ok:' + sessionId);
                        new SocketDataHandler(redisPubSub, httpRequestRouter, session, sessionId, conn, logger, stats);

                        // Make sure all sessions are not timing out whilst still being used
                        sessionIntervalId = setInterval(session.updateTtl, 60 * 1000);
                    }
                });
            });

            var sessionIntervalId = null;
            increaseConnectionCount();
            conn.on('close', _.once(function() {
                decreaseConnectionCount();
                if (sessionIntervalId) {
                    clearInterval(sessionIntervalId);
                }
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
        that.emit('ready');
    };

    /**
     * Connection counter
     * This is important for shutdowns and graphs. I like graphs.
     */
    function reportConnectionCount() {
        if (process.connected) {
            process.send({status: 'connectionCount', connectionCount: connectionCount});
        }
    }
    function increaseConnectionCount() {
        connectionCount++;
        reportConnectionCount();
    }

    function decreaseConnectionCount() {
        connectionCount--;
        reportConnectionCount();
        checkForExit();
    }

    reportConnectionCount();

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
        setTimeout(function() {
            connectionCount = 0;
            reportConnectionCount();
            logger.info('Shutting down.', connectionCount);
            process.exit(1);
        }, 100);
    }

    process.on('SIGINT', gracefulShutdown).on('SIGTERM', gracefulShutdown);
}

require('util').inherits(module.exports, require("events").EventEmitter);
