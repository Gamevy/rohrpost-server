describe('Rohrpost', function() {

    var rohrpost;
    var assert = chai.assert;

    afterEach(function() {
        rohrpost.close();
    })

    it('connects successful', function(done) {
        rohrpost = new Rohrpost({"connectionUrl": connectionUrl});
        rohrpost.on('open', done);
    });

    it('can publish and receive simple ping message after connect', function(done) {
        rohrpost = new Rohrpost({"connectionUrl": connectionUrl});
        rohrpost.on('open', function() {
            rohrpost.publish('anonym.ping', {"foo": "bar"});
        });
        rohrpost.on('anonym.pong', function(data) {
            assert.deepEqual(data, {'foo': 'bar'});
            done();
        })
    });

    it('can publish and receive simple ping message before connect', function(done) {
        rohrpost = new Rohrpost({"connectionUrl": connectionUrl});
        rohrpost.publish('anonym.ping', {"foo": "bar"});
        rohrpost.on('anonym.pong', function(data) {
            assert.deepEqual(data, {'foo': 'bar'});
            done();
        })
    });

    it('allows null to be send and received', function(done) {
        rohrpost = new Rohrpost({"connectionUrl": connectionUrl});
        rohrpost.publish('anonym.ping', null);
        rohrpost.on('anonym.pong', function(data) {
            assert.deepEqual(data, null);
            done();
        })
    });

    it('can not send to topics that this connection is not whitelisted for', function(done) {
        rohrpost = new Rohrpost({"connectionUrl": connectionUrl});
        rohrpost.publish('members.ping', {"foo": "bar"});
        rohrpost.on('members.pong', assert.fail);
        rohrpost.on('open', done);
    });

    it('can get whitelisted for topics if the backend allows us to do so', function(done) {
        rohrpost = new Rohrpost({"connectionUrl": connectionUrl});
        rohrpost.on('members.welcome', function() {
            rohrpost.on('members.pong', function() {
                done()
            });
            rohrpost.publish('members.ping', {});
        });
        rohrpost.publish('anonym.members.login', {"username": "foo", "password": "bar"});
    });

    it('works for topics that are internally handled as http requests', function(done) {
        rohrpost = new Rohrpost({"connectionUrl": connectionUrl});
        rohrpost.on('anonym.http.pong', function(data) {
            assert.deepEqual(data, {"foo": "bar"});
            done();
        });
        rohrpost.publish('anonym.http.ping', {"foo": "bar"});
    });

    it('allows whitelists to be changed via http endpoint', function(done) {
        rohrpost = new Rohrpost({"connectionUrl": connectionUrl});
        rohrpost.on('members.welcome', function() {
            rohrpost.on('members.pong', function() {
                done()
            });
            rohrpost.publish('members.ping', {});
        });
        rohrpost.publish('anonym.http.login', {"foo": "bar"});
    });

    it('allows topics to be removed from whitelists', function(done) {
        rohrpost = new Rohrpost({"connectionUrl": connectionUrl});
        rohrpost.on('members.welcome', function() {
            rohrpost.publish('members.http.logout', {});
            rohrpost.on('anonym.members.logout.success', function() {
                rohrpost.on('members.pong', assert.fail);
                rohrpost.publish('members.ping', {});
                done();
            });
        });
        rohrpost.publish('anonym.http.login', {});
    });
});