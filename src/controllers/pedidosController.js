const pool = require('../config/db')
const { v4: uuidv4 } = require('uuid') // importar uuid
const axios = require('axios')

exports.criarPedido = async (req, res) => {
  // ADICIONADO: 'cliente_telefone' agora deve vir na requisição do restaurante
  const { restaurante_id, endereco_coleta, endereco_entrega, valor_entrega, cliente_telefone } = req.body

  try {
    const tracking_token = uuidv4() // gera token único

    // TRUQUE DO TELEFONE: Se não vier telefone, define como '0000' por segurança, senão limpa e pega os 4 últimos
    let codigoValidacao = '0000';
    if (cliente_telefone) {
      const telefoneLimpo = cliente_telefone.replace(/\D/g, ''); 
      codigoValidacao = telefoneLimpo.slice(-4); // Pega os últimos 4 dígitos
    }

    // ADICIONADO: cliente_telefone e codigo_validacao na Query SQL
    const result = await pool.query(
      `INSERT INTO pedidos 
      (restaurante_id, endereco_coleta, endereco_entrega, valor_entrega, tracking_token, cliente_telefone, codigo_validacao)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [restaurante_id, endereco_coleta, endereco_entrega, valor_entrega, tracking_token, cliente_telefone, codigoValidacao]
    )

    res.status(201).json(result.rows[0])

  } catch (error) {
    console.error(error);
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

// ATUALIZADO: Agora valida o código inserido pelo motoboy antes de concluir
exports.concluirPedido = async (req, res) => {
  const { id } = req.params
  const { codigoDigitado } = req.body // Código que o motoboy digitou no app Flutter

  try {
    // 1. Busca o código real guardado no banco para este pedido
    const buscaPedido = await pool.query(
      "SELECT codigo_validacao FROM pedidos WHERE id = $1",
      [id]
    )

    if (buscaPedido.rows.length === 0) {
      return res.status(404).json({ error: "Pedido não encontrado" })
    }

    const codigoReal = buscaPedido.rows[0].codigo_validacao;

    // 2. Compara se o código digitado confere com o do banco
    if (codigoDigitado !== codigoReal) {
      return res.status(400).json({ error: "Código de verificação incorreto! Confirme com o cliente." })
    }

    // 3. Se estiver correto, aí sim atualiza para 'entregue'
    const result = await pool.query(
      `UPDATE pedidos
       SET status='entregue'
       WHERE id=$1
       RETURNING *`,
      [id]
    )

    res.json(result.rows[0])

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao concluir entrega" })
  }
}

exports.buscarRota = async (req, res) => {
  const { origemLat, origemLng, destinoLat, destinoLng } = req.query

  try {
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/directions/json",
      {
        params: {
          origin: `${origemLat},${origemLng}`,
          destination: `${destinoLat},${destinoLng}`,
          mode: "driving",
          key: process.env.GOOGLE_API_KEY,
        }
      }
    )
    res.json(response.data)
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar rota" })
  }
}

// NOVO: Função para o HTML do cliente ler os dados pelo token seguro
exports.obterTrackingPedido = async (req, res) => {
  const { token } = req.params

  try {
    const result = await pool.query(
      "SELECT id, status, endereco_entrega, codigo_validacao FROM pedidos WHERE tracking_token = $1",
      [token]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Pedido não encontrado" })
    }

    res.json(result.rows[0])
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar dados de tracking" })
  }
}