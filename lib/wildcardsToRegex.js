module.exports = function (rule) {
    var regex = rule
        .replace(/\\/g, '\\\\')
        .replace(/\./g, '\\.')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]')
        .replace(/\}/g, '\\}')
        .replace(/\{/g, '\\{')
        .replace(/\?/g, '\\?')
        .replace(/\+/g, '\\+')
        .replace(/\^/g, '\\^')
        .replace(/\$/g, '\\$')
        .replace(/\*/g, '(.*)');
    regex = '^' + regex + '$';
    return new RegExp(regex);
}