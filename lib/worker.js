const util = require('util')
const fs = require('fs')
const path = require('path')
const qs = require('querystring')
const axios = require('axios')
const faker = require('faker')
const moment = require('moment')
const _ = require('lodash')
const config = require('../config')
const utils = require('./utils')
const appendFile = util.promisify(fs.appendFile)

class Worker {
  constructor(phone, password) {
    this.phone = phone
    this.password = password
    this.cookie = null
    this.ua = faker.internet.userAgent()
  }

  static async getNews() {
    console.log('获取文章列表...')
    
    const res = await axios.get('http://www.yidianzixun.com/home/q/news_list_for_keyword', {
      headers: {
        'user-agent': faker.internet.userAgent()
      },
      params: {
        display: config.keywords[_.random(0, config.keywords.length - 1)],
        cstart: 0,
        cend: 20,
        word_type: 'token',
        multi: 5,
        appid: 'web_yidian',
        _: Date.now()
      }
    })

    if (res.data.code) {
      console.log('[失败] 获取文章列表')
      throw new Error(res.data.reason)
    }

    return res.data.result
              .filter(n => n.docid && n.comment_count > 10)
              .filter(n => {
                const now = moment()
                const date = moment(n.date)

                return now.diff(date, 'days') <= 2
              })
              .map(n => _.pick(n, ['docid', 'date', 'title']))
  }

  async login() {
    console.log(`${this.phone} 登陆中...`)

    const res = await axios({
      method: 'post',
      url: 'http://www.yidianzixun.com/mp_sign_in',
      headers: {
        'user-agent': this.ua,
        'content-type': 'application/x-www-form-urlencoded'
      },
      data: qs.stringify({ username: `86${this.phone}`, password: this.password })
    })

    if (res.data.code) {
      console.log(`${this.phone} 登陆失败`)
      throw new Error(res.data.reason)
    }

    this.cookie = res.headers['set-cookie'].join(';')
    console.log(`${this.phone} 登陆成功`)
  }

  async comment(article) {
    console.log(`评论 [${article.title}] ...`)
    
    const res = await axios.get('http://www.yidianzixun.com/home/q/addcomment', {
      headers: {
        'user-agent': this.ua,
        cookie: this.cookie
      },
      params: {
        docid: article.docid,
        comment: config.words[_.random(0, config.words.length - 1)],
        appid: 'yidian',
        _: Date.now()
      }
    })

    if (res.data.code) {
      console.log(`评论 [${article.title}] 失败`)      
      throw new Error(res.data.reason)
    }

    console.log(`评论 [${article.title}] 成功`)    

    await appendFile(
      path.resolve(__dirname, '../comments_report.txt'),
      `${article.title} http://www.yidianzixun.com/article/${article.docid} ${res.data.comment.nickname}\n`
    )

    await appendFile(
      path.resolve(__dirname, '../comments.txt'),
      `${article.docid}----${res.data.comment.comment_id}\n`
    )
  }

  async run(article) {
    try {
      await this.login()
      await utils.delay(3000)
      await this.comment(article)
    } catch (e) {
      console.log(`失败: ${e.message}`)
    }
  }
}

module.exports = Worker
