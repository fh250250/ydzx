const axios = require('axios')

class ProxyManager {
  constructor() {
    this.list = []
  }

  fetch_proxy() {
    console.log(`获取代理...`)

    return axios.get(`http://dps.kuaidaili.com/api/getdps`, {
      params: {
        orderid: '939983219387346',
        num: 50,
        ut: 1,
        format: 'json',
        sep: 1
      }
    })
    .then(res => {
      const proxy_list = res.data.data.proxy_list

      proxy_list.forEach(ip => {
        const r = ip.split(':')

        this.list.push({ host: r[0], port: r[1] })
      })
    })
  }

  async get_proxy() {
    while (this.list.length < 1) {
      await this.fetch_proxy()
    }

    return this.list.shift()
  }
}

module.exports = new ProxyManager()
