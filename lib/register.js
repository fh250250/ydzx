const axios = require('axios')
const faker = require('faker')
const _ = require('lodash')
const service = require('./service')
const utils = require('./utils')
const pm = require('./proxy')

// 短信平台账号密码
const SMS_KEY = 'api-ygnzq99b'
const SMS_PSW = 'qq1234567.'
const SMS_SID = '44694'

// 短信平台 token
let token = null

function request_sms(action, args) {
  return axios.get('http://api.hellotrue.com/api/do.php', {
    timeout: 10000,
    params: Object.assign({ action }, args)
  }).then(res => res.data.trim().split('|').map(f => f.trim()))
}

async function request_by_proxy(ctx, axios_params) {
  while (true) {
    if (!ctx.proxy) { ctx.proxy = await pm.get_proxy() }

    try {
      return await axios(Object.assign(axios_params, { proxy: ctx.proxy, timeout: 5000 }))
    } catch (e) {
      console.log(`无效代理 <${ctx.proxy.host}:${ctx.proxy.port}> 更换并重新请求...`)
      ctx.proxy = null
    }
  }
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
async function get_phone(ctx) {
  await ensure_login()

  console.log(`获取手机号...`)
  const data = await request_sms('getPhone', { sid: SMS_SID, token })

  if (data[0] === '0') { throw new Error(data[1]) }

  console.log(`手机号: ${data[1]}`)
  ctx.phone = data[1]
}

// 获取验证码
async function get_code(ctx) {
  await ensure_login()

  let try_count = 0

  while (true) {
    const data = await request_sms('getMessage', { sid: SMS_SID, phone: ctx.phone, token })
    try_count++
    console.log(`获取验证码... [${try_count}]`)

    if (data[0] === '1') {
      const code = data[1].match(/\d{4,}/)[0]
      console.log(`验证码: ${code}`)

      ctx.code = code
      return
    }

    if (!/还没有接收到短信/.test(data[1])) { throw new Error(data[1]) }

    if (try_count > 20) { throw new Error('1 分钟内未收到短信') }

    await utils.delay(3000)
  }
}

// 发送验证码
function send_code(ctx) {
  console.log(`发送验证码...`)

  return request_by_proxy(ctx, {
    method: 'get',
    url: 'http://www.yidianzixun.com/home/q/mobile_verify',
    headers: {
      'user-agent': faker.internet.userAgent()
    },
    params: {
      mobile: `86${ctx.phone}`,
      appid: 'yidian',
      deviceid: ctx.deviceid
    }
  }).then(res => {
    if (res.data.code) { throw new Error(res.data.reason) }
  })
}

// 注册
function register(ctx) {
  console.log(`注册...`)

  const password = faker.random.alphaNumeric(8)

  return request_by_proxy(ctx, {
    method: 'get',
    url: 'http://www.yidianzixun.com/home/q/mobile_sign_in',
    headers: {
      'user-agent': faker.internet.userAgent()
    },
    params: {
      mobile: `86${ctx.phone}`,
      password,
      code: ctx.code,
      appid: 'yidian',
      deviceid: ctx.deviceid,
      _: Date.now()
    }
  }).then(res => {
    if (res.data.code) { throw new Error(res.data.reason) }

    console.log(`注册成功`)

    const user = _.pick(res.data, ['userid', 'username', 'nickname', 'cookie'])
    user.password = password

    ctx.user = user
  })
}

// 存储到数据库
function save_to_db(ctx) {
  const collection = service.db.collection('users')
  const doc = Object.assign(ctx.user, { use_count: 0, type: 1 })

  return collection.insertOne(doc)
}

async function process() {
  console.log(_.repeat('-', 64))

  const ctx = {
    phone: null,
    code: null,
    proxy: null,
    deviceid: faker.random.alphaNumeric(15),
    user: null
  }
  
  await get_phone(ctx)
  await send_code(ctx)
  await utils.delay(3000)
  await get_code(ctx)
  await register(ctx)
  await save_to_db(ctx)
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
