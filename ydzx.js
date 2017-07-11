#!/usr/bin/env node
'use strict'

const program = require('commander')
const service = require('./lib/service')
const register = require('./lib/register')
const comment = require('./lib/comment')
const like = require('./lib/like')

program
  .version('1.0.0')
  .description('一点资讯营销工具')
  .option('-r --register <n>', '注册', parseInt)
  .option('-c --comment', '评论')
  .option('-l --like', '点赞')
  .parse(process.argv)

if (!program.register && !program.comment && !program.like) {
  program.help()
}

(async function() {
  await service.init()
  console.log('\n### 棱镜核心已启动 ###\n\n')

  if (program.register) { await register(program.register) }
  if (program.comment) { await comment() }
  if (program.like) { await like() }

  await service.shutdown()
})()
