require('dotenv').config()

const pool = require('./config/db')
const express = require('express')
const cors = require('cors')
const http = require('http')
const { Server } = require('socket.io')
const path = require('path')

const authRoutes = require('./routes/authRoutes')
const pedidosRoutes = require('./routes/pedidosRoutes')

const app = express()

const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: "*"
  }
})

// ADICIONADO: Empresta o motor do Socket.IO para os controllers usarem
app.set('socketio', io)

app.use(cors())
app.use(express.json())

app.use(authRoutes)
app.use(pedidosRoutes)

io.on('connection', (socket) => {
  console.log("CLIENTE CONECTADO:", socket.id)

  // CLIENTE ENTRA NA SALA DO PEDIDO
  socket.on("entrarPedido", (pedidoId) => {
    socket.join(`pedido_${pedidoId}`)
    console.log(`Socket ${socket.id} entrou na sala pedido_${pedidoId}`)
  })

  // RECEBE LOCALIZAÇÃO (Caso seja enviado via socket direto)
  socket.on("localizacao", (data) => {
    console.log("LOCALIZAÇÃO RECEBIDA VIA SOCKET:", data)
    io.to(`pedido_${data.pedidoId}`).emit("localizacaoAtualizada", data)
  })

  // CLIENTE TRACKING ENTRA PELO TOKEN
  socket.on("entrarPedidoTracking", async (token) => {
    const result = await pool.query(
      "SELECT id FROM pedidos WHERE tracking_token = $1",
      [token]
    )

    if (result.rows.length === 0) {
      return
    }

    const pedidoId = result.rows[0].id

    socket.join(`pedido_${pedidoId}`)
    console.log(`Tracking conectado no pedido ${pedidoId}`)
  })

// STATUS DO PEDIDO (Agora salvando de verdade no banco de dados!)
  socket.on("statusPedido", async (data) => {
    console.log("STATUS RECEBIDO VIA SOCKET:", data)
    
    try {
      // Atualiza o status do pedido de verdade no banco de dados Postgres
      await pool.query(
        "UPDATE pedidos SET status = $1 WHERE id = $2",
        [data.status, data.pedidoId]
      )
      
      // Avisa todas as pontas (Restaurante, Motoboy, Cliente) sobre a mudança em tempo real
      io.to(`pedido_${data.pedidoId}`).emit("statusAtualizado", data)
      
      // Opcional: Se quiser que a lista global atualize para outros terminais abertos
      io.emit("statusAtualizado", data)
    } catch (error) {
      console.error("Erro ao atualizar status do pedido via Socket:", error)
    }
  })
  socket.on('disconnect', () => {
    console.log("CLIENTE DESCONECTADO:", socket.id)
  })
})

// HEALTH CHECK
app.get('/health', (req, res) => {
  res.json({
    status: "API funcionando"
  })
})

// SERVIDOR
server.listen(3000, '0.0.0.0', () => {
  console.log("Servidor rodando com Socket.IO")
})