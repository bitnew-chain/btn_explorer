const THREE_HOURS = 3 * 60 * 60

class RateLimiter {
  constructor({
    node,
    limit = THREE_HOURS,
    interval = THREE_HOURS * 1000,
    banInterval = THREE_HOURS * 1000,
    whitelist = [],
    whitelistLimit = THREE_HOURS * 10,
    whitelistInterval = THREE_HOURS * 1000,
    banWhitelistInterval = THREE_HOURS * 1000,
    blacklist = [],
    blacklistLimit = 0,
    blacklistInterval = THREE_HOURS * 1000,
    banBlacklistInterval = THREE_HOURS * 1000
  } = {}) {
    this.node = node
    this.clients = new Map()
    this.whitelist = whitelist
    this.blacklist = blacklist

    this.config = {
      whitelist: {
        totalRequests: whitelistLimit,
        interval: whitelistInterval,
        banInterval: banWhitelistInterval
      },
      blacklist: {
        totalRequests: blacklistLimit,
        interval: blacklistInterval,
        banInterval: banBlacklistInterval
      },
      normal: {
        totalRequests: limit,
        interval,
        banInterval
      }
    }
  }

  middleware() {
    return this._middleware.bind(this)
  }

  async _middleware(ctx, next) {
    let name = RateLimiter.getClientName(ctx)
    let client = this.clients.get(name)

    ctx.rateLimit = {
      clients: this.clients,
      exceeded: false
    }

    if (!client) {
      client = this.addClient(name)
    }

    if (client.type === 'whitelist') {
      await next()
    } else {
      ctx.set('X-RateLimit-Limit', this.config[client.type].totalRequests)
      ctx.set('X-RateLimit-Remaining', this.config[client.type].totalRequests - client.visits)
      ctx.rateLimit.exceeded = this.exceeded(client)
      ctx.rateLimit.client = client
      if (!this.exceeded(client)) {
        ++client.visits
        await next()
      } else {
        this.node.log.warn('Rate limited:', client)
        ctx.throw(429, 'Rate Limit Exceeded')
      }
    }
  }

  exceeded(client) {
    if (this.config[client.type].totalRequests === -1) {
      return false
    } else {
      let isBanned = client.visits > this.config[client.type].totalRequests
      if (isBanned) {
        client.isBanned = true
      }
      return isBanned
    }
  }

  getClientType(name) {
    if (this.whitelist.includes(name)) {
      return 'whitelist'
    } else if (this.blacklist.includes(name)) {
      return 'blacklist'
    } else {
      return 'normal'
    }
  }

  static getClientName(ctx) {
    return ctx.get('cf-connecting-ip') || ctx.get('x-forwarded-for') || ctx.request.ip
  }

  addClient(name) {
    let client = {
      name,
      type: this.getClientType(name),
      visits: 1,
      isBanned: false
    }

    let resetTime = this.config[client.type].interval
    let banInterval = this.config[client.type].banInterval

    setTimeout(() => {
      if (this.clients.has(name) && !this.clients.get(name).isBanned) {
        this.clients.delete(name)
      } else {
        setTimeout(() => this.clients.delete(name), banInterval).unref()
      }
    }, resetTime).unref()

    this.clients.set(name, client)
    return client
  }
}

module.exports = RateLimiter
