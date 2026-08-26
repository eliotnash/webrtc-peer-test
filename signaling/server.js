const https = require('https')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const express = require('express')
const { WebSocketServer, WebSocket } = require('ws')

const PORT = Number(process.env.PORT || 10443)
const CERT_FILE = process.env.TLS_CERT || path.join(__dirname, 'certs', 'server.crt')
const KEY_FILE = process.env.TLS_KEY || path.join(__dirname, 'certs', 'server.key')
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
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
  return [...room.values()].map(peer => ({ peerId: peer.peerId, clientType: peer.clientType }))
}

function createRoomId() {
  do {
    const bytes = crypto.randomBytes(6)
    var roomId = [...bytes].map(byte => ROOM_ALPHABET[byte % ROOM_ALPHABET.length]).join('')
  } while (rooms.has(roomId))
  return roomId
}

function leave(ws) {
  if (!ws.roomId || !rooms.has(ws.roomId)) return
  const room = rooms.get(ws.roomId)
  room.delete(ws.peerId)
  for (const peer of room.values()) send(peer.ws, { type: 'peer-left', peerId: ws.peerId })
  if (!room.size) rooms.delete(ws.roomId)
  ws.roomId = undefined
  ws.peerId = undefined
}

function enterRoom(ws, roomId, peerId, clientType) {
  leave(ws)
  if (!roomId) return send(ws, { type: 'error', code: 'ROOM_REQUIRED', message: 'Room ID is required' })
  const room = rooms.get(roomId) || new Map()
  if (room.size >= 2 && !room.has(peerId)) return send(ws, { type: 'error', code: 'ROOM_FULL', message: 'Room already has two peers' })
  ws.roomId = roomId
  ws.peerId = peerId
  room.set(peerId, { ws, peerId, clientType })
  rooms.set(roomId, room)
  for (const peer of room.values()) send(peer.ws, { type: 'room-state', roomId, selfId: peer.peerId, peers: peers(room) })
}

wss.on('connection', ws => {
  ws.on('message', raw => {
    let data
    try { data = JSON.parse(raw.toString()) } catch {
      return send(ws, { type: 'error', code: 'INVALID_MESSAGE', message: 'Invalid message format' })
    }

    const peerId = String(data.peerId || crypto.randomUUID()).slice(0, 64)
    const clientType = data.clientType === 'cli' ? 'cli' : 'browser'
    if (data.type === 'create') return enterRoom(ws, createRoomId(), peerId, clientType)
    if (data.type === 'join') {
      const roomId = String(data.roomId || '').trim().toUpperCase().slice(0, 24)
      return enterRoom(ws, roomId, peerId, clientType)
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
