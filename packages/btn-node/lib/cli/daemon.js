const path = require('path')
const program = require('commander')
const btn = require('../..')

function main(servicesPath, additionalServices) {
  let version = btn.version
  let {start, findConfig, defaultConfig} = btn.scaffold

  program
    .version(version)
    .description('Start the current node')
    .option('-c, --config <dir>', 'Specify the directory with Btn Node configuration')

  program.parse(process.argv)

  if (program.config) {
    program.config = path.resolve(process.cwd(), program.config)
  }
  let configInfo = findConfig(program.config || process.cwd())
  if (!configInfo) {
    configInfo = defaultConfig({additionalServices})
  }
  if (servicesPath) {
    configInfo.servicesPath = servicesPath
  }

  start(configInfo)
}

module.exports = main
