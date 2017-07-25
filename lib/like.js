const axios = require('axios')
const request = require('request-promise-native')
const faker = require('faker')
const _ = require('lodash')
const service = require('./service')
const utils = require('./utils')

function get_user() {
  const collection = service.db.collection('users')

  return collection.findOneAndUpdate(
    { type: 2 },
    { $inc: { use_count: 1 } },
    { sort: { use_count: 1 }, returnOriginal: false }
  ).then(r => r.value)
}

function get_comments() {
  const collection = service.db.collection('comments')

  return collection.find({ ok: false }).toArray()
}

function finish_comments() {
  const collection = service.db.collection('comments')

  return collection.updateMany({ ok: false }, { $set: { ok: true } })
}

function delete_comment(comment) {
  const collection = service.db.collection('comments')

  return collection.deleteMany({ comment_id: comment.comment_id })
}

function get_proxy() {
  const coll = service.db.collection('ip')

  return coll.findOneAndUpdate(
    {},
    { $inc: { use_count: 1 } },
    { sort: { use_count: 1 }, returnOriginal: false }
  ).then(r => r.value)
}

function delete_proxy(proxy) {
  const coll = service.db.collection('ip')

  if (proxy.fail_count > 3) {
    return coll.deleteOne({ addr: proxy.addr })
  } else {
    return coll.updateOne({ addr: proxy.addr }, { $inc: { fail_count: 1 } })
  }
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
    if (res.data.code) { return 35 }

    const hot_comments = res.data.hot_comments

    if (!hot_comments || hot_comments.length < 3) { return 35 }

    const sorted_hot_comments = hot_comments.sort((a, b) => b.like - a.like)

    if (sorted_hot_comments[0].like < 100) { return sorted_hot_comments[0].like + 10 }
    else { return sorted_hot_comments[2].like + 20 }
  })
  .then(count => count > 150 ? 150 : count)
  .catch(e => 35)
}

async function calc_all_comments_count() {
  const comments = await get_comments()
  
  return _.zipWith(
    comments,
    await Promise.all(comments.map(calc_like_count)),
    (comment, limit) => Object.assign(comment, { limit, like: 0, exist: true, repeat: 0 })
  )
}

function is_comments_finished(comments) {
  return comments.every(comment => !comment.exist || comment.like >= comment.limit)
}

function like_comment(user, proxy, comment) {
  return request({
    uri: 'http://a1.go2yd.com/Website/interact/like-comment',
    headers: {
      'user-agent': faker.internet.userAgent,
      'x-tingyun-processed': true,
      cookie: user.cookie
    },
    timeout: 3000,
    proxy: proxy.addr,
    qs: {
      platform: 1,
      appid: 'yidian',
      cv: '4.0.1.0',
      distribution: _.sample(['www.meizu.com', 'www.mi.com', 'www.vivo.com', 'www.huawei.com', 'www.samsung.com']),
      comment_id: comment.comment_id,
      version: '020123',
      net: 'wifi'
    },
    json: true
  })
  .then(json => {
    if (json.code) { throw new Error(json.reason) }
  })
}

async function like_comments_once(comments) {
  const user = await get_user()
  const proxy = await get_proxy()

  for (let i = 0; i < comments.length; i++) {
    const comment = comments[i]

    if (comment.exist && comment.like < comment.limit) {
      try {
        console.log(`${user.username}  -->  http://www.yidianzixun.com/article/${comment.docid}`)
        await like_comment(user, proxy, comment)
        console.log('✔')

        comment.like++
        comment.repeat = 0
      } catch (e) {
        console.log(`❌ ${e.message} ${proxy.addr}`)

        if (/找不到评论/.test(e)) {
          comment.exist = false
          await delete_comment(comment)
        }
        else if (/重复提交/.test(e)) {
          if (comment.repeat > 3) {
            comment.exist = false
          }else {
            comment.repeat++
            return
          }
        }
        else {
          await delete_proxy(proxy)
          return
        }
      }

      await utils.delay(300)
    }
  }
}

function report(comments) {
  const r = comments.reduce(
    (acc, comment) => ({
      like: acc.like + (comment.exist ? comment.like : comment.limit),
      limit: acc.limit + comment.limit
    }),
    { like: 0, limit: 0 }
  )

  console.log(`===>>> ${r.like}/${r.limit}`)
}

module.exports = async function() {
  const comments = await calc_all_comments_count()

  while (!is_comments_finished(comments)) {
    try {
      console.log(_.repeat('-', 64))
      await like_comments_once(comments)
      report(comments)
    } catch (e) {
      console.log(e)
    }
  }

  await finish_comments()
}
