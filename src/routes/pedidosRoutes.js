const express = require('express')
const router = express.Router()
const pedidosController = require('../controllers/pedidosController')
const pool = require('../config/db') 
const path = require('path') 

router.post('/pedidos', pedidosController.criarPedido)
router.get('/pedidos', pedidosController.listarPedidos)
router.put('/pedidos/:id/aceitar', pedidosController.aceitarPedido)
router.put('/pedidos/:id/concluir', pedidosController.concluirPedido)

// 🔥 ROTA DE ACOMPANHAMENTO
router.get('/acompanhar/:token', async (req, res) => {
  const { token } = req.params

  console.log("Acessou acompanhar:", token) // 👈 TESTE

  try {

    const result = await pool.query(
      "SELECT * FROM pedidos WHERE tracking_token = $1",
      [token]
    )

    if (result.rows.length === 0) {
      return res.status(404).send("Pedido não encontrado")
    }

    res.sendFile(path.resolve(__dirname, '../../public/acompanhamento.html'))

  } catch (error) {
    console.error(error)
    res.status(500).send("Erro no servidor")
  }
})

router.get(
  '/rota',
  pedidosController.buscarRota
)

module.exports = router