describe('Rohrpost', function() {

    it('connects successful', function(done) {
        var rohrpost = new Rohrpost({"connectionUrl": connectionUrl});
        rohrpost.on('open', function() {
            done();
        });
    });

    it('can publish and receive simple ping message after connect', function(done) {
        var rohrpost = new Rohrpost({"connectionUrl": connectionUrl});
        rohrpost.on('open', function() {
            rohrpost.publish('anonym.ping', {"foo": "bar"});
        });
        rohrpost.on('anonym.pong', function(data) {
            assert.deepEqual(data, {'foo': 'bar'});
            done();
        })
    });

    it('can publish and receive simple ping message before connect', function(done) {
        var rohrpost = new Rohrpost({"connectionUrl": connectionUrl});

        rohrpost.publish('anonym.ping', {"foo": "bar"});

        rohrpost.on('anonym.pong', function(data) {
            assert.deepEqual(data, {'foo': 'bar'});
            done();
        })
    });
});