const assert = require('assert')
const btn = require('btn-lib')
const Message = require('../message')
const {BufferReader, BufferWriter} = btn.encoding

class FilteraddMessage extends Message {
  constructor(arg, options) {
    super('filteradd', options)
    assert(arg === undefined || Buffer.isBuffer(arg))
    this.data = arg || Buffer.alloc(0)
  }

  setPayload(payload) {
    let parser = new BufferReader(payload)
    this.data = parser.readVarLengthBuffer()
    Message.checkFinished(parser)
  }

  getPayload() {
    let bw = new BufferWriter()
    bw.writeVarintNum(this.data.length)
    bw.write(this.data)
    return bw.concat()
  }
}

module.exports = FilteraddMessage
