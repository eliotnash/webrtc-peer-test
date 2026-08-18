# 使用文档

## 浏览器 ↔ 浏览器

1. 两台设备使用浏览器打开服务地址。
2. 自签名证书环境首次访问时，选择高级选项并继续访问。
3. 设备 A 点击“创建房间”。
4. 设备 B 输入相同房间号并点击“加入房间”。
5. 等待 DataChannel 打开后，即可双向发送消息。
6. 任意一方可点击“共享摄像头”或“共享屏幕”。

媒体权限由浏览器管理，用户必须主动允许摄像头、麦克风或屏幕共享。

## 浏览器 ↔ CLI

浏览器创建房间后，在另一台设备运行：

```bash
webrtc-test \
  --server wss://服务器地址/ws \
  --room 房间号
```

自签名证书环境增加 `--insecure`。连接成功后，在终端输入文字并回车即可发送。

浏览器与 CLI 之间只建立 DataChannel，不建立媒体通道。

## CLI ↔ CLI

两台设备使用相同服务器和房间号运行 CLI：

```bash
webrtc-test --server wss://服务器地址/ws --room ABC123 --insecure
```

出现以下日志表示连接成功：

```text
数据通道已打开
连接路径：P2P 直连，协议：udp
```

## CLI 平台选择

| 系统 | 文件 |
|---|---|
| Windows x64 | `webrtc-test-windows-amd64.exe` |
| Linux x64 | `webrtc-test-linux-amd64` |
| Linux ARM64 | `webrtc-test-linux-arm64` |
| macOS Intel | `webrtc-test-macos-amd64` |
| macOS Apple Silicon | `webrtc-test-macos-arm64` |

Linux 和 macOS 下载后需要添加执行权限：

```bash
chmod +x webrtc-test-*
```

## 日志说明

- `信令服务器连接成功`：已连接 WSS 服务。
- `ICE 状态：checking`：正在探测可用网络路径。
- `WebRTC 状态：connected`：WebRTC 已建立。
- `数据通道已打开`：可以发送消息。
- `P2P 直连`：两端直接通信。
- `TURN 中继`：数据经 TURN 服务器转发。

## 常见问题

### 浏览器无法使用摄像头或屏幕共享

确认通过 HTTPS 访问，并已接受证书、允许浏览器权限。

### CLI 报证书错误

测试环境可添加 `--insecure`。生产环境应使用可信证书。

### 一直停留在 ICE checking

通常表示两端网络无法找到可用路径。可检查防火墙、UDP 限制，或部署 TURN 服务。
