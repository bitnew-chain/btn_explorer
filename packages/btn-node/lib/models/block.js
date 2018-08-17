const mongoose = require('mongoose')
const addressSchema = require('./address')
const {Schema} = mongoose

const blockSchema = new Schema({
  hash: {type: String, index: true, unique: true},
  height: {type: Number, index: true, unique: true},
  version: Number,
  prevHash: {type: String, default: '0'.repeat(64)},
  size: Number,
  weight: Number,
  merkleRoot: String,
  timestamp: {type: Number, index: true},
  bits: Number,
  nonce: Number,
  hashStateRoot: String,
  hashUTXORoot: String,
  prevOutStakeHash: {type: String, default: '0'.repeat(64)},
  prevOutStakeN: Number,
  vchBlockSig: String,
  chainwork: String,
  transactions: [String],
  minedBy: addressSchema
})

module.exports = mongoose.model('Block', blockSchema)
