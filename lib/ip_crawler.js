const axios = require('axios')
const cheerio = require('cheerio')
const _ = require('lodash')
const service = require('./service')
const pm = require('./proxy')

let test_count = 0
let total_count = 0

function make_fetcher(url_generator, data_parser) {
  return function(page) {
    const url = url_generator(page)

    return axios.get(url)
      .then(res => {
        console.log(`抓取 >> ${url}`)
        const $ = cheerio.load(res.data)

        return data_parser($)
      })
      .catch(e => [])
  }
}

function test_ip(proxy) {
  return axios.get('http://im.qq.com', { proxy, timeout: 2000 })
    .then(() => {
      test_count++
      console.log(`[${test_count}/${total_count}] [OK] ${proxy.host}:${proxy.port}`)
      return proxy
    })
    .catch(() => {
      test_count++      
      console.log(`[${test_count}/${total_count}] [Failed] ${proxy.host}:${proxy.port}`)
      return null      
    })
}

function save_proxy_list(proxy_list) {
  const coll = service.db.collection('ip')

  const docs = proxy_list.map(p => Object.assign(p, { use_count: 0 }))

  return coll.insertMany(docs, { ordered: false })
}

const httpsdaili = make_fetcher(
  page => `http://www.httpsdaili.com/?stype=2&page=${page}`,
  $ => $('#list tbody tr').map((idx, ele) => {
    const $tds = $(ele).find('td')

    return { host: $tds.eq(0).text(), port: $tds.eq(1).text() }
  }).get()
)

const nianshao = make_fetcher(
  page => `http://www.nianshao.me/?page=${page}`,
  $ => $('table tbody tr').map((idx, ele) => {
    const $tds = $(ele).find('td')

    return { host: $tds.eq(0).text(), port: $tds.eq(1).text() }
  }).get()
)

const xicidaili = make_fetcher(
  page => `http://www.xicidaili.com/wt/${page}`,
  $ => $('#ip_list tr')
        .filter(idx => idx !== 0)
        .map((idx, ele) => {
          const $tds = $(ele).find('td')

          return { host: $tds.eq(1).text(), port: $tds.eq(2).text() }
        }).get()
)

const sixsixip = make_fetcher(
  page => 'http://www.66ip.cn/mo.php?tqsl=50',
  $ => {
    const lines = $.text().match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{2,5}/g)

    if (!lines) { return [] }

    return lines.map(line => {
      const d = line.split(':')

      return { host: d[0], port: d[1] }
    })
  }
)

module.exports = async function() {
  let result = []
  for (let i = 1; i <= 10; i++) {
    const proxy_list = await Promise.all([httpsdaili(i), nianshao(i), xicidaili(i), sixsixip(i)])

    result.push(_.flatten(proxy_list))
  }
  result.push(await pm.fetch_proxy())

  result = _.flatten(result)
  total_count = result.length

  result = await Promise.all(result.map(test_ip))

  result = result.filter(p => p)

  console.log(result)
  console.log(result.length)

  // try {
  //   await save_proxy_list(result)
  // } catch (e) {
  // }
}
