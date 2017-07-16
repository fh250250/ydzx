'use strict'

const utils = require('./lib/utils')
const register = require('./lib/register')
const comment = require('./lib/comment')
const like = require('./lib/like')

utils.run(async () => {
  await register(10)
  await comment(0, 20)
  await like()
})
