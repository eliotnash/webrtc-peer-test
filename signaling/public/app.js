const $ = id => document.getElementById(id)
const peerId = crypto.randomUUID()
const rtcConfig = { iceServers: [{ urls: 'stun:stun.qq.com:3478' }, { urls: 'stun:stun.miwifi.com:3478' }] }
let ws, pc, channel, remotePeer, remoteType, localStream

function log(text) { const line = `[${new Date().toLocaleTimeString()}] ${text}`; $('log').textContent += line + '\n'; $('log').scrollTop = $('log').scrollHeight }
function status(id, text) { $(id).textContent = text }
function signal(payload) { if (ws?.readyState === 1 && remotePeer) ws.send(JSON.stringify({ type:'signal', target:remotePeer, payload })) }

function connect(roomId) {
  if (!roomId) return log('请输入房间号')
  ws?.close()
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws'
  ws = new WebSocket(`${scheme}://${location.host}/ws`)
  status('signalStatus', '连接中')
  log(`正在连接信令服务器，房间：${roomId}`)
  ws.onopen = () => { status('signalStatus','已连接'); log('信令服务器连接成功'); ws.send(JSON.stringify({type:'join',roomId,peerId,clientType:'browser'})); history.replaceState(null,'',`?room=${roomId}`) }
  ws.onmessage = async event => {
    const data = JSON.parse(event.data)
    if (data.type === 'error') return log(`错误：${data.message}`)
    if (data.type === 'peer-left') { remotePeer=null; status('peerStatus','已离开'); log('远端设备已离开'); closePeer(); return }
    if (data.type === 'room-state') {
      const other = data.peers.find(p => p.peerId !== peerId)
      if (!other) { status('peerStatus','等待加入'); log('已加入房间，等待另一台设备'); return }
      const changed = remotePeer !== other.peerId
      remotePeer=other.peerId; remoteType=other.clientType
      status('peerStatus', other.clientType === 'cli' ? '命令行客户端' : '浏览器客户端')
      log(`远端设备已加入：${other.clientType === 'cli' ? '命令行' : '浏览器'}`)
      if (changed && peerId.localeCompare(remotePeer) < 0) await makeOffer()
      return
    }
    if (data.type === 'signal') await handleSignal(data.payload)
  }
  ws.onclose = () => { status('signalStatus','已断开'); log('信令连接已断开') }
  ws.onerror = () => log('信令连接发生错误')
}

function ensurePeer() {
  if (pc) return pc
  pc = new RTCPeerConnection(rtcConfig)
  status('rtcStatus','准备连接'); log('已创建 WebRTC 连接')
  pc.onicecandidate = e => { if (e.candidate) { signal({candidate:e.candidate}); log(`发现本地 ICE 候选：${e.candidate.type || 'candidate'}`) } }
  pc.onconnectionstatechange = () => { status('rtcStatus',pc.connectionState); log(`WebRTC 状态：${pc.connectionState}`); if(pc.connectionState==='connected') inspectRoute() }
  pc.oniceconnectionstatechange = () => log(`ICE 状态：${pc.iceConnectionState}`)
  pc.ontrack = e => { $('remoteVideo').srcObject=e.streams[0]; log('已收到远端媒体通道') }
  pc.ondatachannel = e => setupChannel(e.channel)
  return pc
}

function setupChannel(dc) {
  channel=dc
  channel.onopen=()=>{log('数据通道已打开，可以发送消息'); addMessage('系统：数据通道已连接')}
  channel.onclose=()=>log('数据通道已关闭')
  channel.onmessage=e=>{log(`收到消息：${e.data}`); addMessage(e.data,false)}
}

async function makeOffer() {
  const peer=ensurePeer()
  if(!channel) setupChannel(peer.createDataChannel('messages'))
  const offer=await peer.createOffer(); await peer.setLocalDescription(offer)
  signal({description:peer.localDescription}); log('已发送 SDP Offer')
}

async function handleSignal(payload) {
  const peer=ensurePeer()
  if(payload.description) {
    log(`收到 SDP ${payload.description.type}`)
    await peer.setRemoteDescription(payload.description)
    if(payload.description.type==='offer') { const answer=await peer.createAnswer(); await peer.setLocalDescription(answer); signal({description:peer.localDescription}); log('已发送 SDP Answer') }
  } else if(payload.candidate) { try { await peer.addIceCandidate(payload.candidate); log('已加入远端 ICE 候选') } catch(e) { log(`ICE 候选加入失败：${e.message}`) } }
}

async function share(kind) {
  if(remoteType==='cli') return log('命令行客户端不支持媒体通道')
  if(!remotePeer) return log('请等待远端设备加入')
  stopMedia()
  try {
    localStream = kind==='camera' ? await navigator.mediaDevices.getUserMedia({video:true,audio:true}) : await navigator.mediaDevices.getDisplayMedia({video:true,audio:true})
    $('localVideo').srcObject=localStream
    const peer=ensurePeer(); localStream.getTracks().forEach(track=>peer.addTrack(track,localStream))
    localStream.getVideoTracks()[0].onended=stopMedia
    log(kind==='camera'?'摄像头共享已启动':'屏幕共享已启动')
    await makeOffer()
  } catch(e) { log(`媒体共享失败：${e.message}`) }
}

function stopMedia() { if(localStream){localStream.getTracks().forEach(t=>t.stop());localStream=null;$('localVideo').srcObject=null;log('本地媒体共享已停止')} }
function closePeer(){ if(pc)pc.close();pc=null;channel=null;$('remoteVideo').srcObject=null;status('rtcStatus','未建立');status('routeStatus','待检测') }
async function inspectRoute(){const stats=await pc.getStats();let pair;stats.forEach(r=>{if(r.type==='candidate-pair'&&r.state==='succeeded'&&r.nominated)pair=r});if(!pair)return;const local=stats.get(pair.localCandidateId),remote=stats.get(pair.remoteCandidateId);const relay=local?.candidateType==='relay'||remote?.candidateType==='relay';status('routeStatus',relay?'TURN 中继':'P2P 直连');log(`连接路径：${relay?'TURN 中继':'P2P 直连'}，协议：${local?.protocol||'未知'}`)}
function addMessage(text,self=true){const el=document.createElement('div');el.className='message'+(self?' self':'');el.textContent=(self?'我：':'对方：')+text;$('messages').append(el);$('messages').scrollTop=$('messages').scrollHeight}

$('createBtn').onclick=()=>{const room=Math.random().toString(36).slice(2,8).toUpperCase();$('roomInput').value=room;connect(room)}
$('joinBtn').onclick=()=>connect($('roomInput').value.trim().toUpperCase())
$('cameraBtn').onclick=()=>share('camera'); $('screenBtn').onclick=()=>share('screen'); $('stopMediaBtn').onclick=stopMedia
$('sendBtn').onclick=()=>{const text=$('messageInput').value.trim();if(!text)return;if(channel?.readyState!=='open')return log('数据通道尚未打开');channel.send(text);addMessage(text);log(`发送消息：${text}`);$('messageInput').value=''}
$('messageInput').onkeydown=e=>{if(e.key==='Enter')$('sendBtn').click()}; $('clearLogBtn').onclick=()=>{$('log').textContent=''}
const initial=new URLSearchParams(location.search).get('room');if(initial){$('roomInput').value=initial;connect(initial)}
$('cliCommand').textContent=`webrtc-test --server wss://${location.host}/ws --room 房间号 --insecure`
log('页面已加载，请创建或加入测试房间')
