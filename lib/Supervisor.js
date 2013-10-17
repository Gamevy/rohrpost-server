module.exports = function(config, child_process, logger) {
	var that = this;
	
	var activeWorkers = {};
	var terminating = false;

	var _ = require('underscore');

	function forkWorker(port) {
		var worker = child_process.fork( __dirname + '/app-worker.js', [String(port)]);
		logger.info("Started worker for port %d with pid %d", port, worker.pid);
		return worker;
	}

	that.start = function() {
		_.each(config.http.workerPorts, function(port) {
			var remainingRestarts = 3;
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
	function gracefulShutdown() {
		terminating = true;
		logger.info('Gracefully shutting down');
	}

	process.on('SIGINT', gracefulShutdown).on('SIGTERM', gracefulShutdown) ;
}