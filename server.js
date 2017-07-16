const path = require('path')
const fs = require('fs')
const express = require('express')
const bodyParser = require('body-parser')

const app = express()

app.use(bodyParser.urlencoded({ extended: true }))

app.get('/', (req, res) => {
  const content = fs.readFileSync(path.resolve(__dirname, 'data/words.txt'), 'utf-8')
  const html = `
<!DOCTYPE html>
<html>
  <head>
    <title>话术</title>
    <style>
      * { box-sizing: border-box; }
      html,body { margin: 0; }
      body { padding: 20px; }
      h1 { text-align: center; margin-top: 0; }
      textarea { display: block; height: 500px; width: 100%; padding: 20px; resize: none; outline: none; font-size: 16px; line-height: 1.6; }
      button { margin: 20px auto; display: block; }
    </style>
  </head>
  <body>
    <h1>话术管理</h1>
    <form action="/words" method="post">
      <textarea name="content">${content}</textarea>
      <button type="submit">提交</button>
    </form>
  </body>
</html>
`

  res.send(html)
})

app.post('/words', (req, res) => {
  fs.writeFileSync(path.resolve(__dirname, 'data/words.txt'), req.body.content, 'utf-8')

  res.redirect('/')
})

app.listen(9527, () => console.log('Server is flying...'))
