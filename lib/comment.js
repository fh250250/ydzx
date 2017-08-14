const faker = require('faker')
const axios = require('axios')
const moment = require('moment')
const qs = require('querystring')
const _ = require('lodash')
const service = require('./service')
const utils = require('./utils')
const config = require('../config')
const proxy = require('./proxy')

async function fetch_news_by_channel(channel, start, end) {
  console.log(`获取 [${channel.name}] 文章列表...`)

  const res = await axios.get('http://www.yidianzixun.com/home/q/news_list_for_channel', {
    headers: {
      'user-agent': faker.internet.userAgent()
    },
    params: {
      channel_id: channel.id,
      cstart: start,
      cend: end,
      __from__: 'pc',
      multi: 5,
      appid: 'web_yidian',
      _: Date.now()
    }
  })

  if (res.data.code) {
    console.log(`获取 [${channel.name}] 文章列表失败: ${res.data.reason}`)
    return []
  }
  
  const uncommented_articles = []
  for (let i = 0; i < res.data.result.length; i++) {
    const article = res.data.result[i]
    const commented = await is_article_commented(article.docid)

    if (!commented) {
      uncommented_articles.push(article)
    }
  }

  return uncommented_articles
            .filter(n => n.docid && n.comment_count >= 10)
            .filter(n => {
              const now = moment()
              const date = moment(n.date)

              return now.diff(date, 'days') <= 2
            })
}

async function fetch_news(start, end) {
  const articles = _.flatten(await Promise.all(config.channels.map(channel => fetch_news_by_channel(channel, start, end))))
  const result = _.uniqBy(articles, 'docid')

  console.log(`已获取文章 ${result.length} 篇`)
  return result
}

function get_user() {
  const collection = service.db.collection('users')

  return collection.findOneAndUpdate(
    { type: 1 },
    { $inc: { use_count: 1 } },
    { sort: { use_count: 1 }, returnOriginal: false }
  ).then(r => r.value)
}

function is_article_commented(docid) {
  const collection = service.db.collection('comments')

  return collection.findOne({ docid })
}

function save_comment(comment) {
  const collection = service.db.collection('comments')

  return collection.insertOne({
    docid: comment.docid,
    comment_id: comment.comment_id,
    ok: false
  })
}

class Speaker {
  constructor(user, article) {
    this.user = user
    this.article = article
    this.ua = faker.internet.userAgent()
  }

  comment() {
    console.log(`评论 [${this.article.title}] http://www.yidianzixun.com/article/${this.article.docid}`)

    return proxy.ensure_request_by_proxy({
      uri: 'http://a1.go2yd.com/Website/interact/add-comment',
      headers: {
        'user-agent': this.ua,
        'x-tingyun-processed': true,
        cookie: this.user.cookie
      },
      qs: {
        platform: 1,
        meta: this.article.meta,
        cv: '4.0.1.0',
        title_sn: this.article.title_sn,
        distribution: _.sample(['www.meizu.com', 'www.mi.com', 'www.vivo.com', 'www.huawei.com', 'www.samsung.com']),
        appid: 'yidian',
        comment: utils.get_words(),
        impid: this.article.impid,
        itemid: this.article.itemid,
        docid: this.article.docid,
        version: '020123',
        net: 'wifi'
      },
      json: true
    }).then(json => {
      if (json.code) { throw new Error(json.reason) }
      if (json.comment.pending_reason) { throw new Error(json.comment.pending_reason) }

      console.log(`✔`)
      return json.comment
    })
  }

  async process() {
    try {
      const comment = await this.comment()
      await save_comment(comment)
    } catch (e) {
      console.log(`❌ ${e.message}`)
    }
  }
}

module.exports = async function(start, end) {
  const articles = await fetch_news(start, end)

  for (let i = 0; i < articles.length; i++) {
    const user = await get_user()
    const speaker = new Speaker(user, articles[i])
    await speaker.process()
    await utils.delay(1000)
  }
}
