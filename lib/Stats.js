var StatsD = require('node-statsd').StatsD;

module.exports = {
    create: function(config, logger) {
        var statsdConfig = config.statsd || { mock: true };
        if (statsdConfig.mock) {
            logger.info('Using statsd client in mock mode');
        }
        return new StatsD(statsdConfig);
    }
}