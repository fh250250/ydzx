const faker = require('faker')
const axios = require('axios')
const moment = require('moment')
const qs = require('querystring')
const _ = require('lodash')
const service = require('./service')
const utils = require('./utils')
const pm = require('./proxy')

const KEYWORDS = ['街拍', '搞笑', '艺术']

function fetch_news_by_keyword(keyword) {
  console.log(`获取 [${keyword}] 文章列表...`)

  return axios.get('http://www.yidianzixun.com/home/q/news_list_for_keyword', {
    headers: {
      'user-agent': faker.internet.userAgent()
    },
    params: {
      display: keyword,
      cstart: 0,
      cend: 30,
      word_type: 'token',
      multi: 5,
      appid: 'web_yidian',
      _: Date.now()
    }
  })
  .then(res => {
    if (res.data.code) {
      console.log(`获取 [${keyword}] 文章列表失败: ${res.data.reason}`)
      return []
    } else {
      return res.data.result
                .filter(n => n.docid && n.comment_count > 10)
                .filter(n => {
                  const now = moment()
                  const date = moment(n.date)

                  return now.diff(date, 'days') <= 2
                })
                .map(n => n.docid)
    }
  })
}

async function fetch_news() {
  const result = _.flatten(await Promise.all(KEYWORDS.map(fetch_news_by_keyword)))

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

  return collection.insertOne(Object.assign(comment, { like: false }))
}

class Speaker {
  constructor(username, password) {
    this.username = username
    this.password = password
    this.cookie = null
    this.ua = faker.internet.userAgent()
    this.proxy = null
  }

  login() {
    console.log(`登陆 ${this.username} ...`)

    return axios({
      method: 'post',
      url: 'http://www.yidianzixun.com/mp_sign_in',
      headers: {
        'user-agent': this.ua,
        'content-type': 'application/x-www-form-urlencoded'
      },
      proxy: this.proxy,
      data: qs.stringify({ username: `${this.username}`, password: this.password })
    }).then(res => {
      if (res.data.code) {
        throw new Error(res.data.reason)
      } else {
        this.cookie = res.headers['set-cookie'].join(';')
      }
    })
  }

  comment(docid) {
    console.log(`评论 ${docid} ...`)

    return axios.get('http://www.yidianzixun.com/home/q/addcomment', {
      headers: {
        'user-agent': this.ua,
        cookie: this.cookie
      },
      proxy: this.proxy,
      params: {
        docid,
        comment: utils.get_words(),
        appid: 'yidian',
        _: Date.now()
      }
    }).then(res => {
      if (res.data.code) {
        throw new Error(res.data.reason)
      } else {
        return _.pick(res.data.comment, ['docid', 'comment_id'])
      }
    })
  }

  async process(docid) {
    try {
      this.proxy = await pm.get_proxy()
      await this.login()
      await utils.delay(3000)
      const comment = await this.comment(docid)
      await save_comment(comment)
    } catch (e) {
      console.log(`评论 ${docid} 失败: ${e.message}`)
    }
  }
}

module.exports = async function() {
  const news = await fetch_news()

  for (let i = 0; i < news.length; i++) {
      const user = await get_user()
      const speaker = new Speaker(user.username, user.password)
      await speaker.process(news[i])
  }
}
