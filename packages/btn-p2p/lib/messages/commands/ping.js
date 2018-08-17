const assert = require('assert')
const btn = require('btn-lib')
const Message = require('../message')
const {getNonce} = require('../utils')
const {BufferReader} = btn.encoding

class PingMessage extends Message {
  constructor(arg, options) {
    super('ping', options)
    assert(
      arg === undefined || (Buffer.isBuffer(arg) && arg.length === 8),
      'First argument is expected to be an 8 byte buffer'
    )
    this.nonce = arg || getNonce()
  }

  setPayload(payload) {
    let parser = new BufferReader(payload)
    this.nonce = parser.read(8)
    Message.checkFinished(parser)
  }

  getPayload() {
    return this.nonce
  }
}

module.exports = PingMessage
