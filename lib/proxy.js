const axios = require('axios')

class ProxyManager {
  constructor() {
    this.list = []
  }

  fetch_proxy() {
    console.log(`获取代理...`)

    return axios.get('http://www.66ip.cn/mo.php?tqsl=10')
      .then(res => {
        res.data.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{2,5}/g)
                .forEach(line => {
                  const r = line.split(':')

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
