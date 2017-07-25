const MongoClient = require('mongodb').MongoClient

const CONNECT_URL = 'mongodb://localhost:27017/ydzx'

class Service {
  constructor() {
    this.db = null
  }

  async init() {
    this.db = await MongoClient.connect(CONNECT_URL)
    await this.db.collection('users').createIndex({ use_count: 1 })
    await this.db.collection('ip').createIndex({ addr: 1 }, { unique: true })
    await this.db.collection('ip').createIndex({ use_count: 1 })
  }

  async shutdown() {
    await this.db.close()
  }
}

module.exports = new Service()
