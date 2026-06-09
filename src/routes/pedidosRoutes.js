const express = require('express')
const router = express.Router()
const pedidosController = require('../controllers/pedidosController')
const pool = require('../config/db') 
const path = require('path') 

router.post('/pedidos', pedidosController.criarPedido)
router.get('/pedidos', pedidosController.listarPedidos)
router.put('/pedidos/:id/aceitar', pedidosController.aceitarPedido)
router.put('/pedidos/:id/concluir', pedidosController.concluirPedido)

// 🔥 ROTA DE ACOMPANHAMENTO (Entrega o HTML)
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

router.get('/rota', pedidosController.buscarRota)

// 🔥 ROTA DA API DO TRACKING (Usada pelo HTML para ler os dados)
router.get("/pedido-token/:token", async (req, res) => {
  const { token } = req.params;

  try {
    // ATUALIZADO: Agora busca também o status e o codigo_validacao
    const result = await pool.query(
      `
      SELECT id, status, codigo_validacao
      FROM pedidos
      WHERE tracking_token = $1
      `,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Pedido não encontrado" });
    }

    res.json(result.rows[0]);

  } catch (error) {
    res.status(500).json({ error: "Erro servidor" });
  }
});

module.exports = router