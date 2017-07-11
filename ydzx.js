#!/usr/bin/env node
'use strict'

const program = require('commander')
const service = require('./lib/service')
const register = require('./lib/register')
const comment = require('./lib/comment')
const like = require('./lib/like')

async function run(func, ...args) {
  await service.init()
  console.log('\n### 棱镜核心已启动 ###\n\n')

  await func(...args)

  await service.shutdown()
}

program
  .version('1.0.0')
  .description('一点资讯营销工具')

program
  .command('register [n]')
  .description('注册用户')
  .alias('r')
  .action(n => run(register, parseInt(n) || 10))

program
  .command('comment')
  .description('评论文章')
  .alias('c')
  .action(n => run(comment))

program
  .command('like')
  .description('点赞')
  .action(n => run(like))

program.parse(process.argv)
