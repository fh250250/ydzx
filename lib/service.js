const MongoClient = require('mongodb').MongoClient

const CONNECT_URL = 'mongodb://localhost:27017/ydzx'

class Service {
  constructor() {
    this.db = null
  }

  async init() {
    this.db = await MongoClient.connect(CONNECT_URL)
  }

  async shutdown() {
    await this.db.close()
  }
}

module.exports = new Service()