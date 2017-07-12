const service = require('./lib/service')
const pm = require('./lib/proxy')
const axios = require('axios')
const faker = require('faker')
const qs = require('querystring')
const ObjectID = require('mongodb').ObjectID

function login(username, password, proxy) {
  return axios({
    method: 'post',
    url: 'http://www.yidianzixun.com/mp_sign_in',
    proxy,
    headers: {
      'user-agent': faker.internet.userAgent
    },
    data: qs.stringify({ username, password })
  }).then(res => {
    if (res.data.code) { throw new Error(res.data.reason) }

    return res.data
  })
}

function get_users() {
  const coll = service.db.collection('users')

  return coll.find({ type: 2, cookie: { $exists: false } }).toArray()
}

async function process(user) {
  try {
    const coll = service.db.collection('users')
    const proxy = await pm.get_proxy()

    const data = await login(user.username, user.password, proxy)

    await coll.updateOne(
      { _id: ObjectID(user._id) },
      { $set: { userid: data.userid, nickname: data.nickname, cookie: data.cookie } }
    )

    console.log(`${user.username} ok...`)
  } catch (e) {
    console.log('err: ', e.message)
  }
}

(async function() {
  await service.init()

  const users = await get_users()

  for (let i = 0; i < users.length; i++) {
    await process(users[i])
  }
  
  await service.shutdown()
})()