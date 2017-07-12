const faker = require('faker')
const axios = require('axios')
const moment = require('moment')
const qs = require('querystring')
const _ = require('lodash')
const service = require('./service')
const utils = require('./utils')

const CHANNELS = [
  { id: 'u11272', name: '搞笑GIF' },
  { id: 't1121', name: '街拍' },
]

function fetch_news_by_channel(channel) {
  console.log(`获取 [${channel.name}] 文章列表...`)

  return axios.get('http://www.yidianzixun.com/home/q/news_list_for_channel', {
    headers: {
      'user-agent': faker.internet.userAgent()
    },
    params: {
      channel_id: channel.id,
      cstart: 0,
      cend: 20,
      __from__: 'pc',
      multi: 5,
      appid: 'web_yidian',
      _: Date.now()
    }
  })
  .then(res => {
    if (res.data.code) {
      console.log(`获取 [${channel.name}] 文章列表失败: ${res.data.reason}`)
      return []
    } else {
      return res.data.result
                .filter(n => n.docid && n.comment_count > 10)
                .filter(n => {
                  const now = moment()
                  const date = moment(n.date)

                  return now.diff(date, 'days') <= 2
                })
    }
  })
}

async function fetch_news() {
  const result = _.flatten(await Promise.all(CHANNELS.map(fetch_news_by_channel)))

  console.log(`已获取文章 ${result.length} 篇`)
  return result
}

function get_user() {
  const collection = service.db.collection('users')

  return collection.findOneAndUpdate(
    {},
    { $inc: { use_count: 1 } },
    { sort: { use_count: 1 }, returnOriginal: false }
  ).then(r => r.value)
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
    console.log(`评论 [${this.article.title}] ...`)

    return utils.request_by_proxy({
      method: 'get',
      url: 'http://a1.go2yd.com/Website/interact/add-comment',
      headers: {
        'user-agent': this.ua,
        'x-tingyun-processed': true,
        cookie: this.user.cookie
      },
      params: {
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
      }
    }).then(res => {
      if (res.data.code) { throw new Error(res.data.reason) }
      if (res.data.comment.pending_reason) { throw new Error(res.data.comment.pending_reason) }

      console.log(`评论 [${this.article.title}] 成功`)
      return res.data.comment
    })
  }

  async process() {
    try {
      const comment = await this.comment()
      await save_comment(comment)
    } catch (e) {
      console.log(`评论 [${this.article.title}] 失败: ${e.message}`)
    }
  }
}

module.exports = async function() {
  const articles = await fetch_news()

  for (let i = 0; i < articles.length; i++) {
    const user = await get_user()
    const speaker = new Speaker(user, articles[i])
    await speaker.process()
  }
}
