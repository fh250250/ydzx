const fs = require('fs')
const path = require('path')
const axios = require('axios')
const service = require('./service')

const WORDS = fs.readFileSync(
  path.resolve(__dirname, '../data/words.txt'),
  'utf-8'
).trim().split('\n').filter(line => line)

module.exports.delay = function(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

let word_nth = 0
module.exports.get_words = function() {
  if (word_nth >= WORDS.length) { word_nth = 0 }

  return WORDS[word_nth++]
}

module.exports.run = async function(func) {
  await service.init()
  console.log('\n### 棱镜核心已启动 ###\n\n')

  await func()

  await service.shutdown()
}
