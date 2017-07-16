const axios = require('axios')
const config = require('../config')

const proxy_list = []

function fetch_proxy() {
  console.log(`获取代理...`)
  return axios.get(`http://dps.kuaidaili.com/api/getdps`, {
    params: {
      orderid: config.proxy_platform.orderid,
      num: 50,
      ut: 1,
      format: 'json',
      sep: 1
    }
  })
  .then(res => res.data.data.proxy_list)
}

function save_proxy_list(list) {
  list.forEach(ip => {
    const r = ip.split(':')

    proxy_list.push({ host: r[0], port: r[1] })
  })
}

async function get_proxy() {
  while (proxy_list.length < 1) {
    const list = await fetch_proxy()
    save_proxy_list(list)
  }

  return proxy_list.shift()
}

module.exports = {
  fetch_proxy,
  get_proxy
}