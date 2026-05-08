const pool = require('../config/db')
const bcrypt = require('bcrypt')

exports.register = async (req, res) => {
  const { nome, email, senha, tipo } = req.body

  try {

    const userExists = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    )

    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: "Email já cadastrado" })
    }

    const hashedPassword = await bcrypt.hash(senha, 10)

    const result = await pool.query(
      "INSERT INTO users (nome, email, senha, tipo) VALUES ($1,$2,$3,$4) RETURNING *",
      [nome, email, hashedPassword, tipo]
    )

    res.status(201).json(result.rows[0])

  } catch (error) {
  console.error(error)
  res.status(500).json({ error: error.message })
}
}

exports.login = async (req, res) => {
  const { email, senha } = req.body

  try {

    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    )

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Usuário não encontrado" })
    }

    const user = result.rows[0]

    const validPassword = await bcrypt.compare(senha, user.senha)

    if (!validPassword) {
      return res.status(400).json({ message: "Senha inválida" })
    }

    res.json({
      message: "Login realizado",
      user
    })

  } catch (error) {
    res.status(500).json({ error: "Erro no login" })
  }
}