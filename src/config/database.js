const { Pool } = require('pg')

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'rotaexpress',
  password: '150505',
  port: 5432,
})

module.exports = pool