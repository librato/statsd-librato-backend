module.exports = process.env.LIBRATO_COVERAGE ? require('./lib-cov/librato.js') : require('./lib/librato.js');
