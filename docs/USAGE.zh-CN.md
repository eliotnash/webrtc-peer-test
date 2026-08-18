# 使用文档

本文档说明浏览器和 CLI 的完整操作。只想快速开始时，可先阅读仓库 [README](../README.md) 的“快速使用”。

## 支持的连接组合

| 设备 A | 设备 B | DataChannel 消息 | 摄像头/屏幕 |
|---|---|---:|---:|
| 浏览器 | 浏览器 | 支持 | 支持 |
| 浏览器 | CLI | 支持 | 不支持 |
| CLI | CLI | 支持 | 不支持 |

每个房间最多加入两台设备。两端必须连接相同的信令服务器并使用完全相同的房间号。

## 浏览器 ↔ 浏览器

1. 两台设备使用浏览器打开服务地址。
2. 自签名证书环境首次访问时，选择高级选项并继续访问。
3. 设备 A 点击“创建房间”，记下页面生成的房间号。
4. 设备 B 输入相同房间号并点击“加入房间”。
5. 等待页面显示 WebRTC 为 `connected`，日志显示“数据通道已打开”。
6. 双方在消息框输入文字，验证 DataChannel 双向通信。
7. 任意一方点击“共享摄像头”或“共享屏幕”，验证媒体通道。
8. 测试结束后点击“停止共享”。

媒体权限由浏览器管理，用户必须主动允许摄像头、麦克风或屏幕共享。

## 浏览器 ↔ CLI

### 1. 浏览器创建房间

浏览器打开服务页面并点击“创建房间”，例如得到房间号 `ABC123`。

### 2. CLI 加入房间

```bash
webrtc-test \
  --server wss://服务器地址/ws \
  --room ABC123
```

自签名证书环境增加 `--insecure`。完整示例：

```bash
webrtc-test --server wss://43.142.181.71/ws --room ABC123 --insecure
```

连接成功后，在终端输入文字并回车。网页和终端应分别显示发送与接收日志。

浏览器与 CLI 之间只建立 DataChannel，不建立媒体通道；网页点击媒体共享时会提示命令行客户端不支持媒体。

## CLI ↔ CLI

### 1. 约定房间号

两台设备自行约定同一个房间号，例如 `ABC123`。CLI 不需要先由浏览器创建房间：第一台 CLI 加入后会创建房间并等待第二台设备。

### 2. 设备 A 启动 CLI

```bash
webrtc-test --server wss://服务器地址/ws --room ABC123 --insecure
```

设备 A 将显示“已加入房间，等待另一台设备”。

### 3. 设备 B 启动 CLI

设备 B 使用完全相同的服务器地址和房间号：

```bash
webrtc-test --server wss://服务器地址/ws --room ABC123 --insecure
```

双方随后会自动协商 Offer、Answer 和 ICE 候选，不需要手动指定发起端。

### 4. 验证结果

出现以下日志表示连接成功：

```text
WebRTC 状态：connected
数据通道已打开；输入文字并回车即可发送
连接路径：P2P 直连，协议：udp
```

任意一端输入文字并回车，另一端应显示“收到消息”。建议两端各发送一次，确认双向通信正常。按 `Ctrl+C` 结束 CLI。

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

macOS 首次运行如果被系统拦截，需要在“系统设置 → 隐私与安全性”中允许该程序。

## 参数说明

| 参数 | 是否必填 | 说明 |
|---|---:|---|
| `--server` | 是 | WSS 信令地址，例如 `wss://example.com/ws` |
| `--room` | 是 | 两端共同使用的房间号 |
| `--insecure` | 否 | 跳过 TLS 证书校验，仅用于自签名测试环境 |

## 日志说明

- `信令服务器连接成功`：已连接 WSS 服务。
- `收到/发送 SDP`：双方正在协商 WebRTC 会话。
- `ICE 状态：checking`：正在探测可用网络路径。
- `WebRTC 状态：connected`：WebRTC 连接已建立。
- `数据通道已打开`：可以发送消息。
- `P2P 直连`：两端直接通信。
- `TURN 中继`：数据经 TURN 服务器转发。

## 常见问题

### 浏览器无法使用摄像头或屏幕共享

确认通过 HTTPS 访问，并已接受证书、允许浏览器权限。浏览器与 CLI 组合不支持媒体通道。

### CLI 报证书错误

测试环境可添加 `--insecure`。生产环境应使用可信证书。

### DataChannel 没有打开

确认两端房间号完全一致、房间中只有两台设备，并检查两端日志中是否出现 WSS 或 ICE 错误。

### 一直停留在 ICE checking

通常表示两端网络无法找到可用路径。可检查防火墙、UDP 限制，或部署并配置 TURN 服务。

### 页面显示 TURN 中继

表示 WebRTC 已连接，但双方未能直接打通，业务数据经过 TURN 转发。该结果代表 WebRTC 可用，但不是 P2P 直连。
