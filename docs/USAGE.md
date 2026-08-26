# 使用指南 / Usage Guide

## 中文

| 设备 A | 设备 B | 消息 | 摄像头/屏幕 |
|---|---|---:|---:|
| 浏览器 | 浏览器 | 支持 | 支持 |
| 浏览器 | CLI | 支持 | 不支持 |
| CLI | CLI | 支持 | 不支持 |

每个房间最多两台设备。两端必须连接同一信令服务器并使用相同房间号。

1. 两台设备打开 HTTPS 页面。
2. 设备 A 输入房间号并点击“创建/进入房间”；留空可自动生成。
3. 设备 B 输入相同房间号并点击“加入房间”。
4. 等待 WebRTC 显示 `connected`，然后测试消息或媒体。

```bash
webrtc-test --server wss://example.com/ws --room ABC123
# 自签名证书环境
webrtc-test --server wss://example.com/ws --room ABC123 --insecure
```

常见问题：摄像头需要 HTTPS 和浏览器授权；DataChannel 失败时检查房间号、WSS 与 ICE 日志；ICE 长期处于 `checking` 时可能需要 TURN。

## English

| Device A | Device B | Messages | Camera/screen |
|---|---|---:|---:|
| Browser | Browser | Yes | Yes |
| Browser | CLI | Yes | No |
| CLI | CLI | Yes | No |

Each room accepts up to two peers. Both peers must use the same signaling server and room ID.

1. Open the HTTPS page on both devices.
2. On device A, enter a room ID and click “Create / Enter Room”, or leave it blank to generate one.
3. On device B, enter the same room ID and click “Join Room”.
4. Wait for WebRTC to show `connected`, then test messages or media.

```bash
webrtc-test --server wss://example.com/ws --room ABC123
# Self-signed certificate
webrtc-test --server wss://example.com/ws --room ABC123 --insecure
```

Troubleshooting: camera access requires HTTPS and browser permission; for DataChannel failures check the room ID, WSS, and ICE logs; if ICE remains in `checking`, a TURN server may be required.
