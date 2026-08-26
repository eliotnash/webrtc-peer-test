package main

import (
	"bufio"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
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
	Code       string          `json:"code,omitempty"`
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

type peerInfo struct {
	PeerID     string `json:"peerId"`
	ClientType string `json:"clientType"`
}

type signalPayload struct {
	Description *webrtc.SessionDescription `json:"description,omitempty"`
	Candidate   *webrtc.ICECandidateInit   `json:"candidate,omitempty"`
}

var (
	conn     *websocket.Conn
	pc       *webrtc.PeerConnection
	dc       *webrtc.DataChannel
	selfID   string
	remoteID string
	writeMu  sync.Mutex
	pending  []webrtc.ICECandidateInit
)

func logf(format string, args ...any) {
	fmt.Printf("[%s] %s\n", time.Now().Format("15:04:05"), fmt.Sprintf(format, args...))
}

func randomID() string {
	value := make([]byte, 8)
	_, _ = rand.Read(value)
	return hex.EncodeToString(value)
}

func send(value any) error {
	writeMu.Lock()
	defer writeMu.Unlock()
	return conn.WriteJSON(value)
}

func sendSignal(payload signalPayload) {
	raw, _ := json.Marshal(payload)
	_ = send(envelope{Type: "signal", Target: remoteID, Payload: raw})
}

func ensurePeer() error {
	if pc != nil {
		return nil
	}
	var err error
	pc, err = webrtc.NewPeerConnection(webrtc.Configuration{ICEServers: []webrtc.ICEServer{{
		URLs: []string{"stun:stun.qq.com:3478", "stun:stun.miwifi.com:3478"},
	}}})
	if err != nil {
		return err
	}
	logf("已创建 WebRTC 连接")
	pc.OnICECandidate(func(candidate *webrtc.ICECandidate) {
		if candidate == nil {
			return
		}
		init := candidate.ToJSON()
		logf("本地 ICE 候选：%s", init.Candidate)
		sendSignal(signalPayload{Candidate: &init})
	})
	pc.OnICEConnectionStateChange(func(state webrtc.ICEConnectionState) {
		logf("ICE 状态：%s", state.String())
	})
	pc.OnConnectionStateChange(func(state webrtc.PeerConnectionState) {
		logf("WebRTC 状态：%s", state.String())
		if state == webrtc.PeerConnectionStateConnected {
			inspectRoute()
		}
	})
	pc.OnDataChannel(func(channel *webrtc.DataChannel) { setupDataChannel(channel) })
	return nil
}

func setupDataChannel(channel *webrtc.DataChannel) {
	dc = channel
	dc.OnOpen(func() { logf("数据通道已打开；输入文字并回车即可发送") })
	dc.OnClose(func() { logf("数据通道已关闭") })
	dc.OnMessage(func(message webrtc.DataChannelMessage) { logf("收到消息：%s", string(message.Data)) })
}

func makeOffer() error {
	if err := ensurePeer(); err != nil {
		return err
	}
	if dc == nil {
		channel, err := pc.CreateDataChannel("messages", nil)
		if err != nil {
			return err
		}
		setupDataChannel(channel)
	}
	offer, err := pc.CreateOffer(nil)
	if err != nil {
		return err
	}
	if err = pc.SetLocalDescription(offer); err != nil {
		return err
	}
	sendSignal(signalPayload{Description: pc.LocalDescription()})
	return nil
}

func handleSignal(raw json.RawMessage) error {
	if err := ensurePeer(); err != nil {
		return err
	}
	var payload signalPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return err
	}
	if payload.Description != nil {
		if err := pc.SetRemoteDescription(*payload.Description); err != nil {
			return err
		}
		for _, candidate := range pending {
			_ = pc.AddICECandidate(candidate)
		}
		pending = nil
		if payload.Description.Type == webrtc.SDPTypeOffer {
			answer, err := pc.CreateAnswer(nil)
			if err != nil {
				return err
			}
			if err = pc.SetLocalDescription(answer); err != nil {
				return err
			}
			sendSignal(signalPayload{Description: pc.LocalDescription()})
		}
	}
	if payload.Candidate != nil {
		logf("远端 ICE 候选：%s", payload.Candidate.Candidate)
		if pc.RemoteDescription() == nil {
			pending = append(pending, *payload.Candidate)
		} else if err := pc.AddICECandidate(*payload.Candidate); err != nil {
			return err
		}
	}
	return nil
}

func candidateLabel(candidate webrtc.ICECandidateStats) string {
	return fmt.Sprintf("%s %s:%d %s", candidate.CandidateType.String(), candidate.IP, candidate.Port, candidate.Protocol)
}

func inspectRoute() {
	time.Sleep(500 * time.Millisecond)
	reports := pc.GetStats()
	for _, report := range reports {
		pair, ok := report.(webrtc.ICECandidatePairStats)
		if !ok || !pair.Nominated || pair.State != webrtc.StatsICECandidatePairStateSucceeded {
			continue
		}
		local, _ := reports[pair.LocalCandidateID].(webrtc.ICECandidateStats)
		remote, _ := reports[pair.RemoteCandidateID].(webrtc.ICECandidateStats)
		logf("最终候选对：本地 %s ⇄ 远端 %s", candidateLabel(local), candidateLabel(remote))
		return
	}
}

func tlsConfig(insecure bool, caFile string) (*tls.Config, error) {
	config := &tls.Config{InsecureSkipVerify: insecure} // #nosec G402 -- explicitly requested by --insecure
	if caFile == "" {
		return config, nil
	}
	pemData, err := os.ReadFile(caFile)
	if err != nil {
		return nil, fmt.Errorf("读取 CA 证书失败：%w", err)
	}
	roots, err := x509.SystemCertPool()
	if err != nil || roots == nil {
		roots = x509.NewCertPool()
	}
	if !roots.AppendCertsFromPEM(pemData) {
		return nil, fmt.Errorf("CA 证书文件中没有有效的 PEM 证书")
	}
	config.RootCAs = roots
	return config, nil
}

func main() {
	server := flag.String("server", "", "信令服务器地址，例如 wss://example.com/ws")
	createRoom := flag.Bool("create-room", false, "创建一个由服务器分配的唯一房间")
	joinRoom := flag.String("join-room", "", "进入指定房间")
	caCert := flag.String("ca-cert", "", "用于验证信令服务器的 CA/自签名证书文件")
	insecure := flag.Bool("insecure", false, "跳过 TLS 证书校验（仅用于临时测试）")
	flag.Parse()

	if *server == "" {
		fmt.Fprintln(os.Stderr, "请使用 --server 指定信令服务器地址")
		os.Exit(2)
	}
	if (*createRoom && *joinRoom != "") || (!*createRoom && *joinRoom == "") {
		fmt.Fprintln(os.Stderr, "--create-room 和 --join-room ROOM_ID 必须且只能选择一个")
		os.Exit(2)
	}
	if *insecure && *caCert != "" {
		fmt.Fprintln(os.Stderr, "--insecure 和 --ca-cert 不能同时使用")
		os.Exit(2)
	}
	config, err := tlsConfig(*insecure, *caCert)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}

	selfID = randomID()
	dialer := websocket.Dialer{TLSClientConfig: config}
	conn, _, err = dialer.Dial(*server, http.Header{})
	if err != nil {
		logf("连接信令服务器失败：%v", err)
		os.Exit(1)
	}
	defer conn.Close()
	logf("信令服务器连接成功")
	if *createRoom {
		_ = send(envelope{Type: "create", PeerID: selfID, ClientType: "cli"})
	} else {
		_ = send(envelope{Type: "join", RoomID: strings.ToUpper(*joinRoom), PeerID: selfID, ClientType: "cli"})
	}

	go func() {
		for {
			var message envelope
			if err := conn.ReadJSON(&message); err != nil {
				logf("信令连接已断开：%v", err)
				return
			}
			switch message.Type {
			case "error":
				switch message.Code {
				case "ROOM_NOT_FOUND":
					logf("错误：房间不存在，请先创建房间")
				case "ROOM_FULL":
					logf("错误：房间已有两台设备")
				default:
					logf("错误：%s", message.Message)
				}
			case "peer-left":
				remoteID = ""
				logf("远端设备已离开")
			case "room-state":
				var other *peerInfo
				for i := range message.Peers {
					if message.Peers[i].PeerID != selfID {
						other = &message.Peers[i]
						break
					}
				}
				if other == nil {
					logf("当前房间：%s；等待另一台设备", message.RoomID)
					continue
				}
				changed := remoteID != other.PeerID
				remoteID = other.PeerID
				logf("远端设备已进入：%s", other.ClientType)
				if changed && selfID < remoteID {
					if err := makeOffer(); err != nil {
						logf("创建连接失败：%v", err)
					}
				}
			case "signal":
				if err := handleSignal(message.Payload); err != nil {
					logf("处理信令失败：%v", err)
				}
			}
		}
	}()

	go func() {
		scanner := bufio.NewScanner(os.Stdin)
		for scanner.Scan() {
			message := strings.TrimSpace(scanner.Text())
			if message == "" {
				continue
			}
			if dc == nil || dc.ReadyState() != webrtc.DataChannelStateOpen {
				logf("数据通道尚未打开")
				continue
			}
			if err := dc.SendText(message); err != nil {
				logf("发送失败：%v", err)
			} else {
				logf("发送消息：%s", message)
			}
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	logf("正在退出")
	if pc != nil {
		_ = pc.Close()
	}
}
