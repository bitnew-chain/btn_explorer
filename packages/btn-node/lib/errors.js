const createError = require('errno').create
const BtnNodeError = createError('BtnNodeError')
const RPCError = createError('RPCError', BtnNodeError)

exports.Error = BtnNodeError
exports.RPCError = RPCError
