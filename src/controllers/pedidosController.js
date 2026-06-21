const pool = require('../config/db')
const { v4: uuidv4 } = require('uuid') // importar uuid
const axios = require('axios')

exports.criarPedido = async (req, res) => {
  const { restaurante_id, endereco_coleta, endereco_entrega, valor_entrega, cliente_telefone } = req.body

  try {
    const tracking_token = uuidv4() // gera token único

    // TRUQUE DO TELEFONE: Se não vier telefone, define como '0000' por segurança, senão limpa e pega os 4 últimos
    let codigoValidacao = '0000';
    if (cliente_telefone) {
      const telefoneLimpo = cliente_telefone.replace(/\D/g, ''); 
      codigoValidacao = telefoneLimpo.slice(-4); // Pega os últimos 4 dígitos
    }

    const result = await pool.query(
      `INSERT INTO pedidos 
      (restaurante_id, endereco_coleta, endereco_entrega, valor_entrega, tracking_token, cliente_telefone, codigo_validacao)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [restaurante_id, endereco_coleta, endereco_entrega, valor_entrega, tracking_token, cliente_telefone, codigoValidacao]
    )

    // 🔥 Avisa o aplicativo do motoboy em tempo real sobre o novo pedido
    const io = req.app.get('socketio');
    if (io) {
      io.emit('novoPedidoDisponivel', result.rows[0]);
    }

    res.status(201).json(result.rows[0])

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar pedido" })
  }
}

// 🔄 MODIFICADO: Esconde automaticamente pedidos concluídos ou arquivados da lista geral do restaurante
exports.listarPedidos = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM pedidos WHERE status NOT IN ('entregue', 'concluido_pelo_restaurante') ORDER BY id DESC"
    )
    res.json(result.rows)
  } catch (error) {
    console.error(error)
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

    // 🔥 ADICIONADO: Avisa o Painel Web do Restaurante para recarregar a página sozinho porque o motoboy aceitou!
    const io = req.app.get('socketio');
    if (io) {
      io.emit('atualizarPainelRestaurante');
    }

    res.json(result.rows[0])

  } catch (error) {
    res.status(500).json({ error: "Erro ao aceitar pedido" })
  }
}

exports.concluirPedido = async (req, res) => {
  const { id } = req.params
  const { codigoDigitado } = req.body

  try {
    const buscaPedido = await pool.query(
      "SELECT codigo_validacao FROM pedidos WHERE id = $1",
      [id]
    )

    if (buscaPedido.rows.length === 0) {
      return res.status(404).json({ error: "Pedido não encontrado" })
    }

    const codigoReal = buscaPedido.rows[0].codigo_validacao;

    if (codigoDigitado !== codigoReal) {
      return res.status(400).json({ error: "Código de verificação incorreto! Confirme com o cliente." })
    }

    const result = await pool.query(
      `UPDATE pedidos
       SET status='entregue'
       WHERE id=$1
       RETURNING *`,
      [id]
    )

    // 🔥 Avisar o HTML do cliente que o pedido foi concluído pelo entregador
    const io = req.app.get('socketio');
    if (io) {
      io.emit('pedidoConcluido', { pedidoId: id });
      // 🔥 ADICIONADO: Avisa o painel do restaurante também para atualizar a lista ao finalizar
      io.emit('atualizarPainelRestaurante');
    }

    res.json(result.rows[0])

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao concluir entrega" })
  }
}

// Rota para o restaurante alterar status manualmente (caso precise arquivar)
exports.atualizarStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const result = await pool.query(
      `UPDATE pedidos 
       SET status = $1 
       WHERE id = $2 
       RETURNING *`,
      [status, id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Pedido não encontrado" })
    }

    // 🔥 ADICIONADO: Avisa o painel se houver alguma mudança manual de status
    const io = req.app.get('socketio');
    if (io) {
      io.emit('atualizarPainelRestaurante');
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar status do pedido" })
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

exports.atualizarLocalizacao = async (req, res) => {
  const { id } = req.params;
  const { latitude, longitude } = req.body;

  try {
    const io = req.app.get('socketio');

    io.to(`pedido_${id}`).emit("localizacaoAtualizada", {
      pedidoId: id,
      latitude,
      longitude
    });

    res.status(200).json({ message: "Localização repassada para o cliente com sucesso!" });
  } catch (error) {
    console.error("Erro ao atualizar localização:", error);
    res.status(500).json({ error: "Erro interno ao atualizar localização" });
  }
}