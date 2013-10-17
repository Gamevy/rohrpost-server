var assert = require('chai').assert;
var HttpServer = require('../lib/HttpServer.js');
var logger = require('./mocks/logger.js');
var MockSupervisor = require('./mocks/Supervisor.js');
var request = require('request');

describe('HttpServer', function(){

    var httpServer = null;
    var config = null;
    beforeEach(function() {
        config = {
            http: {
                static: __dirname + "/data",
                https: false,
                httpsOptions: {
                    key: require('fs').readFileSync(__dirname + "/../keys/key.pem"),
                    cert: require('fs').readFileSync(__dirname + "/../keys/cert.pem")
                },
                host: "127.0.0.1",
                mainPort: 7680
            }
        };
        httpServer = new HttpServer(config, new MockSupervisor(), logger);
    });

    afterEach(function() {
        httpServer.stop();
    });

    it('returns a valid http response', function(done){
        httpServer.start();

        request({
                uri: 'http://127.0.0.1:7680',
                json: true
            }, 
            function (error, response, body) {

                assert.equal(body.protocol, 'http');
                assert.equal(body.host, '127.0.0.1');
                assert.equal(body.port, 1337);
                done();
            }
        );
    });

    it('returns a valid https response', function(done){
        config.http.https = true;
        httpServer.start();

        request({
                uri: 'https://127.0.0.1:7680',
                json: true,
                strictSSL: false
            }, 
            function (error, response, body) {
                assert.equal(body.protocol, 'https');
                assert.equal(body.host, '127.0.0.1');
                assert.equal(body.port, 1337);
                done();
            }
        );
    });


  

});