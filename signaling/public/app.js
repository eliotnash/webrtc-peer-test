const $ = id => document.getElementById(id)
const peerId = crypto.randomUUID()
const rtcConfig = { iceServers: [{ urls: 'stun:stun.qq.com:3478' }, { urls: 'stun:stun.miwifi.com:3478' }] }
let ws, pc, channel, remotePeer, remoteType, localStream
let lang = localStorage.getItem('webrtc-language') || (navigator.language.startsWith('zh') ? 'zh' : 'en')

const text = {
  zh: {
    title:'端到端连接测试', subtitle:'数据消息、摄像头与屏幕共享', secure:'安全连接',
    roomPlaceholder:'输入房间号（留空则自动生成）', createRoom:'创建/进入房间', joinRoom:'加入房间',
    signaling:'信令', remoteDevice:'远端设备', route:'连接路径', mediaChannel:'媒体通道',
    local:'本地', remote:'远端', shareCamera:'共享摄像头', shareScreen:'共享屏幕', stopSharing:'停止共享',
    dataChannel:'数据通道', messagePlaceholder:'输入测试消息', send:'发送', connectionLog:'连接过程日志',
    clear:'清空', cliTitle:'命令行客户端', cliDescription:'下载对应系统版本，使用房间号加入测试。自签名证书需要增加 --insecure。',
    downloadCert:'下载证书', disconnected:'未连接', connecting:'连接中', connected:'已连接', waiting:'等待加入',
    left:'已离开', notEstablished:'未建立', preparing:'准备连接', pending:'待检测', cli:'命令行客户端',
    browser:'浏览器客户端', direct:'P2P 直连', relay:'TURN 中继', me:'我：', other:'对方：',
    enterRoom:'请输入房间号', connectingLog:'正在连接信令服务器，房间：{room}', signalConnected:'信令服务器连接成功',
    signalClosed:'信令连接已断开', signalError:'信令连接发生错误', joinedWaiting:'已加入房间，等待另一台设备',
    remoteJoined:'远端设备已加入：{type}', remoteLeft:'远端设备已离开', peerCreated:'已创建 WebRTC 连接',
    dataOpen:'数据通道已打开，可以发送消息', dataClosed:'数据通道已关闭', dataNotOpen:'数据通道尚未打开',
    received:'收到消息：{text}', sent:'发送消息：{text}', mediaCli:'命令行客户端不支持媒体通道',
    waitPeer:'请等待远端设备加入', mediaStopped:'本地媒体共享已停止', cameraStarted:'摄像头共享已启动',
    screenStarted:'屏幕共享已启动', mediaFailed:'媒体共享失败：{error}', loaded:'页面已加载，请创建或加入测试房间'
  },
  en: {
    title:'Peer-to-Peer Connection Test', subtitle:'Data messages, camera, and screen sharing', secure:'Secure connection',
    roomPlaceholder:'Enter a room ID (leave blank to generate)', createRoom:'Create / Enter Room', joinRoom:'Join Room',
    signaling:'Signaling', remoteDevice:'Remote device', route:'Connection route', mediaChannel:'Media channel',
    local:'Local', remote:'Remote', shareCamera:'Share camera', shareScreen:'Share screen', stopSharing:'Stop sharing',
    dataChannel:'Data channel', messagePlaceholder:'Enter a test message', send:'Send', connectionLog:'Connection log',
    clear:'Clear', cliTitle:'Command-line client', cliDescription:'Download the build for your system and join with a room ID. Add --insecure for a self-signed certificate.',
    downloadCert:'Download certificate', disconnected:'Disconnected', connecting:'Connecting', connected:'Connected',
    waiting:'Waiting', left:'Left', notEstablished:'Not established', preparing:'Preparing', pending:'Pending',
    cli:'CLI client', browser:'Browser client', direct:'P2P direct', relay:'TURN relay', me:'Me: ', other:'Peer: ',
    enterRoom:'Enter a room ID', connectingLog:'Connecting to signaling server, room: {room}', signalConnected:'Signaling server connected',
    signalClosed:'Signaling connection closed', signalError:'Signaling connection error', joinedWaiting:'Joined room; waiting for another peer',
    remoteJoined:'Remote device joined: {type}', remoteLeft:'Remote device left', peerCreated:'WebRTC connection created',
    dataOpen:'Data channel is open; messages can be sent', dataClosed:'Data channel closed', dataNotOpen:'Data channel is not open',
    received:'Message received: {text}', sent:'Message sent: {text}', mediaCli:'The CLI client does not support media',
    waitPeer:'Wait for a remote device to join', mediaStopped:'Local media sharing stopped', cameraStarted:'Camera sharing started',
    screenStarted:'Screen sharing started', mediaFailed:'Media sharing failed: {error}', loaded:'Page loaded; create or join a test room'
  }
}

const t = (key, vars={}) => Object.entries(vars).reduce((value,[name,replacement]) => value.replace(`{${name}}`,replacement), text[lang][key] || key)
function applyLanguage() {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n) })
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder) })
  $('languageBtn').textContent = lang === 'zh' ? 'English' : '中文'
  $('cliCommand').textContent = `webrtc-test --server wss://${location.host}/ws --room ${lang === 'zh' ? '房间号' : 'ROOM_ID'} --insecure`
}
function log(message) { $('log').textContent += `[${new Date().toLocaleTimeString()}] ${message}\n`; $('log').scrollTop = $('log').scrollHeight }
function status(id, value) { $(id).textContent = value }
function signal(payload) { if (ws?.readyState === 1 && remotePeer) ws.send(JSON.stringify({ type:'signal', target:remotePeer, payload })) }

function connect(roomId) {
  if (!roomId) return log(t('enterRoom'))
  ws?.close()
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`)
  status('signalStatus', t('connecting')); log(t('connectingLog',{room:roomId}))
  ws.onopen = () => { status('signalStatus',t('connected')); log(t('signalConnected')); ws.send(JSON.stringify({type:'join',roomId,peerId,clientType:'browser'})); history.replaceState(null,'',`?room=${roomId}`) }
  ws.onmessage = async event => {
    const data=JSON.parse(event.data)
    if(data.type==='error') return log(data.message)
    if(data.type==='peer-left'){remotePeer=null;status('peerStatus',t('left'));log(t('remoteLeft'));closePeer();return}
    if(data.type==='room-state'){
      const other=data.peers.find(p=>p.peerId!==peerId)
      if(!other){status('peerStatus',t('waiting'));log(t('joinedWaiting'));return}
      const changed=remotePeer!==other.peerId;remotePeer=other.peerId;remoteType=other.clientType
      const type=t(other.clientType==='cli'?'cli':'browser');status('peerStatus',type);log(t('remoteJoined',{type}))
      if(changed&&peerId.localeCompare(remotePeer)<0) await makeOffer()
      return
    }
    if(data.type==='signal') await handleSignal(data.payload)
  }
  ws.onclose=()=>{status('signalStatus',t('disconnected'));log(t('signalClosed'))}
  ws.onerror=()=>log(t('signalError'))
}
function ensurePeer(){
  if(pc)return pc
  pc=new RTCPeerConnection(rtcConfig);status('rtcStatus',t('preparing'));log(t('peerCreated'))
  pc.onicecandidate=e=>{if(e.candidate)signal({candidate:e.candidate})}
  pc.onconnectionstatechange=()=>{status('rtcStatus',pc.connectionState);if(pc.connectionState==='connected')inspectRoute()}
  pc.ontrack=e=>{$('remoteVideo').srcObject=e.streams[0]}
  pc.ondatachannel=e=>setupChannel(e.channel)
  return pc
}
function setupChannel(dc){
  channel=dc
  channel.onopen=()=>log(t('dataOpen'))
  channel.onclose=()=>log(t('dataClosed'))
  channel.onmessage=e=>{log(t('received',{text:e.data}));addMessage(e.data,false)}
}
async function makeOffer(){
  const peer=ensurePeer()
  if(!channel)setupChannel(peer.createDataChannel('messages'))
  const offer=await peer.createOffer();await peer.setLocalDescription(offer);signal({description:peer.localDescription})
}
async function handleSignal(payload){
  const peer=ensurePeer()
  if(payload.description){
    await peer.setRemoteDescription(payload.description)
    if(payload.description.type==='offer'){const answer=await peer.createAnswer();await peer.setLocalDescription(answer);signal({description:peer.localDescription})}
  }else if(payload.candidate){try{await peer.addIceCandidate(payload.candidate)}catch(error){log(error.message)}}
}
async function share(kind){
  if(remoteType==='cli')return log(t('mediaCli'))
  if(!remotePeer)return log(t('waitPeer'))
  stopMedia()
  try{
    localStream=kind==='camera'?await navigator.mediaDevices.getUserMedia({video:true,audio:true}):await navigator.mediaDevices.getDisplayMedia({video:true,audio:true})
    $('localVideo').srcObject=localStream
    const peer=ensurePeer();localStream.getTracks().forEach(track=>peer.addTrack(track,localStream))
    localStream.getVideoTracks()[0].onended=stopMedia;log(t(kind==='camera'?'cameraStarted':'screenStarted'));await makeOffer()
  }catch(error){log(t('mediaFailed',{error:error.message}))}
}
function stopMedia(){if(localStream){localStream.getTracks().forEach(track=>track.stop());localStream=null;$('localVideo').srcObject=null;log(t('mediaStopped'))}}
function closePeer(){if(pc)pc.close();pc=null;channel=null;$('remoteVideo').srcObject=null;status('rtcStatus',t('notEstablished'));status('routeStatus',t('pending'))}
async function inspectRoute(){const stats=await pc.getStats();let pair;stats.forEach(r=>{if(r.type==='candidate-pair'&&r.state==='succeeded'&&r.nominated)pair=r});if(!pair)return;const local=stats.get(pair.localCandidateId),remote=stats.get(pair.remoteCandidateId);status('routeStatus',t(local?.candidateType==='relay'||remote?.candidateType==='relay'?'relay':'direct'))}
function addMessage(message,self=true){const el=document.createElement('div');el.className='message'+(self?' self':'');el.textContent=t(self?'me':'other')+message;$('messages').append(el);$('messages').scrollTop=$('messages').scrollHeight}

$('languageBtn').onclick=()=>{lang=lang==='zh'?'en':'zh';localStorage.setItem('webrtc-language',lang);applyLanguage()}
$('createBtn').onclick=()=>{const input=$('roomInput').value.trim().toUpperCase();const room=input||Math.random().toString(36).slice(2,8).toUpperCase();$('roomInput').value=room;connect(room)}
$('joinBtn').onclick=()=>connect($('roomInput').value.trim().toUpperCase())
$('cameraBtn').onclick=()=>share('camera');$('screenBtn').onclick=()=>share('screen');$('stopMediaBtn').onclick=stopMedia
$('sendBtn').onclick=()=>{const message=$('messageInput').value.trim();if(!message)return;if(channel?.readyState!=='open')return log(t('dataNotOpen'));channel.send(message);addMessage(message);log(t('sent',{text:message}));$('messageInput').value=''}
$('messageInput').onkeydown=event=>{if(event.key==='Enter')$('sendBtn').click()}
$('clearLogBtn').onclick=()=>{$('log').textContent=''}
applyLanguage()
const initial=new URLSearchParams(location.search).get('room');if(initial){$('roomInput').value=initial;connect(initial)}
log(t('loaded'))
