# 使用指南 / Usage Guide

## 中文

每个房间最多两台设备。点击“创建房间”时，服务器检查内存中的房间并生成唯一房间号；最后一台设备离开后，房间立即释放。

### 浏览器

1. 设备 A 点击“创建房间”，复制服务器返回的房间号。
2. 设备 B 输入相同房间号并点击“进入房间”。
3. 等待 WebRTC 显示已连接，然后测试消息、摄像头或屏幕共享。
4. ICE 区域会列出本地与远端的全部 Host/STUN 候选，以及最终选择的候选对。

### CLI

```bash
# 创建唯一房间
webrtc-test --server wss://example.com/ws --create-room --ca-cert server.crt

# 进入已有房间
webrtc-test --server wss://example.com/ws --join-room ABC123 --ca-cert server.crt

# 临时测试：跳过证书验证
webrtc-test --server wss://example.com/ws --create-room --insecure
webrtc-test --server wss://example.com/ws --join-room ABC123 --insecure
```

`--create-room` 与 `--join-room` 必须且只能选择一个。使用自签名证书时推荐 `--ca-cert`；临时测试也可用 `--insecure` 跳过证书校验，但两者不能同时使用。

支持 Windows 10/11 x64、Linux x64/ARM64、macOS Intel 和 Apple Silicon。Linux 与 macOS 下载后可能需要执行 `chmod +x webrtc-test-*`。

本项目只配置 STUN，不提供 TURN 中继；无法建立直连时测试结果为失败。

## English

Each room accepts up to two peers. “Create Room” asks the server for a unique in-memory room ID. The room is released immediately after its last peer leaves.

### Browser

1. On device A, click “Create Room” and copy the server-generated room ID.
2. On device B, enter the same ID and click “Enter Room”.
3. Wait for WebRTC to connect, then test messages, camera, or screen sharing.
4. The ICE section lists all local and remote host/STUN candidates and the selected pair.

### CLI

```bash
# Create a unique room
webrtc-test --server wss://example.com/ws --create-room --ca-cert server.crt

# Enter an existing room
webrtc-test --server wss://example.com/ws --join-room ABC123 --ca-cert server.crt

# Temporary testing: skip certificate verification
webrtc-test --server wss://example.com/ws --create-room --insecure
webrtc-test --server wss://example.com/ws --join-room ABC123 --insecure
```

Exactly one of `--create-room` and `--join-room` is required. Prefer `--ca-cert` for a self-signed certificate. `--insecure` skips verification for temporary testing; the two options are mutually exclusive.

Supported clients: Windows 10/11 x64, Linux x64/ARM64, macOS Intel, and macOS Apple Silicon. Linux and macOS downloads may require `chmod +x webrtc-test-*`.

This project configures STUN only and provides no TURN relay. If a direct connection cannot be established, the test fails.
