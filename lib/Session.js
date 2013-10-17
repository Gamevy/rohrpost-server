module.exports = function(rawObject, hash, redis) {
    var that = this;

    that.created = plainObject.created || new Date.getTime();
    that.whiteList = (plainObject.whiteList || '').split('|');

    that.save = function() {
        redis.hmset(hash, {
            created: that.created,
            whiteList: that.whiteList.join('|')
        });
    };
}