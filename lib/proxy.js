const axios = require('axios')
const cheerio = require('cheerio')
const faker = require('faker')
const _ = require('lodash')

function test_proxy(proxy) {
  return axios.get('http://www.yidianzhixun.com', {
    headers: {
      'user-agent': faker.internet.userAgent
    },
    timeout: 3000,
    proxy
  })
  .then(() => proxy)
  .catch(() => null)
}

class ProxyManager {
  constructor() {
    this.page = 1
    this.list = []
  }

  async fetch_proxy() {
    console.log(`获取代理... [${this.page}]`)

    const res = await axios.get(`http://www.xicidaili.com/nt/${this.page}`)
    this.page++

    // 前 20 页循环抓取
    if (this.page > 20) { this.page = 1 }

    const $ = cheerio.load(res.data)

    const ip_list = $('#ip_list tr')
                      .slice(1)
                      .map((idx, ele) => {
                        const $td = $(ele).find('td')

                        return {
                          host: $td.eq(1).text(),
                          port: $td.eq(2).text(),
                          speed: parseFloat($td.eq(6).find('.bar').attr('title'))
                        }
                      })
                      .get()
                      .filter(item => item.speed < 3)
                      .map(item => _.pick(item, ['host', 'port']))

    const proxy_list = await Promise.all(ip_list.map(test_proxy))

    proxy_list.forEach(proxy => proxy && this.list.push(proxy))
  }

  async get_proxy() {
    while (this.list.length < 1) {
      await this.fetch_proxy()
    }

    return this.list.shift()
  }
}

module.exports = new ProxyManager()
