const btn = require('btn-lib')
const {ErrorResponse} = require('../components/utils')
const {Address, Networks} = btn
const {SegwitAddress} = btn.encoding

class MiscController {
  constructor(node) {
    this.node = node
    this.errorResponse = new ErrorResponse({log: this.node.log})
    this._network = this.node.network
    if (this.node.network === 'livenet') {
      this._network = 'mainnet'
    } else if (this.node.network === 'regtest') {
      this._network = 'testnet'
    }
  }

  async search(ctx) {
    ctx.body = null
  }
}

module.exports = MiscController
