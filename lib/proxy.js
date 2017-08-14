const request = require('request-promise-native')
const service = require('./service')

function get_proxy () {
  const coll = service.db.collection('ip')

  return coll.findOneAndUpdate(
    {},
    { $inc: { use_count: 1 }, $currentDate: { date: true } },
    { sort: { date: 1 }, returnOriginal: false }
  ).then(r => r.value)
}

function delete_proxy (proxy) {
  const coll = service.db.collection('ip')

  if (proxy.use_count > 10 && (proxy.fail_count / proxy.use_count > 0.4)) {
    return coll.deleteOne({ addr: proxy.addr })
  } else {
    return coll.updateOne({ addr: proxy.addr }, { $inc: { fail_count: 1 } })
  }
}

async function ensure_request_by_proxy (request_opts) {
  while (true) {
    const proxy = await get_proxy()

    try {
      return await request(Object.assign(request_opts, { proxy: proxy.addr, timeout: 3000 }))
    } catch (e) {
      console.log(`无效代理 <${proxy.addr}> 尝试重新请求...`)
    }
  }
}

module.exports = {
  get_proxy,
  delete_proxy,
  ensure_request_by_proxy
}