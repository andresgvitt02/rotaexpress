const pool = require('../config/db')
const { v4: uuidv4 } = require('uuid') // importar uuid
const axios = require('axios')

exports.criarPedido = async (req, res) => {
  const { restaurante_id, endereco_coleta, endereco_entrega, valor_entrega } = req.body

  try {

    const tracking_token = uuidv4() // gera token único

    const result = await pool.query(
      `INSERT INTO pedidos 
      (restaurante_id, endereco_coleta, endereco_entrega, valor_entrega, tracking_token)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *`,
      [restaurante_id, endereco_coleta, endereco_entrega, valor_entrega, tracking_token]
    )

    res.status(201).json(result.rows[0])

  } catch (error) {
    res.status(500).json({ error: "Erro ao criar pedido" })
  }
}

exports.listarPedidos = async (req, res) => {

  try {

    const result = await pool.query(
      "SELECT * FROM pedidos WHERE status = 'disponivel'"
    )

    res.json(result.rows)

  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar pedidos" })
  }
}

exports.aceitarPedido = async (req, res) => {
  const { id } = req.params
  const { motoboy_id } = req.body

  try {

    const result = await pool.query(
      `UPDATE pedidos 
       SET motoboy_id=$1, status='aceito'
       WHERE id=$2 AND status='disponivel'
       RETURNING *`,
      [motoboy_id, id]
    )

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Pedido não disponível" })
    }

    res.json(result.rows[0])

  } catch (error) {
    res.status(500).json({ error: "Erro ao aceitar pedido" })
  }
}

exports.concluirPedido = async (req, res) => {
  const { id } = req.params

  try {

    const result = await pool.query(
      `UPDATE pedidos
       SET status='entregue'
       WHERE id=$1
       RETURNING *`,
      [id]
    )

    res.json(result.rows[0])

  } catch (error) {
    res.status(500).json({ error: "Erro ao concluir entrega" })
  }
}

exports.buscarRota = async (req, res) => {

  const {
    origemLat,
    origemLng,
    destinoLat,
    destinoLng
  } = req.query

  try {

    const response =
      await axios.get(
        "https://maps.googleapis.com/maps/api/directions/json",
        {
          params: {

            origin:
              `${origemLat},${origemLng}`,

            destination:
              `${destinoLat},${destinoLng}`,

            mode: "driving",

            key:
              process.env.GOOGLE_API_KEY,

          }
        }
      )

    res.json(
      response.data,
    )

  } catch (error) {

    res.status(500).json({
      error: "Erro ao buscar rota"
    })

  }
}