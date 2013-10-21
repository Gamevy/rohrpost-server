module.exports = function (string) {
    if (string == 'null') {
        return null;
    } else {
        var data = JSON.parse(string);
        return data;
    }
}