const fs = require('fs')
const path = require('path')

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
