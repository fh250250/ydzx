const fs = require('fs')
const path = require('path')
const axios = require('axios')
const pm = require('./proxy')

const WORDS = fs.readFileSync(
  path.resolve(__dirname, '../data/words.txt'),
  'utf-8'
).trim().split('\n')

module.exports.delay = function(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

let word_nth = 0
module.exports.get_words = function() {
  if (word_nth >= WORDS.length) { word_nth = 0 }

  return WORDS[word_nth++]
}

module.exports.request_by_proxy = async function(axios_params) {
  while (true) {
    const proxy = await pm.get_proxy()

    try {
      return await axios(Object.assign(axios_params, { proxy, timeout: 3000 }))
    } catch (e) {
      console.log(`无效代理 <${proxy.host}:${proxy.port}> 尝试重新请求...`)
    }
  }
}
