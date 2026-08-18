package main

import (
	"bufio"
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
	"github.com/pion/webrtc/v4"
)

type envelope struct {
	Type       string          `json:"type"`
	RoomID     string          `json:"roomId,omitempty"`
	PeerID     string          `json:"peerId,omitempty"`
	ClientType string          `json:"clientType,omitempty"`
	SelfID     string          `json:"selfId,omitempty"`
	Target     string          `json:"target,omitempty"`
	Source     string          `json:"source,omitempty"`
	Message    string          `json:"message,omitempty"`
	Peers      []peerInfo      `json:"peers,omitempty"`
	Payload    json.RawMessage `json:"payload,omitempty"`
}
type peerInfo struct { PeerID string `json:"peerId"`; ClientType string `json:"clientType"` }
type signalPayload struct { Description *webrtc.SessionDescription `json:"description,omitempty"`; Candidate *webrtc.ICECandidateInit `json:"candidate,omitempty"` }

var (
	conn *websocket.Conn
	pc *webrtc.PeerConnection
	dc *webrtc.DataChannel
	selfID string
	remoteID string
	writeMu sync.Mutex
	pending []webrtc.ICECandidateInit
)

func logf(format string, args ...any) { fmt.Printf("[%s] %s\n", time.Now().Format("15:04:05"), fmt.Sprintf(format,args...)) }
func randomID() string { b:=make([]byte,8); _,_=rand.Read(b); return hex.EncodeToString(b) }
func send(v any) error { writeMu.Lock(); defer writeMu.Unlock(); return conn.WriteJSON(v) }
func sendSignal(payload signalPayload) { raw,_:=json.Marshal(payload); _=send(envelope{Type:"signal",Target:remoteID,Payload:raw}) }

func ensurePeer() error {
	if pc != nil { return nil }
	var err error
	pc,err=webrtc.NewPeerConnection(webrtc.Configuration{ICEServers:[]webrtc.ICEServer{{URLs:[]string{"stun:stun.qq.com:3478","stun:stun.miwifi.com:3478"}}}})
	if err!=nil{return err}
	logf("已创建 WebRTC 连接")
	pc.OnICECandidate(func(c *webrtc.ICECandidate){if c!=nil { init:=c.ToJSON(); sendSignal(signalPayload{Candidate:&init}); logf("发现本地 ICE 候选：%s",c.Typ.String()) }})
	pc.OnICEConnectionStateChange(func(s webrtc.ICEConnectionState){logf("ICE 状态：%s",s.String())})
	pc.OnConnectionStateChange(func(s webrtc.PeerConnectionState){
		logf("WebRTC 状态：%s",s.String())
		if s==webrtc.PeerConnectionStateConnected { inspectRoute() }
	})
	pc.OnDataChannel(func(ch *webrtc.DataChannel){setupDataChannel(ch)})
	return nil
}

func setupDataChannel(ch *webrtc.DataChannel) {
	dc=ch
	dc.OnOpen(func(){logf("数据通道已打开；输入文字并回车即可发送")})
	dc.OnClose(func(){logf("数据通道已关闭")})
	dc.OnMessage(func(msg webrtc.DataChannelMessage){logf("收到消息：%s",string(msg.Data))})
}

func makeOffer() error {
	if err:=ensurePeer();err!=nil{return err}
	if dc==nil { ch,err:=pc.CreateDataChannel("messages",nil);if err!=nil{return err};setupDataChannel(ch) }
	offer,err:=pc.CreateOffer(nil);if err!=nil{return err}
	if err=pc.SetLocalDescription(offer);err!=nil{return err}
	sendSignal(signalPayload{Description:pc.LocalDescription()});logf("已发送 SDP Offer");return nil
}

func handleSignal(raw json.RawMessage) error {
	if err:=ensurePeer();err!=nil{return err}
	var p signalPayload;if err:=json.Unmarshal(raw,&p);err!=nil{return err}
	if p.Description!=nil {
		logf("收到 SDP %s",p.Description.Type.String())
		if err:=pc.SetRemoteDescription(*p.Description);err!=nil{return err}
		for _,c:=range pending {_=pc.AddICECandidate(c)};pending=nil
		if p.Description.Type==webrtc.SDPTypeOffer { answer,err:=pc.CreateAnswer(nil);if err!=nil{return err};if err=pc.SetLocalDescription(answer);err!=nil{return err};sendSignal(signalPayload{Description:pc.LocalDescription()});logf("已发送 SDP Answer") }
	}
	if p.Candidate!=nil {
		if pc.RemoteDescription()==nil {pending=append(pending,*p.Candidate)} else if err:=pc.AddICECandidate(*p.Candidate);err!=nil{return err}
		logf("已加入远端 ICE 候选")
	}
	return nil
}

func inspectRoute(){
	time.Sleep(500*time.Millisecond)
	reports:=pc.GetStats()
	for _,r:=range reports { if pair,ok:=r.(webrtc.ICECandidatePairStats);ok && pair.Nominated && pair.State==webrtc.StatsICECandidatePairStateSucceeded { local,_:=reports[pair.LocalCandidateID].(webrtc.ICECandidateStats);remote,_:=reports[pair.RemoteCandidateID].(webrtc.ICECandidateStats);route:="P2P 直连";if local.CandidateType==webrtc.ICECandidateTypeRelay||remote.CandidateType==webrtc.ICECandidateTypeRelay{route="TURN 中继"};logf("连接路径：%s，协议：%s",route,local.Protocol);return } }
}

func main(){
	server:=flag.String("server","","信令服务器地址，例如 wss://example.com/ws")
	room:=flag.String("room","","房间号")
	insecure:=flag.Bool("insecure",false,"允许自签名证书")
	flag.Parse()
	if *server=="" {fmt.Fprintln(os.Stderr,"请使用 --server 指定信令服务器地址");os.Exit(2)}
	if *room=="" {fmt.Fprintln(os.Stderr,"请使用 --room 指定房间号");os.Exit(2)}
	selfID=randomID()
	dialer:=websocket.Dialer{TLSClientConfig:&tls.Config{InsecureSkipVerify:*insecure}}
	var err error;conn,_,err=dialer.Dial(*server,http.Header{});if err!=nil{logf("连接信令服务器失败：%v",err);os.Exit(1)};defer conn.Close()
	logf("信令服务器连接成功")
	_ = send(envelope{Type:"join",RoomID:strings.ToUpper(*room),PeerID:selfID,ClientType:"cli"})
	go func(){
		for {var msg envelope;if err:=conn.ReadJSON(&msg);err!=nil{logf("信令连接已断开：%v",err);return}
			switch msg.Type {
			case "error":logf("错误：%s",msg.Message)
			case "peer-left":remoteID="";logf("远端设备已离开")
			case "room-state":
				var other *peerInfo;for i:=range msg.Peers{if msg.Peers[i].PeerID!=selfID{other=&msg.Peers[i];break}}
				if other==nil{logf("已加入房间 %s，等待另一台设备",msg.RoomID);continue}
				changed:=remoteID!=other.PeerID;remoteID=other.PeerID;logf("远端设备已加入：%s",other.ClientType)
				if changed&&selfID<remoteID{if err:=makeOffer();err!=nil{logf("创建连接失败：%v",err)}}
			case "signal":if err:=handleSignal(msg.Payload);err!=nil{logf("处理信令失败：%v",err)}
			}
		}
	}()
	go func(){scanner:=bufio.NewScanner(os.Stdin);for scanner.Scan(){text:=strings.TrimSpace(scanner.Text());if text==""{continue};if dc==nil||dc.ReadyState()!=webrtc.DataChannelStateOpen{logf("数据通道尚未打开");continue};if err:=dc.SendText(text);err!=nil{logf("发送失败：%v",err)}else{logf("发送消息：%s",text)}}}()
	stop:=make(chan os.Signal,1);signal.Notify(stop,os.Interrupt,syscall.SIGTERM);<-stop;logf("正在退出");if pc!=nil{_ = pc.Close()}
}
