const WebSocket = require('ws')
const {BN} = require('btn-lib').crypto
const BaseService = require('btn-node/lib/service')
const Block = require('btn-node/lib/models/block')

class BtnWS extends BaseService {
  constructor(options) {
    super(options)
    this._options = options
    this._client = this.node.getRpcClient()
  }

  static get dependencies() {
    return ['block', 'contract', 'header', 'mempool', 'transaction', 'web']
  }

  get routePrefix() {
    return this._routePrefix
  }

  async start() {
    if (this._subscribed) {
      return
    }
    this._subscribed = true
    if (!this._bus) {
      this._bus = this.node.openBus({remoteAddress: 'localhost-btn-ws'})
    }
    this._bus.on('mempool/transaction', this.mempoolTransactionEventHandler.bind(this))
    this._bus.subscribe('mempool/transaction')
    this._bus.on('block/block', this.blockEventHandler.bind(this))
    this._bus.subscribe('block/block')
    this._bus.on('block/transaction', this.transactionEventHandler.bind(this))
    this._bus.subscribe('block/transaction')
    this._bus.on('block/address', this.addressEventHandler.bind(this))
    this._bus.subscribe('block/address')

    this._server = new WebSocket.Server({port: this._options.port})
    this._server.on('connection', (ws, req) => {
      ws.subscriptions = new Set(['height'])
      ws.send(JSON.stringify({type: 'height', data: this.node.getBlockTip().height}))
      ws.on('message', message => {
        if (message === '"ping"') {
          ws.send(JSON.stringify('pong'))
        } else {
          try {
            message = JSON.parse(message)
            if (message.type === 'subscribe') {
              ws.subscriptions.add(message.data)
            } else if (message.type === 'unsubscribe') {
              ws.subscriptions.delete(message.data)
            }
          } catch (err) {}
        }
      })
      ws.on('close', (code, reason) => {})
      ws.on('error', () => {})
    })
  }

  stop() {
    this._server.close()
  }

  getRemoteAddress(req) {
    return req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress
  }

  mempoolTransactionEventHandler(transaction) {
    for (let client of this._server.clients) {
      if (client.subscriptions.has('mempool/transaction')) {
        client.send(JSON.stringify({
          type: 'mempool/transaction',
          data: transaction
        }))
      }
    }
  }

  async blockEventHandler(block) {
    let transformedBlock = await this.transformBlock(block)
    let btnDescription = await this.getBtnDescription(block)
    for (let client of this._server.clients) {
      if (client.subscriptions.has('height')) {
        client.send(JSON.stringify({
          type: 'height',
          data: block.height
        }))
      }
      if (client.subscriptions.has('block')) {
        client.send(JSON.stringify({
          type: 'block',
          data: transformedBlock
        }))
      }
      if (client.subscriptions.has('description')) {
        client.send(JSON.stringify({
          type: 'description',
          data: btnDescription
        }))
      }
    }
  }

  transactionEventHandler(transaction) {
    for (let client of this._server.clients) {
      if (client.subscriptions.has('transaction/' + transaction.id)) {
        client.send(JSON.stringify({
          type: 'transaction/' + transaction.id,
          data: transaction
        }))
      }
    }
  }

  addressEventHandler(address) {
    for (let client of this._server.clients) {
      if (client.subscriptions.has('address')) {
        client.send(JSON.stringify({
          type: 'address',
          data: address
        }))
      }
    }
  }

  async transformBlock(block) {
    let {reward, minedBy, duration} = await this.getBlockReward(block)
    return {
      hash: block.hash,
      size: block.size,
      weight: block.weight,
      height: block.height,
      version: block.version,
      merkleRoot: block.merkleRoot,
      tx: block.transactions,
      timestamp: block.timestamp,
      nonce: block.nonce,
      bits: block.bits.toString(16),
      difficulty: this._getDifficulty(block.bits),
      chainWork: block.chainwork,
      confirmations: this.node.getBlockTip().height - block.height + 1,
      previousBlockHash: block.prevHash,
      nextBlockHash: block.nextHash,
      reward,
      minedBy,
      duration,
      isMainChain: true
    }
  }

  async getBlockReward(block) {
    let minedBy, duration
    let reward = 0
    if (block.prevOutStakeHash !== '0'.repeat(64) && block.prevOutStakeN !== 0xffffffff) {
      let transaction = await this.node.getTransaction(block.transactions[1])
      reward = -transaction.feeSatoshis
      minedBy = transaction.outputs[1].address
    } else {
      let transaction = await this.node.getTransaction(block.transactions[0])
      reward = transaction.outputSatoshis
      minedBy = transaction.outputs[0].address
    }
    let prevHash = block.prevHash
    if (prevHash !== '0'.repeat(64)) {
      let prevBlockHeader = await this.node.getBlockHeader(prevHash)
      duration = block.timestamp - prevBlockHeader.timestamp
    }
    return {reward, minedBy, duration}
  }
  async getBtnDescription(block) {
    try {
      let info = await this._client.getInfo();
      // btn产量
      let totalAmount = info.moneysupply;
      // 区块高度
      let curHeight = block.height;
      // 全网难度
      let difficulty = this._getDifficulty(block.bits);
      // 实时算力
      let workWeight = await this._getWorkWeight(curHeight);
      return {
        height: curHeight,
        totalAmount,
        difficulty,
        workWeight,
      };
    } catch (error) {
      return null;
    }
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

module.exports = BtnWS
