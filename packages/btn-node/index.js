exports = module.exports = require('./lib')

exports.Node = require('./lib/node')
exports.Service = require('./lib/service')
exports.errors = require('./lib/errors')

exports.scaffold = {
  create: require('./lib/scaffold/create'),
  add: require('./lib/scaffold/add'),
  remove: require('./lib/scaffold/remove'),
  start: require('./lib/scaffold/start'),
  callMethod: require('./lib/scaffold/call-method'),
  findConfig: require('./lib/scaffold/find-config'),
  defaultConfig: require('./lib/scaffold/default-config')
}

exports.cli = {
  main: require('./lib/cli/main'),
  daemon: require('./lib/cli/daemon'),
  btn: require('./lib/cli/btn'),
  btnd: require('./lib/cli/btnd')
}

exports.version = require('./package').version
