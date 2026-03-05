require('dotenv').config()
const express = require('express')
const cors = require('cors')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const pool = require('./src/config/database')

const app = express()

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.json({ message: "API RotaEXPRESS funcionando 🚀" })
})

app.post('/register', async (req, res) => {
  const { nome, email, senha, tipo } = req.body

  try {
    const userExists = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    )

    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'Email já cadastrado' })
    }

    // 🔐 Criptografar senha
    const saltRounds = 10
    const senhaCriptografada = await bcrypt.hash(senha, saltRounds)

    const result = await pool.query(
      'INSERT INTO users (nome, email, senha, tipo) VALUES ($1, $2, $3, $4) RETURNING *',
      [nome, email, senhaCriptografada, tipo]
    )

    res.status(201).json({
      message: 'Usuário criado com sucesso',
      user: {
        id: result.rows[0].id,
        nome: result.rows[0].nome,
        email: result.rows[0].email,
        tipo: result.rows[0].tipo
      }
    })

  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao criar usuário' })
  }
})

app.post('/login', async (req, res) => {
  const { email, senha } = req.body

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    )

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Usuário não encontrado' })
    }

    const user = result.rows[0]

    // 🔐 Comparar senha digitada com a criptografada
    const senhaValida = await bcrypt.compare(senha, user.senha)

    if (!senhaValida) {
      return res.status(400).json({ error: 'Senha incorreta' })
    }

    res.status(200).json({
      message: 'Login realizado com sucesso',
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        tipo: user.tipo
      }
    })

  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao realizar login' })
  }
})

const PORT = 3000

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`)
})

