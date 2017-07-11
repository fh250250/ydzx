const ObjectID = require('mongodb').ObjectID
const axios = require('axios')
const faker = require('faker')
const _ = require('lodash')
const service = require('./service')
const pm = require('./proxy')
const utils = require('./utils')

function get_user() {
  const collection = service.db.collection('users')

  return collection.findOneAndUpdate(
    {},
    { $inc: { like_count: 1 } },
    { sort: { like_count: 1 }, returnOriginal: false }
  ).then(r => r.value)
}

function get_comments() {
  const collection = service.db.collection('comments')

  return collection.find({ ok: false }).toArray()
}

function finish_comment(comment) {
  const collection = service.db.collection('comments')

  return collection.updateOne(
    { _id: ObjectID(comment._id) },
    { $set: { ok: true } }
  )
}

function get_like_count(comment) {
  console.log(`计算 ${comment.docid} 需要点赞数...`)
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
    if (res.data.code) {
      console.log(`未计算出 ${comment.docid} 需要点赞数...`)
      return 0
    }

    const hot_comments = res.data.hot_comments

    if (!hot_comments || hot_comments.length < 3) { return 35 }

    const sorted_hot_comments = hot_comments.sort((a, b) => b.like - a.like)

    if (sorted_hot_comments[0].like < 100) { return sorted_hot_comments[0].like + 10 }
    else { return sorted_hot_comments[2].like + 20 }
  }).catch(e => {
    console.log(`未计算出 ${comment.docid} 需要点赞数...`)
    return 0
  })
}

async function get_calc_comments() {
  const comments = await get_comments()
  const calc_comments = await Promise.all(comments.map(get_like_count))

  return _.zipWith(
    comments,
    calc_comments,
    (c, r) => Object.assign(c, { limit: r, like: 0 })
  )
}

async function add_like({ user, proxy, ua }, comment) {
  console.log(`${user.nickname} 点赞 ${comment.comment_id} ...`)

  try{
    const res = await axios.get('http://a1.go2yd.com/Website/interact/like-comment', {
      headers: {
        'user-agent': ua,
        'x-tingyun-processed': true,
        cookie: user.cookie
      },
      timeout: 3000,
      proxy,
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

    if (res.data.code) {
      // 评论失败

      if (res.data.code === 162) {
        // 如果是评论被删了，就不再点赞了
        comment.ok = true
        await finish_comment(comment)
      }

      console.log(res.data.reason)
      return
    }

    comment.like++
    if (comment.like >= comment.limit) { await finish_comment(comment) }
  } catch (e) {
    // 忽略
    console.log(`无效代理 ${proxy.host}:${proxy.port}`)
  }
}

function can_like_comment(comment) {
  return !comment.ok && comment.like < comment.limit
}

async function like_comments(comments) {
  const ctx = {
    user: await get_user(),
    proxy: await pm.get_proxy(),
    ua: faker.internet.userAgent
  }

  for (let i = 0; i < comments.length; i++) {
    const c = comments[i]

    if (can_like_comment(c)) { await add_like(ctx, c) }
  }
}

function report(comments) {
  const result = comments.reduce(
    (total, c) => ({
      like: total.like + (c.ok ? c.limit : c.like),
      limit: total.limit + c.limit
    }),
    { like: 0, limit: 0 }
  )

  console.log(`当前进度 >>> [${result.like}/${result.limit}]`)
}

module.exports = async function() {
  const comments = await get_calc_comments()

  while (comments.some(can_like_comment)) {
    await like_comments(comments)
    report(comments)
  }
}
