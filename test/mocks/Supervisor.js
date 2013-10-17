var sinon = require('sinon');

module.exports = function() {
	this.start = sinon.spy();
	this.getRandomAvailablePort = function() {
		return 1337;
	}
}