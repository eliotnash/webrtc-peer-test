const $ = id => document.getElementById(id)
const peerId = crypto.randomUUID()
const rtcConfig = { iceServers: [{ urls: 'stun:stun.qq.com:3478' }, { urls: 'stun:stun.miwifi.com:3478' }] }
let ws, pc, channel, remotePeer, remoteType, localStream
let pendingRemoteCandidates = []
let localCandidates = []
let remoteCandidates = []
let selectedPair = null
let logEntries = []
let lang = localStorage.getItem('webrtc-language') || (navigator.language.startsWith('zh') ? 'zh' : 'en')

const text = {
  zh: {
    title:'端到端连接测试', subtitle:'数据消息、摄像头与屏幕共享', secure:'安全连接',
    roomPlaceholder:'创建时无需输入；进入时填写房间号', createRoom:'创建房间', joinRoom:'进入房间',
    signaling:'信令', remoteDevice:'远端设备', route:'连接路径', mediaChannel:'媒体通道',
    local:'本地', remote:'远端', shareCamera:'共享摄像头', shareScreen:'共享屏幕', stopSharing:'停止共享',
    dataChannel:'数据通道', messagePlaceholder:'输入测试消息', send:'发送', connectionLog:'连接过程日志',
    clear:'清空', cliTitle:'命令行客户端', cliDescription:'下载对应系统版本，通过创建或进入命令加入测试。自签名证书可使用 --ca-cert。',
    downloadCert:'下载证书', candidatesTitle:'ICE 候选地址', localCandidates:'本地候选', remoteCandidates:'远端候选',
    selectedCandidatePair:'最终选择的候选对', noCandidates:'尚未发现', noSelectedPair:'尚未选择',
    disconnected:'未连接', connecting:'连接中', connected:'已连接', waiting:'等待加入', left:'已离开',
    notEstablished:'未建立', preparing:'准备连接', pending:'待检测', cli:'命令行客户端', browser:'浏览器客户端',
    direct:'P2P 直连', me:'我：', other:'对方：', enterRoom:'请输入要进入的房间号',
    connectingLog:'正在连接信令服务器', signalConnected:'信令服务器连接成功', signalClosed:'信令连接已断开',
    signalError:'信令连接发生错误', roomCreated:'已创建房间：{room}', joinedRoom:'已进入房间：{room}',
    joinedWaiting:'等待另一台设备进入房间', remoteJoinedCli:'远端命令行客户端已进入', remoteJoinedBrowser:'远端浏览器客户端已进入',
    remoteLeft:'远端设备已离开', peerCreated:'已创建 WebRTC 连接', dataOpen:'数据通道已打开，可以发送消息',
    dataClosed:'数据通道已关闭', dataNotOpen:'数据通道尚未打开', received:'收到消息：{text}', sent:'发送消息：{text}',
    mediaCli:'命令行客户端不支持媒体通道', waitPeer:'请等待远端设备进入', mediaStopped:'本地媒体共享已停止',
    cameraStarted:'摄像头共享已启动', screenStarted:'屏幕共享已启动', mediaFailed:'媒体共享失败：{error}',
    remoteMediaStopped:'远端已停止媒体共享', localCandidateLog:'本地 ICE 候选：{candidate}',
    remoteCandidateLog:'远端 ICE 候选：{candidate}', selectedPairLog:'最终候选对：本地 {local} ⇄ 远端 {remote}',
    loaded:'页面已加载，请创建或进入测试房间', error_ROOM_FULL:'房间已有两台设备', error_ROOM_REQUIRED:'房间号不能为空',
    error_INVALID_MESSAGE:'消息格式无效', rtc_new:'新建', rtc_connecting:'连接中', rtc_connected:'已连接',
    rtc_disconnected:'已断开', rtc_failed:'失败', rtc_closed:'已关闭'
  },
  en: {
    title:'Peer-to-Peer Connection Test', subtitle:'Data messages, camera, and screen sharing', secure:'Secure connection',
    roomPlaceholder:'No input to create; enter a room ID to join', createRoom:'Create Room', joinRoom:'Enter Room',
    signaling:'Signaling', remoteDevice:'Remote device', route:'Connection route', mediaChannel:'Media channel',
    local:'Local', remote:'Remote', shareCamera:'Share camera', shareScreen:'Share screen', stopSharing:'Stop sharing',
    dataChannel:'Data channel', messagePlaceholder:'Enter a test message', send:'Send', connectionLog:'Connection log',
    clear:'Clear', cliTitle:'Command-line client', cliDescription:'Download a build and create or enter a room from the CLI. Use --ca-cert with a self-signed certificate.',
    downloadCert:'Download certificate', candidatesTitle:'ICE candidate addresses', localCandidates:'Local candidates',
    remoteCandidates:'Remote candidates', selectedCandidatePair:'Selected candidate pair', noCandidates:'None discovered',
    noSelectedPair:'Not selected', disconnected:'Disconnected', connecting:'Connecting', connected:'Connected',
    waiting:'Waiting', left:'Left', notEstablished:'Not established', preparing:'Preparing', pending:'Pending',
    cli:'CLI client', browser:'Browser client', direct:'P2P direct', me:'Me: ', other:'Peer: ',
    enterRoom:'Enter the room ID to join', connectingLog:'Connecting to signaling server', signalConnected:'Signaling server connected',
    signalClosed:'Signaling connection closed', signalError:'Signaling connection error', roomCreated:'Room created: {room}',
    joinedRoom:'Entered room: {room}', joinedWaiting:'Waiting for another device to enter the room',
    remoteJoinedCli:'Remote CLI client entered', remoteJoinedBrowser:'Remote browser client entered',
    remoteLeft:'Remote device left', peerCreated:'WebRTC connection created', dataOpen:'Data channel is open; messages can be sent',
    dataClosed:'Data channel closed', dataNotOpen:'Data channel is not open', received:'Message received: {text}',
    sent:'Message sent: {text}', mediaCli:'The CLI client does not support media', waitPeer:'Wait for a remote device to enter',
    mediaStopped:'Local media sharing stopped', cameraStarted:'Camera sharing started', screenStarted:'Screen sharing started',
    mediaFailed:'Media sharing failed: {error}', remoteMediaStopped:'Remote media sharing stopped',
    localCandidateLog:'Local ICE candidate: {candidate}', remoteCandidateLog:'Remote ICE candidate: {candidate}',
    selectedPairLog:'Selected pair: local {local} ⇄ remote {remote}', loaded:'Page loaded; create or enter a test room',
    error_ROOM_FULL:'The room already has two devices', error_ROOM_REQUIRED:'A room ID is required',
    error_INVALID_MESSAGE:'Invalid message format', rtc_new:'New', rtc_connecting:'Connecting', rtc_connected:'Connected',
    rtc_disconnected:'Disconnected', rtc_failed:'Failed', rtc_closed:'Closed'
  }
}

function t(key, vars={}) {
  return Object.entries(vars).reduce((value,[name,replacement]) => value.replace(`{${name}}`,replacement), text[lang][key] || key)
}
function renderLogs() {
  $('log').textContent = logEntries.map(entry => `[${entry.time}] ${entry.raw || t(entry.key,entry.vars)}`).join('\n') + (logEntries.length ? '\n' : '')
  $('log').scrollTop = $('log').scrollHeight
}
function log(key, vars={}) { logEntries.push({key,vars,time:new Date().toLocaleTimeString()});renderLogs() }
function logRaw(raw) { logEntries.push({raw,time:new Date().toLocaleTimeString()});renderLogs() }
function status(id,key) { const el=$(id);el.dataset.statusKey=key;el.textContent=t(key) }
function renderCandidates() {
  $('localCandidates').textContent = localCandidates.length ? localCandidates.join('\n') : t('noCandidates')
  $('remoteCandidates').textContent = remoteCandidates.length ? remoteCandidates.join('\n') : t('noCandidates')
  $('selectedPair').textContent = selectedPair ? `${t('local')}: ${selectedPair.local}\n${t('remote')}: ${selectedPair.remote}` : t('noSelectedPair')
}
function applyLanguage() {
  document.documentElement.lang=lang==='zh'?'zh-CN':'en'
  document.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=t(el.dataset.i18n)})
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{el.placeholder=t(el.dataset.i18nPlaceholder)})
  document.querySelectorAll('[data-status-key]').forEach(el=>{el.textContent=t(el.dataset.statusKey)})
  $('languageBtn').textContent=lang==='zh'?'English':'中文'
  $('cliCreateCommand').textContent=`webrtc-test --server wss://${location.host}/ws --create-room --ca-cert server.crt`
  $('cliJoinCommand').textContent=`webrtc-test --server wss://${location.host}/ws --join-room ROOM_ID --ca-cert server.crt`
  renderCandidates();renderLogs()
}
function signal(payload){if(ws?.readyState===1&&remotePeer)ws.send(JSON.stringify({type:'signal',target:remotePeer,payload}))}
function resetCandidates(){localCandidates=[];remoteCandidates=[];selectedPair=null;renderCandidates()}

function connect(mode,roomId=''){
  if(mode==='join'&&!roomId)return log('enterRoom')
  let roomAnnounced=false
  ws?.close();closePeer();resetCandidates()
  ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`)
  status('signalStatus','connecting');log('connectingLog')
  ws.onopen=()=>{
    status('signalStatus','connected');log('signalConnected')
    ws.send(JSON.stringify({type:mode,roomId,peerId,clientType:'browser'}))
  }
  ws.onmessage=async event=>{
    const data=JSON.parse(event.data)
    if(data.type==='error')return log(text[lang]['error_'+data.code]?'error_'+data.code:'signalError')
    if(data.type==='peer-left'){remotePeer=null;status('peerStatus','left');log('remoteLeft');closePeer();return}
    if(data.type==='room-state'){
      $('roomInput').value=data.roomId;history.replaceState(null,'',`?room=${data.roomId}`)
      if(!roomAnnounced){log(mode==='create'?'roomCreated':'joinedRoom',{room:data.roomId});roomAnnounced=true}
      const other=data.peers.find(peer=>peer.peerId!==peerId)
      if(!other){status('peerStatus','waiting');log('joinedWaiting');return}
      const changed=remotePeer!==other.peerId;remotePeer=other.peerId;remoteType=other.clientType
      status('peerStatus',other.clientType==='cli'?'cli':'browser')
      if(changed)log(other.clientType==='cli'?'remoteJoinedCli':'remoteJoinedBrowser')
      if(changed&&peerId.localeCompare(remotePeer)<0)await makeOffer()
      return
    }
    if(data.type==='signal')await handleSignal(data.payload)
  }
  ws.onclose=()=>{status('signalStatus','disconnected');log('signalClosed')}
  ws.onerror=()=>log('signalError')
}
function candidateText(candidate){
  if(!candidate)return 'unknown'
  if(typeof candidate==='string')return candidate
  return candidate.candidate||[candidate.type,candidate.address,candidate.port,candidate.protocol].filter(Boolean).join(' ')
}
function addCandidate(list,candidate,key){
  const value=candidateText(candidate)
  if(!list.includes(value)){list.push(value);log(key,{candidate:value});renderCandidates()}
}
function ensurePeer(){
  if(pc)return pc
  pc=new RTCPeerConnection(rtcConfig);status('rtcStatus','preparing');log('peerCreated')
  pc.onicecandidate=event=>{if(event.candidate){addCandidate(localCandidates,event.candidate,'localCandidateLog');signal({candidate:event.candidate})}}
  pc.onconnectionstatechange=()=>{status('rtcStatus','rtc_'+pc.connectionState);if(pc.connectionState==='connected')inspectRoute()}
  pc.ontrack=event=>{const stream=event.streams[0];$('remoteVideo').srcObject=stream;event.track.onmute=()=>{$('remoteVideo').srcObject=null};event.track.onunmute=()=>{$('remoteVideo').srcObject=stream};event.track.onended=()=>{$('remoteVideo').srcObject=null}}
  pc.ondatachannel=event=>setupChannel(event.channel)
  return pc
}
function setupChannel(dc){
  channel=dc;channel.onopen=()=>log('dataOpen');channel.onclose=()=>log('dataClosed')
  channel.onmessage=event=>{log('received',{text:event.data});addMessage(event.data,false)}
}
async function makeOffer(){
  const peer=ensurePeer()
  if(!channel)setupChannel(peer.createDataChannel('messages'))
  const offer=await peer.createOffer();await peer.setLocalDescription(offer);signal({description:peer.localDescription})
}
async function handleSignal(payload){
  const peer=ensurePeer()
  if(payload.mediaStopped){$('remoteVideo').srcObject=null;log('remoteMediaStopped');return}
  if(payload.description){
    await peer.setRemoteDescription(payload.description)
    for(const candidate of pendingRemoteCandidates)await peer.addIceCandidate(candidate)
    pendingRemoteCandidates=[]
    if(payload.description.type==='offer'){const answer=await peer.createAnswer();await peer.setLocalDescription(answer);signal({description:peer.localDescription})}
  }else if(payload.candidate){
    addCandidate(remoteCandidates,payload.candidate,'remoteCandidateLog')
    if(peer.remoteDescription)await peer.addIceCandidate(payload.candidate);else pendingRemoteCandidates.push(payload.candidate)
  }
}
async function share(kind){
  if(remoteType==='cli')return log('mediaCli')
  if(!remotePeer)return log('waitPeer')
  stopMedia(false)
  try{
    localStream=kind==='camera'?await navigator.mediaDevices.getUserMedia({video:true,audio:true}):await navigator.mediaDevices.getDisplayMedia({video:true,audio:true})
    $('localVideo').srcObject=localStream
    const peer=ensurePeer();localStream.getTracks().forEach(track=>peer.addTrack(track,localStream))
    localStream.getVideoTracks()[0].onended=()=>stopMedia(true)
    log(kind==='camera'?'cameraStarted':'screenStarted');await makeOffer()
  }catch(error){log('mediaFailed',{error:error.message})}
}
function stopMedia(notify=true){
  if(!localStream)return
  const tracks=localStream.getTracks()
  if(pc)pc.getSenders().filter(sender=>tracks.includes(sender.track)).forEach(sender=>sender.replaceTrack(null))
  tracks.forEach(track=>track.stop());localStream=null;$('localVideo').srcObject=null
  if(notify)signal({mediaStopped:true});log('mediaStopped')
}
function closePeer(){
  if(pc)pc.close();pc=null;channel=null;pendingRemoteCandidates=[];$('remoteVideo').srcObject=null
  status('rtcStatus','notEstablished');status('routeStatus','pending')
}
function statsCandidate(candidate){
  if(!candidate)return 'unknown'
  return `${candidate.candidateType||'?'} ${candidate.address||candidate.ip||'?'}:${candidate.port||'?'} ${candidate.protocol||'?'}`
}
async function inspectRoute(){
  await new Promise(resolve=>setTimeout(resolve,500))
  const stats=await pc.getStats();let pair
  stats.forEach(report=>{if(report.type==='candidate-pair'&&report.state==='succeeded'&&report.nominated)pair=report})
  if(!pair)return
  const local=stats.get(pair.localCandidateId),remote=stats.get(pair.remoteCandidateId)
  selectedPair={local:statsCandidate(local),remote:statsCandidate(remote)}
  status('routeStatus','direct');log('selectedPairLog',selectedPair);renderCandidates()
}
function addMessage(message,self=true){
  const el=document.createElement('div');el.className='message'+(self?' self':'')
  el.textContent=t(self?'me':'other')+message;$('messages').append(el);$('messages').scrollTop=$('messages').scrollHeight
}

$('languageBtn').onclick=()=>{lang=lang==='zh'?'en':'zh';localStorage.setItem('webrtc-language',lang);applyLanguage()}
$('createBtn').onclick=()=>connect('create')
$('joinBtn').onclick=()=>connect('join',$('roomInput').value.trim().toUpperCase())
$('cameraBtn').onclick=()=>share('camera');$('screenBtn').onclick=()=>share('screen');$('stopMediaBtn').onclick=()=>stopMedia(true)
$('sendBtn').onclick=()=>{const message=$('messageInput').value.trim();if(!message)return;if(channel?.readyState!=='open')return log('dataNotOpen');channel.send(message);addMessage(message);log('sent',{text:message});$('messageInput').value=''}
$('messageInput').onkeydown=event=>{if(event.key==='Enter')$('sendBtn').click()}
$('clearLogBtn').onclick=()=>{logEntries=[];renderLogs()}
applyLanguage()
const initial=new URLSearchParams(location.search).get('room')
if(initial){$('roomInput').value=initial;connect('join',initial.toUpperCase())}
log('loaded')
