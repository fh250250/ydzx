const axios = require('axios')
const faker = require('faker')
const _ = require('lodash')
const service = require('./service')
const utils = require('./utils')

function get_user() {
  const collection = service.db.collection('users')

  return collection.findOneAndUpdate(
    {},
    { $inc: { like_count: 1 } },
    { sort: { like_count: 1 }, returnOriginal: false }
  ).then(r => r.value)
}

function get_comment() {
  const collection = service.db.collection('comments')

  return collection.findOneAndUpdate(
    { ok: false },
    { $set: { ok: true } },
    { returnOriginal: false }
  ).then(r => r.value)
}

function calc_like_count(comment) {
  return axios.get('http://www.yidianzixun.com/home/q/getcomments', {
    headers: {
      'user-agent': faker.internet.userAgent()
    },
    params: {
      docid: comment.docid,
      s: '',
      count: 30,
      last_comment_id: '',
      appid: 'web_yidian',
      _: Date.now()
    }
  }).then(res => {
    if (res.data.code) { throw new Error(res.data.reason) }

    const hot_comments = res.data.hot_comments

    if (!hot_comments || hot_comments.length < 3) { return 35 }

    const sorted_hot_comments = hot_comments.sort((a, b) => b.like - a.like)

    if (sorted_hot_comments[0].like < 100) { return sorted_hot_comments[0].like + 10 }
    else { return sorted_hot_comments[2].like + 20 }
  })
}

async function add_like(comment) {
  const user = await get_user()
  console.log(`${user.nickname} 点赞...`)

  const res = await utils.request_by_proxy({
    method: 'get',
    url: 'http://a1.go2yd.com/Website/interact/like-comment',
    headers: {
      'user-agent': faker.internet.userAgent,
      'x-tingyun-processed': true,
      cookie: user.cookie
    },
    params: {
      platform: 1,
      appid: 'yidian',
      cv: '4.0.1.0',
      distribution: _.sample(['www.meizu.com', 'www.mi.com', 'www.vivo.com', 'www.huawei.com', 'www.samsung.com']),
      comment_id: comment.comment_id,
      version: '020123',
      net: 'wifi'
    }
  })

  if (res.data.code) { throw new Error(res.data.reason) }
}

async function like_comment(comment) {
  const need_like_count = await calc_like_count(comment)
  console.log(`\n\n------------------- 开始点赞 [${comment.comment_id}] ${need_like_count} 次`)

  for (let i = 0; i < need_like_count; i++) {
    try {
      console.log(`进度 >> [${i + 1}/${need_like_count}]`)
      await add_like(comment)
    } catch (e) {
      console.log(e.message)
      if (/找不到评论/.test(e.message)) { return }
    }
  }
}

module.exports = async function() {
  while (true) {
    const comment = await get_comment()

    if (!comment) { return }

    try {
      await like_comment(comment)
    } catch (e) {
      console.log(`点赞 ${comment.comment_id} 异常: ${e.message}`)
    }
  }
}
