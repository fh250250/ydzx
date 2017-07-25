// const axios = require('axios')
const request = require('request-promise-native')
const cheerio = require('cheerio')
const _ = require('lodash')
const faker = require('faker')
const service = require('./service')
const utils = require('./utils')

let test_count = 0
let total_count = 0

function make_fetcher(url_generator, data_parser) {
  return function(page) {
    const url = url_generator(page)

    return request({
      uri: url,
      headers: {
        'user-agent': faker.internet.userAgent()
      }
    })
    .then(html => {
      const result = data_parser(cheerio.load(html))
      console.log(`抓取 >> [${result.length}] ${url}`)

      return result
    })
    .catch(e => {
      console.log(`抓取失败 >> ${url} [${e.message}]`)
      return []
    })
  }
}

function ping(proxy) {
  return request({
    uri: 'http://www.baidu.com',
    proxy,
    timeout: 5000,
    headers: {
      'user-agent': faker.internet.userAgent()
    }
  })
  .then(() => {
    test_count++
    console.log(`[${test_count}/${total_count}] [OK] ${proxy}`)
    return proxy
  })
  .catch(e => {
    test_count++      
    console.log(`[${test_count}/${total_count}] [Failed] ${e.message}`)
    return null      
  })
}

function save_proxy_list(proxy_list) {
  const coll = service.db.collection('ip')

  const docs = proxy_list.map(p => ({ addr: p, use_count: 0, fail_count: 0 }))

  return coll.insertMany(docs, { ordered: false })
}

const httpsdaili = make_fetcher(
  page => `http://www.httpsdaili.com/?stype=2&page=${page}`,
  $ => $('#list tbody tr').map((idx, ele) => {
    const $tds = $(ele).find('td')
    const protocol = $tds.eq(3).text().toLowerCase()
    const host = $tds.eq(0).text()
    const port = $tds.eq(1).text()

    return `${protocol}://${host}:${port}`
  }).get()
)

const nianshao = make_fetcher(
  page => `http://www.nianshao.me/?page=${page}`,
  $ => $('table tbody tr').map((idx, ele) => {
    const $tds = $(ele).find('td')
    const protocol = $tds.eq(4).text().toLowerCase()
    const host = $tds.eq(0).text()
    const port = $tds.eq(1).text()

    return `${protocol}://${host}:${port}`
  }).get()
)

const xicidaili = make_fetcher(
  page => `http://www.xicidaili.com/wt/${page}`,
  $ => $('#ip_list tr')
        .filter(idx => idx !== 0)
        .map((idx, ele) => {
          const $tds = $(ele).find('td')
          const host = $tds.eq(1).text()
          const port = $tds.eq(2).text()

          return `http://${host}:${port}`
        }).get()
)

const sixsixip = make_fetcher(
  page => 'http://www.66ip.cn/mo.php?tqsl=50',
  $ => {
    const lines = $.text().match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{2,5}/g)

    if (!lines) { return [] }

    return lines.map(line => {
      const d = line.split(':')

      return `http://${d[0]}:${d[1]}`
    })
  }
)

module.exports = async function() {
  let result = []
  for (let i = 1; i <= 10; i++) {
    const proxy_list = await Promise.all([httpsdaili(i), nianshao(i), xicidaili(i), sixsixip(i)])

    result.push(_.flatten(proxy_list))
    await utils.delay(1000)
  }

  result = _.flatten(result)
  total_count = result.length

  result = await Promise.all(result.map(ping))

  result = _.uniq(result.filter(p => p))

  try {
    await save_proxy_list(result)
  } catch (e) {
  }
}
