module.exports = function (rule) {
    var regex = rule
        .replace('\\', '\\\\')
        .replace('.', '\\.')
        .replace('(', '\\(')
        .replace(')', '\\)')
        .replace('[', '\\[')
        .replace(']', '\\]')
        .replace('}', '\\}')
        .replace('{', '\\{')
        .replace('?', '\\?')
        .replace('+', '\\+')
        .replace('^', '\\^')
        .replace('$', '\\$')
        .replace('*', '(.*)');
    regex = '^' + regex + '$';
    return new RegExp(regex);
}