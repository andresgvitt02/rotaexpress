const express = require('express')
const cors = require('cors')
const http = require('http')
const { Server } = require('socket.io')

const authRoutes = require('./routes/authRoutes')
const pedidosRoutes = require('./routes/pedidosRoutes')

const app = express()
const server = http.createServer(app)

// SOCKET.IO
const io = new Server(server, {
  cors: {
    origin: "*"
  }
})

app.use(cors())
app.use(express.json())

app.use(authRoutes)
app.use(pedidosRoutes)

io.on('connection', (socket) => {
  console.log("Cliente conectado:", socket.id)

  socket.on("localizacao", (data) => {
    console.log("Localização recebida:", data)

    io.emit("localizacaoAtualizada", data)
  })

  socket.on('disconnect', () => {
    console.log("Cliente desconectado:", socket.id)
  })
})

app.get('/health', (req, res) => {
  res.json({
    status: "API funcionando"
  })
})

// ⚠️ IMPORTANTE: trocar app.listen por server.listen
server.listen(3000, () => {
  console.log("Servidor rodando com Socket.IO 🚀")
})