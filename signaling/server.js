const https = require('https')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const express = require('express')
const { WebSocketServer, WebSocket } = require('ws')

const PORT = Number(process.env.PORT || 10443)
const CERT_FILE = process.env.TLS_CERT || path.join(__dirname, 'certs', 'server.crt')
const KEY_FILE = process.env.TLS_KEY || path.join(__dirname, 'certs', 'server.key')
const app = express()
app.use(express.static(path.join(__dirname, 'public')))
app.get('/health', (_req, res) => res.json({ ok: true }))
app.get('/server.crt', (_req, res) => res.download(CERT_FILE, 'webrtc-test-server.crt'))

const server = https.createServer({ cert: fs.readFileSync(CERT_FILE), key: fs.readFileSync(KEY_FILE) }, app)
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 1024 * 1024 })
const rooms = new Map()

function send(ws, message) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message))
}

function peers(room) {
  return [...room.values()].map(p => ({ peerId: p.peerId, clientType: p.clientType }))
}

function leave(ws) {
  if (!ws.roomId || !rooms.has(ws.roomId)) return
  const room = rooms.get(ws.roomId)
  room.delete(ws.peerId)
  for (const peer of room.values()) send(peer.ws, { type: 'peer-left', peerId: ws.peerId })
  if (!room.size) rooms.delete(ws.roomId)
}

wss.on('connection', ws => {
  ws.on('message', raw => {
    let data
    try { data = JSON.parse(raw.toString()) } catch { return send(ws, { type: 'error', message: '消息格式无效' }) }

    if (data.type === 'join') {
      leave(ws)
      const roomId = String(data.roomId || '').trim().toUpperCase().slice(0, 24)
      const peerId = String(data.peerId || crypto.randomUUID()).slice(0, 64)
      if (!roomId) return send(ws, { type: 'error', message: '房间号不能为空' })
      const room = rooms.get(roomId) || new Map()
      if (room.size >= 2 && !room.has(peerId)) return send(ws, { type: 'error', message: '房间已有两台设备' })
      ws.roomId = roomId
      ws.peerId = peerId
      room.set(peerId, { ws, peerId, clientType: data.clientType === 'cli' ? 'cli' : 'browser' })
      rooms.set(roomId, room)
      for (const peer of room.values()) send(peer.ws, { type: 'room-state', roomId, selfId: peer.peerId, peers: peers(room) })
      return
    }

    if (data.type === 'signal' && ws.roomId) {
      const room = rooms.get(ws.roomId)
      const target = room && room.get(data.target)
      if (target) send(target.ws, { type: 'signal', source: ws.peerId, payload: data.payload })
    }
  })
  ws.on('close', () => leave(ws))
})

server.listen(PORT, '0.0.0.0', () => console.log(`WebRTC test server listening on https://0.0.0.0:${PORT}`))
