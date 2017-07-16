'use strict'

const utils = require('./lib/utils')
const register = require('./lib/register')
const comment = require('./lib/comment')
const like = require('./lib/like')
const service = require('./lib/service')

function need_register_user() {
  const coll = service.db.collection('users')

  return coll.count({ type: 1, use_count: 0 }).then(count => count < 10)
}

utils.run(async () => {
  if (await need_register_user()) { await register(10) }

  await comment(0, 20)

  await like()
})
