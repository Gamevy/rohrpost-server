module.exports = function(config, child_process, logger) {
	var that = this;

	var activeWorkers = {};
	var terminating = false;

	var restartCounterMax = 10;

	var _ = require('underscore');

	function forkWorker(port) {
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
		return worker;
	}

	that.start = function() {
		_.each(config.http.workerPorts, function(port) {
			var remainingRestarts = restartCounterMax;
			var worker = forkWorker(port);

			function onExit() {
				delete activeWorkers[port];
				if (!terminating) {
					if (remainingRestarts > 0) {
						logger.warn("Worker for port %d exited. Trying to restart %d times", port, remainingRestarts);
						remainingRestarts--;
						worker = forkWorker(port);
						worker.once('exit', onExit);
						activeWorkers[port] = worker;
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

			worker.once('exit', onExit);
			activeWorkers[port] = worker;
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

	setTimeout(beginRecyclingWorkers, config.http.recyclingSeconds * 1000);

    function beginRecyclingWorkers() {
        logger.info("Recycling workers");
        var workerPorts = _shuffle(_.keys(activeWorkers));
        recycleWorkers(workerPorts);
    }

    function recycleWorkers(workerPorts, next) {
        if (workerPorts.length == 0) {
            setTimeout(beginRecyclingWorkers, config.http.recyclingSeconds * 1000);
            return;
        }

        var port = workerPorts.pop();
        logger.info("Recycling worker:", port);
        var worker = activeWorkers[port];
        // recycle the next worker once this one has finished
        worker.once('exit', function() {
            setTimeout(function() {
                recycleWorkers(workerPorts);
            }, 5000);
        });
        // remove worker from the pool first
        delete activeWorkers[port];
        // send kill signal
        worker.kill();
    }
}
