const btn = require('btn-lib')
const Message = require('../message')
const {checkInventory, writeInventory} = require('../utils')
const {BufferReader, BufferWriter} = btn.encoding

class NotfoundMessage extends Message {
  constructor(arg, options) {
    super('notfound', options)
    checkInventory(arg)
    this.inventory = arg
  }

  setPayload(payload) {
    let parser = new BufferReader(payload)
    this.inventory = []
    let count = parser.readVarintNum()
    for (let i = 0; i < count; ++i) {
      let type = parser.readUInt32LE()
      let hash = parser.read(32)
      this.inventory.push({type, hash})
    }
    Message.checkFinished(parser)
  }

  getPayload() {
    let bw = new BufferWriter()
    writeInventory(this.inventory, bw)
    return bw.concat()
  }
}

module.exports = NotfoundMessage
