#!/usr/bin/env node
'use strict'

const program = require('commander')
const utils = require('./lib/utils')
const register = require('./lib/register')
const comment = require('./lib/comment')
const like = require('./lib/like')
const fetch_proxy = require('./lib/ip_crawler')

program
  .version('1.0.0')
  .description('一点资讯营销工具')

program
  .command('register [n]')
  .description('注册')
  .alias('r')
  .action(n => {
    utils.run(async () => {
      await register(parseInt(n) || 10)
    })
  })

program
  .command('comment [range]')
  .alias('c')
  .description('评论')
  .action(range => {
    const r = range ? range.split('-') : []
    const start = parseInt(r[0]) || 0
    const end = parseInt(r[1]) || 10

    utils.run(async () => {
      await comment(start, end)
    })
  })

program
  .command('like')
  .alias('l')
  .description('点赞')
  .action(() => {
    utils.run(async () => {
      await like()
    })
  })

program
  .command('proxy')
  .alias('p')
  .description('抓取代理')
  .action(() => {
    utils.run(async () => {
      await fetch_proxy()
    })
  })

program.parse(process.argv)
