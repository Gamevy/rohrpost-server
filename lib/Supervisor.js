module.exports = function(config, child_process, logger, stats) {
    var that = this;

    var activeWorkers = {};
    var connectionCountPerWorker = {};
    var recyclingQueue = [];
    var terminating = false;

    var restartCounterMax = 10;

    var _ = require('underscore');

    function reportConnectionCount() {
        var sum = 0;
        _.each(connectionCountPerWorker, function(count) {
            sum += count;
        });       
        logger.info('Current connections:', sum);
        stats.gauge('connections', sum);
    }

    reportConnectionCount();

    function forkWorker(port, onExit) {
        options = {};
        if (config.http.debugWorker) {
            var arg = '--debug=' + (port + 60000);
            options.execArgv = [arg];
            logger.info("Forking worker with %s", arg);
        }
        var worker = child_process.fork(
            __dirname + '/app-worker.js',
            [String(port)],
            options);
            logger.info("Started worker for port %d with pid %d", port, worker.pid);
            worker.on('message', function(data) {
                if (data.status == 'ready') {
                    logger.info('Worker on port %s ready, adding to pool', port);
                    activeWorkers[port] = worker;
                    recyclingQueue.push(port);
                }

                if (data.status == 'connectionCount') {
                    connectionCountPerWorker[port] = data.connectionCount;
                    reportConnectionCount();
                }
            });
            worker.once('exit', onExit);
    }

    that.start = function() {
        _.each(config.http.workerPorts, function(port) {
            var remainingRestarts = restartCounterMax;

            function onExit() {
                delete activeWorkers[port];
                delete connectionCountPerWorker[port];
                reportConnectionCount();
                if (!terminating) {
                    if (remainingRestarts > 0) {
                        logger.warn("Worker for port %d exited. Trying to restart %d times", port, remainingRestarts);
                        remainingRestarts--;
                        forkWorker(port, onExit);
                    } else {
                        logger.warn("Worker for port %d exited. No restart will be attempted any more.", port);
                    }
                } else {
                    logger.info("Worker for port %d exited.", port);
                }

                if (_.keys(activeWorkers).length == 0) {
                    logger.info("No workers left. Bye!");
                    process.exit(1);
                }
            }

            setInterval(function() {
                if (remainingRestarts < restartCounterMax) {
                    logger.info("Reset remainingRestarts from %d to %d", remainingRestarts, restartCounterMax)
                    remainingRestarts = restartCounterMax;
                }
            }, 60 * 1000);

            forkWorker(port, onExit);
        });
    }

    that.getRandomAvailablePort = function() {
        var activePorts = _.keys(activeWorkers);
        if (terminating || activePorts.length == 0) {
            return null;
        }

        return activePorts[Math.floor(Math.random() * activePorts.length)];
    }

    // Gracefull shutdown
    function handleShutdownCommand() {
        if (!terminating) {
            terminating = true;
            _.each(activeWorkers, function(worker) {
                logger.info('Sending SIGTERM to %d', worker.pid);
                worker.kill();
            })
            logger.info('Gracefully shutting down. Press Ctrl+C to skip.');
        } else {
            logger.info('Bye');
            process.exit(1);
        }
    }

    process.on('SIGINT', handleShutdownCommand).on('SIGTERM', handleShutdownCommand) ;

    function setRecycleTimeout() {
        var timeout = config.http.recyclingInterval * 1000;
        logger.info('Next recyle scheduled in %d ms', timeout);
        setTimeout(recycleWorker, timeout);
    }
    

    function recycleWorker(workerPorts, next) {
        if (recyclingQueue.length > 0) {
            var port = recyclingQueue.shift();
            logger.info("Recycling worker:", port);
            var worker = activeWorkers[port];
            // remove worker from the pool first
            delete activeWorkers[port];
            // send kill signal
            worker.kill();
        }
        setRecycleTimeout();
    }

    setRecycleTimeout();
}
