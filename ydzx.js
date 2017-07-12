#!/usr/bin/env node
'use strict'

const program = require('commander')
const service = require('./lib/service')
const register = require('./lib/register')
const comment = require('./lib/comment')
const like = require('./lib/like')

async function run(command, ...args) {
  await service.init()
  console.log('\n### 棱镜核心已启动 ###\n\n')

  await command(...args)

  await service.shutdown()
}

program
  .version('1.0.0')
  .description('一点资讯营销工具')

program
  .command('register [n]')
  .description('注册')
  .alias('r')
  .action(n => run(register, parseInt(n) || 10))

program
  .command('comment [range]')
  .alias('c')
  .description('评论')
  .action(range => {
    const r = range ? range.split('-') : []
    const start = parseInt(r[0]) || 0
    const end = parseInt(r[1]) || 10

    run(comment, start, end)
  })

program
  .command('like')
  .alias('l')
  .description('点赞')
  .action(() => run(like))

program.parse(process.argv)
