const $ = id => document.getElementById(id)
const peerId = crypto.randomUUID()
const rtcConfig = { iceServers: [{ urls: 'stun:stun.qq.com:3478' }, { urls: 'stun:stun.miwifi.com:3478' }] }
let ws, pc, channel, remotePeer, remoteType, localStream
let pendingRemoteCandidates = []
let localCandidates = []
let remoteCandidates = []
let selectedPair = null
let logEntries = []
let manualLeave = false
let roomState = { inRoom:false, roomId:'', peers:0, exists:null }
let requestedMode = null
let requestedRoomId = ''
let roomAnnounced = false
let lang = localStorage.getItem('webrtc-language') || (navigator.language.startsWith('zh') ? 'zh' : 'en')

const text = {
  zh: {
    title:'端到端连接测试', subtitle:'数据消息、摄像头与屏幕共享', secure:'安全连接',
    roomPlaceholder:'创建时无需输入；进入时填写房间号', createRoom:'创建房间', joinRoom:'进入房间', leaveRoom:'离开房间',
    signaling:'信令', remoteDevice:'远端设备', route:'连接路径', mediaChannel:'媒体通道',
    local:'本地', remote:'远端', shareCamera:'共享摄像头', shareScreen:'共享屏幕', stopSharing:'停止共享',
    dataChannel:'数据通道', messagePlaceholder:'输入测试消息', send:'发送', connectionLog:'连接过程日志',
    clear:'清空', cliTitle:'命令行客户端', cliDescription:'下载对应系统版本。推荐下载并指定服务器证书；临时测试也可跳过证书验证。',
    verifiedCommands:'验证服务器证书（推荐）', verifiedDescription:'先下载 server.crt，再通过 --ca-cert 验证服务器身份。',
    insecureCommands:'跳过证书验证（仅测试）', insecureDescription:'--insecure 会跳过 TLS 身份校验，存在中间人攻击风险。',
    downloadCert:'下载证书', candidatesTitle:'ICE 候选地址', localCandidates:'本地候选', remoteCandidates:'远端候选',
    selectedCandidatePair:'最终选择的候选对', noCandidates:'尚未发现', noSelectedPair:'尚未选择',
    candidateType:'类型', protocol:'协议', address:'地址', port:'端口', side:'端',
    membership:'房间状态', currentRoomId:'当前房间号', participantCount:'房间人数', roomExists:'房间是否存在',
    inRoom:'已进入', outsideRoom:'未进入', yes:'是', no:'否', unknown:'未知',
    hostCandidate:'本地 (Host)', stunCandidate:'STUN (Srflx)', peerReflexive:'对端映射 (Prflx)', relayCandidate:'中继 (Relay)',
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
    iceGatheringState:'ICE 候选收集状态：{state}', iceCandidateError:'STUN 探测失败：{url}，错误 {code}：{error}',
    loaded:'页面已加载，请创建或进入测试房间', leftRoom:'已离开房间', notInRoom:'当前未进入房间',
    alreadyInRoom:'当前已经在房间 {room} 中', requestInProgress:'正在处理上一个房间请求',
    error_ROOM_FULL:'房间已有两台设备', error_ROOM_REQUIRED:'房间号不能为空',
    error_ROOM_NOT_FOUND:'房间不存在，请先创建房间',
    error_INVALID_MESSAGE:'消息格式无效', rtc_new:'新建', rtc_connecting:'连接中', rtc_connected:'已连接',
    rtc_disconnected:'已断开', rtc_failed:'失败', rtc_closed:'已关闭'
  },
  en: {
    title:'Peer-to-Peer Connection Test', subtitle:'Data messages, camera, and screen sharing', secure:'Secure connection',
    roomPlaceholder:'No input to create; enter a room ID to join', createRoom:'Create Room', joinRoom:'Enter Room', leaveRoom:'Leave Room',
    signaling:'Signaling', remoteDevice:'Remote device', route:'Connection route', mediaChannel:'Media channel',
    local:'Local', remote:'Remote', shareCamera:'Share camera', shareScreen:'Share screen', stopSharing:'Stop sharing',
    dataChannel:'Data channel', messagePlaceholder:'Enter a test message', send:'Send', connectionLog:'Connection log',
    clear:'Clear', cliTitle:'Command-line client', cliDescription:'Download a build. Prefer the server certificate; skip verification only for temporary testing.',
    verifiedCommands:'Verify the server certificate (recommended)', verifiedDescription:'Download server.crt first, then use --ca-cert to verify the server identity.',
    insecureCommands:'Skip certificate verification (testing only)', insecureDescription:'--insecure disables TLS identity verification and permits man-in-the-middle attacks.',
    downloadCert:'Download certificate', candidatesTitle:'ICE candidate addresses', localCandidates:'Local candidates',
    remoteCandidates:'Remote candidates', selectedCandidatePair:'Selected candidate pair', noCandidates:'None discovered',
    noSelectedPair:'Not selected', candidateType:'Type', protocol:'Protocol', address:'Address', port:'Port', side:'Side',
    membership:'Room status', currentRoomId:'Current room ID', participantCount:'Participants', roomExists:'Room exists',
    inRoom:'In room', outsideRoom:'Not in room', yes:'Yes', no:'No', unknown:'Unknown',
    hostCandidate:'Local (Host)', stunCandidate:'STUN (Srflx)', peerReflexive:'Peer reflexive (Prflx)', relayCandidate:'Relay',
    disconnected:'Disconnected', connecting:'Connecting', connected:'Connected',
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
    iceGatheringState:'ICE gathering state: {state}', iceCandidateError:'STUN discovery failed: {url}, error {code}: {error}',
    leftRoom:'Left the room', notInRoom:'Not currently in a room',
    alreadyInRoom:'Already in room {room}', requestInProgress:'A room request is already in progress',
    error_ROOM_FULL:'The room already has two devices', error_ROOM_REQUIRED:'A room ID is required',
    error_ROOM_NOT_FOUND:'The room does not exist; create it first',
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
function candidateTypeLabel(type) {
  return t({host:'hostCandidate',srflx:'stunCandidate',prflx:'peerReflexive',relay:'relayCandidate'}[type]||type||'pending')
}
function appendCandidateRow(body,candidate,side) {
  const row=document.createElement('tr')
  const values=side?[t(side),candidateTypeLabel(candidate.type),candidate.protocol,candidate.address,candidate.port]:[candidateTypeLabel(candidate.type),candidate.protocol,candidate.address,candidate.port]
  values.forEach(value=>{const cell=document.createElement('td');cell.textContent=value;row.append(cell)})
  body.append(row)
}
function renderCandidateList(id,list) {
  const body=$(id);body.textContent=''
  if(!list.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=4;cell.textContent=t('noCandidates');row.append(cell);body.append(row);return}
  list.forEach(candidate=>appendCandidateRow(body,candidate))
}
function renderCandidates() {
  renderCandidateList('localCandidates',localCandidates)
  renderCandidateList('remoteCandidates',remoteCandidates)
  const body=$('selectedPair');body.textContent=''
  if(!selectedPair){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=5;cell.textContent=t('noSelectedPair');row.append(cell);body.append(row);return}
  appendCandidateRow(body,selectedPair.local,'local');appendCandidateRow(body,selectedPair.remote,'remote')
}
function renderRoomState() {
  $('membershipStatus').textContent=t(roomState.inRoom?'inRoom':'outsideRoom')
  $('currentRoomId').textContent=roomState.roomId||'—'
  $('participantCount').textContent=String(roomState.peers)
  $('roomExists').textContent=roomState.exists===null?t('unknown'):t(roomState.exists?'yes':'no')
}
function updateRoomState(changes) { roomState={...roomState,...changes};renderRoomState() }
function applyLanguage() {
  document.documentElement.lang=lang==='zh'?'zh-CN':'en'
  document.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=t(el.dataset.i18n)})
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{el.placeholder=t(el.dataset.i18nPlaceholder)})
  document.querySelectorAll('[data-status-key]').forEach(el=>{el.textContent=t(el.dataset.statusKey)})
  $('languageBtn').textContent=lang==='zh'?'English':'中文'
  $('cliCreateCommand').textContent=`webrtc-test --server wss://${location.host}/ws --create-room --ca-cert server.crt`
  $('cliJoinCommand').textContent=`webrtc-test --server wss://${location.host}/ws --join-room ROOM_ID --ca-cert server.crt`
  $('cliCreateInsecureCommand').textContent=`webrtc-test --server wss://${location.host}/ws --create-room --insecure`
  $('cliJoinInsecureCommand').textContent=`webrtc-test --server wss://${location.host}/ws --join-room ROOM_ID --insecure`
  renderCandidates();renderRoomState();renderLogs()
}
function signal(payload){if(ws?.readyState===1&&remotePeer)ws.send(JSON.stringify({type:'signal',target:remotePeer,payload}))}
function resetCandidates(){localCandidates=[];remoteCandidates=[];selectedPair=null;renderCandidates()}

function connect(mode,roomId=''){
  if(mode==='join'&&!roomId)return log('enterRoom')
  if(mode==='join'&&roomState.inRoom&&roomState.roomId===roomId)return log('alreadyInRoom',{room:roomId})
  if(ws?.readyState===WebSocket.CONNECTING)return log('requestInProgress')
  requestedMode=mode;requestedRoomId=roomId;roomAnnounced=false
  manualLeave=false
  if(ws?.readyState===WebSocket.OPEN){
    ws.send(JSON.stringify({type:mode,roomId,peerId,clientType:'browser'}))
    return
  }
  closePeer();resetCandidates()
  ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`)
  status('signalStatus','connecting');log('connectingLog')
  ws.onopen=()=>{
    status('signalStatus','connected');log('signalConnected')
    ws.send(JSON.stringify({type:requestedMode,roomId:requestedRoomId,peerId,clientType:'browser'}))
  }
  ws.onmessage=async event=>{
    const data=JSON.parse(event.data)
    if(data.type==='error'){
      if(!roomState.inRoom&&data.code==='ROOM_NOT_FOUND')updateRoomState({inRoom:false,roomId:requestedRoomId,peers:0,exists:false})
      if(!roomState.inRoom&&data.code==='ROOM_FULL')updateRoomState({inRoom:false,roomId:requestedRoomId,peers:2,exists:true})
      roomAnnounced=true
      return log(text[lang]['error_'+data.code]?'error_'+data.code:'signalError')
    }
    if(data.type==='peer-left'){
      remotePeer=null;remoteType=null
      closePeer();resetCandidates();status('peerStatus','waiting');updateRoomState({inRoom:true,peers:1,exists:true})
      log('remoteLeft');return
    }
    if(data.type==='room-state'){
      const switched=roomState.inRoom&&roomState.roomId!==data.roomId
      if(switched){remotePeer=null;remoteType=null;closePeer();resetCandidates();$('messages').textContent=''}
      $('roomInput').value=data.roomId;history.replaceState(null,'',`?room=${data.roomId}`)
      updateRoomState({inRoom:true,roomId:data.roomId,peers:data.peers.length,exists:true})
      if(!roomAnnounced){log(requestedMode==='create'?'roomCreated':'joinedRoom',{room:data.roomId});roomAnnounced=true}
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
  ws.onclose=()=>{status('signalStatus','disconnected');updateRoomState({inRoom:false,peers:0,exists:null});log(manualLeave?'leftRoom':'signalClosed');manualLeave=false}
  ws.onerror=()=>log('signalError')
}
function parseCandidate(candidate){
  const raw=typeof candidate==='string'?candidate:(candidate?.candidate||'')
  const parts=raw.trim().split(/\s+/),typeIndex=parts.indexOf('typ')
  return {raw,type:typeIndex>=0?parts[typeIndex+1]:(candidate?.type||'?'),protocol:(parts[2]||candidate?.protocol||'?').toUpperCase(),address:parts[4]||candidate?.address||'?',port:parts[5]||candidate?.port||'?'}
}
function addCandidate(list,candidate,key){
  const value=parseCandidate(candidate)
  if(!list.some(item=>item.raw===value.raw)){list.push(value);log(key,{candidate:value.raw});renderCandidates()}
}
function ensurePeer(){
  if(pc)return pc
  pc=new RTCPeerConnection(rtcConfig);status('rtcStatus','preparing');log('peerCreated')
  pc.onicecandidate=event=>{if(event.candidate){addCandidate(localCandidates,event.candidate,'localCandidateLog');signal({candidate:event.candidate})}}
  pc.onicegatheringstatechange=()=>log('iceGatheringState',{state:pc.iceGatheringState})
  pc.onicecandidateerror=event=>log('iceCandidateError',{url:event.url||'unknown',code:String(event.errorCode||'?'),error:event.errorText||'unknown'})
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
function leaveRoom(){
  if(!ws||ws.readyState===WebSocket.CLOSED)return log('notInRoom')
  manualLeave=true
  stopMedia(false)
  ws.close()
  closePeer();remotePeer=null;remoteType=null
  status('peerStatus','waiting');resetCandidates()
  updateRoomState({inRoom:false,roomId:'',peers:0,exists:null})
  $('roomInput').value='';$('messages').textContent=''
  history.replaceState(null,'',location.pathname)
}
function statsCandidate(candidate,list){
  if(!candidate)return {type:'?',protocol:'?',address:'?',port:'?'}
  const protocol=String(candidate.protocol||'?').toUpperCase(),port=String(candidate.port||'?')
  const match=list.find(item=>item.port===port&&item.protocol===protocol)||list.find(item=>item.port===port)
  return {type:candidate.candidateType||match?.type||'?',protocol,address:candidate.address||candidate.ip||match?.address||'?',port}
}
function candidateSummary(candidate){
  return `${candidateTypeLabel(candidate.type)} ${candidate.protocol} ${candidate.address}:${candidate.port}`
}
async function inspectRoute(){
  await new Promise(resolve=>setTimeout(resolve,500))
  const stats=await pc.getStats();let pair
  stats.forEach(report=>{if(report.type==='candidate-pair'&&report.state==='succeeded'&&report.nominated)pair=report})
  if(!pair)return
  const local=stats.get(pair.localCandidateId),remote=stats.get(pair.remoteCandidateId)
  selectedPair={local:statsCandidate(local,localCandidates),remote:statsCandidate(remote,remoteCandidates)}
  status('routeStatus','direct');log('selectedPairLog',{local:candidateSummary(selectedPair.local),remote:candidateSummary(selectedPair.remote)});renderCandidates()
}
function addMessage(message,self=true){
  const el=document.createElement('div');el.className='message'+(self?' self':'')
  el.textContent=t(self?'me':'other')+message;$('messages').append(el);$('messages').scrollTop=$('messages').scrollHeight
}

$('languageBtn').onclick=()=>{lang=lang==='zh'?'en':'zh';localStorage.setItem('webrtc-language',lang);applyLanguage()}
$('createBtn').onclick=()=>connect('create')
$('joinBtn').onclick=()=>connect('join',$('roomInput').value.trim().toUpperCase())
$('leaveBtn').onclick=leaveRoom
$('cameraBtn').onclick=()=>share('camera');$('screenBtn').onclick=()=>share('screen');$('stopMediaBtn').onclick=()=>stopMedia(true)
$('sendBtn').onclick=()=>{const message=$('messageInput').value.trim();if(!message)return;if(channel?.readyState!=='open')return log('dataNotOpen');channel.send(message);addMessage(message);log('sent',{text:message});$('messageInput').value=''}
$('messageInput').onkeydown=event=>{if(event.key==='Enter')$('sendBtn').click()}
$('clearLogBtn').onclick=()=>{logEntries=[];renderLogs()}
applyLanguage()
const initial=new URLSearchParams(location.search).get('room')
if(initial){$('roomInput').value=initial;connect('join',initial.toUpperCase())}
log('loaded')
