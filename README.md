# WebRTC Peer Test

一个可自行部署的跨平台 WebRTC 端到端连通性测试工具，支持浏览器和命令行客户端自由组合。

## 功能

- 浏览器 ↔ 浏览器：DataChannel 消息、摄像头、屏幕共享
- 浏览器 ↔ CLI：DataChannel 消息
- CLI ↔ CLI：DataChannel 消息
- 两人测试房间
- 中文连接过程日志
- ICE、WebRTC 连接状态展示
- P2P 直连与 TURN 中继路径识别
- Windows、Linux、macOS CLI
- Docker 单容器部署

## 工作原理

服务器提供网页并通过 WebSocket 转发 SDP 和 ICE 信令。连接建立后，两台设备通过 WebRTC 直接交换消息或媒体；服务端不转发业务数据，除非连接使用单独配置的 TURN 中继。

## 快速使用

先让两台设备使用同一个房间号。第一台设备可以在网页中点击“创建房间”，也可以自行约定房间号，例如 `ABC123`。

| 组合 | 可测试内容 |
|---|---|
| 浏览器 ↔ 浏览器 | 消息、摄像头、屏幕共享 |
| 浏览器 ↔ CLI | 消息 |
| CLI ↔ CLI | 消息 |

### 浏览器 ↔ 浏览器

1. 两台设备打开部署后的 HTTPS 页面。
2. 设备 A 创建房间，设备 B 输入相同房间号加入。
3. DataChannel 打开后可以发送消息。
4. 任意一方可以共享摄像头或屏幕。

### 浏览器 ↔ CLI

浏览器创建房间后，另一台设备运行：

```bash
webrtc-test \
  --server wss://服务器地址/ws \
  --room ABC123 \
  --insecure
```

### CLI ↔ CLI

两台设备分别运行相同命令，并使用同一个房间号：

```bash
webrtc-test --server wss://服务器地址/ws --room ABC123 --insecure
```

双方看到“数据通道已打开”后，直接输入文字并回车即可互发消息。

`--insecure` 仅用于自签名证书环境。完整的平台下载、权限设置、日志说明和故障排查见[使用文档](docs/USAGE.zh-CN.md)。

## 文档

- [部署文档](docs/DEPLOYMENT.zh-CN.md)：通用部署步骤
- [使用文档](docs/USAGE.zh-CN.md)：完整测试操作和故障排查
- [当前部署记录](docs/CURRENT-DEPLOYMENT.zh-CN.md)：本私有仓库对应的腾讯云部署信息

## 目录

```text
cli/                  Go + Pion WebRTC 命令行客户端
scripts/              CLI 跨平台构建脚本
signaling/            HTTPS、静态页面和 WSS 信令服务
docs/                 中文部署与使用文档
docker-compose.yml    Docker 部署配置
```

## 安全说明

- 生产环境建议使用域名和可信 HTTPS 证书。
- 自签名证书仅适合测试，浏览器需手动信任。
- `--insecure` 会跳过 TLS 证书校验，仅建议在受控测试环境使用。
- 房间号不是身份认证凭据，不应将服务直接用于敏感通信。

## License

当前仓库为私有项目，暂未指定开源许可证。
