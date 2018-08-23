const btn = require('btn-lib')
const Block = require('btn-node/lib/models/block')
const Transaction = require('btn-node/lib/models/transaction')
const { ErrorResponse } = require('../components/utils')
const { Networks } = btn
const { Base58Check, SegwitAddress } = btn.encoding
const {BN} = require('btn-lib').crypto

class MiscController {
  constructor(node) {
    this.node = node
    this._client = this.node.getRpcClient()
    this.errorResponse = new ErrorResponse({ log: this.node.log })
    this._network = this.node.network
    if (this.node.network === 'livenet') {
      this._network = 'mainnet'
    } else if (this.node.network === 'regtest') {
      this._network = 'testnet'
    }
  }

  async info(ctx) {
    ctx.body = {
      height: this.node.getBlockTip().height
    }
  }

  async getBtnDescription(ctx) {
    try {
      let info = await this._client.getInfo();
      // btn产量
      let totalAmount = info.moneysupply;
      // 区块高度
      let curHeight = info.blocks;
      let tip = await this.node.getServiceTip('block');
      if (tip.height === 0) {
        throw new Error("block height is 0, please sync first.")
      }
      if (tip.height < curHeight) {
        curHeight = tip.height;
      }
      // 全网难度
      let difficulty = info.difficulty['proof-of-stake'];
      console.log('proof-of-stake', difficulty)
      let block = await this.node.getBlock(curHeight);
      if (block) {
        difficulty = this._getDifficulty(block.bits);
        console.log('calc difficulty', difficulty);
      }
      // 实时算力
      let workWeight = await this._getWorkWeight(curHeight);
      ctx.body = {
        height: curHeight,
        totalAmount,
        difficulty,
        workWeight,
      };
    } catch (error) {
      console.log('get block info failed.', error);
      ctx.throw(404);
    }
  }

  async classify(ctx) {
    let id = ctx.params.id
    if (/^(0|[1-9]\d{0,9})$/.test(id)) {
      id = Number.parseInt(id)
      if (id <= this.node.getBlockTip().height) {
        ctx.body = { type: 'block' }
        return
      }
    } else if ([33, 34, 42, 62].includes(id.length)) {
      try {
        this._toHexAddress(id)
        ctx.body = { type: 'address' }
        return
      } catch (err) { }
    } else if (id.length === 40) {
      if (await this.node.getContract(id)) {
        ctx.body = { type: 'contract' }
        return
      }
    } else if (id.length === 64) {
      if (await Block.findOne({ hash: id })) {
        ctx.body = { type: 'block' }
        return
      } else if (await Transaction.findOne({ $or: [{ id }, { hash: id }] })) {
        ctx.body = { type: 'transaction' }
        return
      }
    }
    if (/^[0-9a-z ]+$/i.test(id)) {
      let token = await this.node.searchQRC20Token(id)
      if (token) {
        ctx.body = { type: 'contract', id: token.address }
        return
      }
    }
    ctx.throw(404)
  }

  async richList(ctx) {
    let from = Number.parseInt(ctx.query.from) || 0
    let to = Number.parseInt(ctx.query.to) || from + 10
    ctx.body = await this.node.getRichList({ from, to })
  }

  async biggestMiners(ctx) {
    let from = Number.parseInt(ctx.query.from) || 0
    let to = Number.parseInt(ctx.query.to) || from + 10
    ctx.body = await this.node.getMiners({ from, to })
  }

  _toHexAddress(address) {
    let network = Networks.get(this._network)
    if (address.length === 33 || address.length === 34) {
      let hexAddress = Base58Check.decode(address)
      if (hexAddress[0] === network.pubkeyhash) {
        return { type: 'pubkeyhash', hex: hexAddress.slice(1).toString('hex') }
      } else if (hexAddress[0] === network.scripthash) {
        return { type: 'scripthash', hex: hexAddress.slice(1).toString('hex') }
      }
    } else if (address.length === 42) {
      let result = SegwitAddress.decode(network.witness_v0_keyhash, address)
      if (result) {
        return { type: 'witness_v0_keyhash', hex: Buffer.from(result.program).toString('hex') }
      }
    } else if (address.length === 62) {
      let result = SegwitAddress.decode(network.witness_v0_scripthash, address)
      if (result) {
        return { type: 'witness_v0_scripthash', hex: Buffer.from(result.program).toString('hex') }
      }
    }
    throw new Error('Invalid address')
  }

  _getTargetDifficulty(bits) {
    let target = new BN(bits & 0xffffff)
    let mov = ((bits >>> 24) - 3) << 3
    while (mov--) {
      target = target.mul(new BN(2))
    }
    return target
  }

  _getDifficulty(bits) {
    let difficultyTargetBN = this._getTargetDifficulty(0x1d00ffff).mul(new BN(100000000))
    let currentTargetBN = this._getTargetDifficulty(bits)
    let difficultyString = difficultyTargetBN.div(currentTargetBN).toString(10)
    let decimalPos = difficultyString.length - 8
    difficultyString = difficultyString.slice(0, decimalPos) + '.' + difficultyString.slice(decimalPos)
    return Number.parseFloat(difficultyString)
  }

  async _getWorkWeight(curHeight) {
    let dStakeKernelsTriedAvg = 0
    let workWeight = 0
    for (let i = 0; i < 72; i++) {
      let block = await this.node.getBlock(curHeight - i)
      dStakeKernelsTriedAvg += this._getDifficulty(block.bits) * 4294967296.0
      let pindexTime = block.timestamp
      let blockPre = await this.node.getBlock(curHeight - i - 1)
      workWeight += pindexTime - blockPre.timestamp
    }
    // 实时算力
    workWeight = dStakeKernelsTriedAvg / workWeight * 16 / 100000000
    return workWeight;
  }
}

module.exports = MiscController
