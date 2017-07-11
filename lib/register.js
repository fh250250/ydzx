const axios = require('axios')
const faker = require('faker')
const _ = require('lodash')
const service = require('./service')
const utils = require('./utils')

// 短信平台账号密码
const SMS_KEY = 'api-ygnzq99b'
const SMS_PSW = 'qq1234567.'
const SMS_SID = '44694'

// 短信平台 token
let token = null

function request_sms(action, args) {
  return axios.get('http://api.hellotrue.com/api/do.php', {
    params: Object.assign({ action }, args)
  }).then(res => res.data.trim().split('|').map(f => f.trim()))
}

function request_yd(action, args) {
  return axios.get(`http://www.yidianzixun.com/home/q/${action}`, {
    headers: {
      'user-agent': faker.internet.userAgent()
    },
    params: args
  }).then(res => {
    if (res.data.code) { throw new Error(res.data.reason) }

    return res.data
  })
}

// 确保已经登陆短信平台
async function ensure_login() {
  if (token) { return }

  console.log('登陆短信平台...')
  const data = await request_sms('loginIn', { name: SMS_KEY, password: SMS_PSW })

  if (data[0] === '0') { throw new Error(data[1]) }

  console.log(`获得 token: ${data[1]}`)
  token = data[1]
}

// 获取手机号
async function get_phone() {
  await ensure_login()

  console.log(`获取手机号...`)
  const data = await request_sms('getPhone', { sid: SMS_SID, token })

  if (data[0] === '0') { throw new Error(data[1]) }

  console.log(`手机号: ${data[1]}`)
  return data[1]
}

// 获取验证码
async function get_code({ phone }) {
  await ensure_login()

  let try_count = 0

  while (true) {
    const data = await request_sms('getMessage', { sid: SMS_SID, phone, token })
    try_count++
    console.log(`获取验证码... [${try_count}]`)

    if (data[0] === '1') {
      const code = data[1].match(/\d{4,}/)[0]
      console.log(`验证码: ${code}`)

      return code
    }

    if (!/还没有接收到短信/.test(data[1])) { throw new Error(data[1]) }

    if (try_count > 20) { throw new Error('1 分钟内未收到短信') }

    await utils.delay(3000)
  }
}

// 发送验证码
async function send_code({ phone, deviceid }) {
  console.log(`发送验证码...`)  
  await request_yd('mobile_verify', {
    mobile: `86${phone}`,
    appid: 'yidian',
    deviceid
  })
}

// 注册
async function register({ phone, code, deviceid }) {
  console.log(`注册...`)

  const password = faker.random.alphaNumeric(8)

  const data = await request_yd('mobile_sign_in', {
    mobile: `86${phone}`,
    password,
    code,
    appid: 'yidian',
    deviceid,
    _: Date.now()
  })

  console.log(`注册成功`)

  const user = _.pick(data, ['userid', 'username', 'nickname', 'cookie'])
  user.password = password

  return user
}

// 存储到数据库
async function save_to_db(user) {
  const collection = service.db.collection('users')
  const doc = Object.assign(user, { use_count: 0, like_count: 0 })

  await collection.insertOne(doc)
}

async function process() {
  console.log(_.repeat('-', 64))

  const ctx = {
    deviceid: faker.random.alphaNumeric(15)
  }
  
  ctx.phone = await get_phone()

  await send_code(ctx)

  await utils.delay(3000)

  ctx.code = await get_code(ctx)

  const user = await register(ctx)

  await save_to_db(user)

  await utils.delay(3000)
}

module.exports = async function(count) {
  for (let i = 0; i < count; i++) {
    try {
      await process()
    } catch (e) {
      console.log(`[失败] ${e.message}`)
    }
  }
}
