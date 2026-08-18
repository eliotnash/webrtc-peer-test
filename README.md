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

1. 两台设备打开部署后的 HTTPS 页面。
2. 第一台设备创建房间，并把房间号发给第二台设备。
3. 第二台设备通过网页或 CLI 加入同一房间。
4. 连接成功后发送消息；浏览器双方还可共享摄像头或屏幕。

CLI 示例：

```bash
./webrtc-test-linux-amd64 \
  --server wss://your-server.example/ws \
  --room ABC123
```

自签名证书环境需增加：

```bash
--insecure
```

## 文档

- [部署文档](docs/DEPLOYMENT.zh-CN.md)
- [使用文档](docs/USAGE.zh-CN.md)

## 目录

```text
cli/                  Go + Pion WebRTC 命令行客户端
scripts/              CLI 跨平台构建脚本
signaling/            HTTPS、静态页面和 WSS 信令服务
docker-compose.yml    Docker 部署配置
```

## 安全说明

- 生产环境建议使用域名和可信 HTTPS 证书。
- 自签名证书仅适合测试，浏览器需手动信任。
- `--insecure` 会跳过 TLS 证书校验，仅建议在受控测试环境使用。
- 房间号不是身份认证凭据，不应将服务直接用于敏感通信。

## License

当前仓库为私有项目，暂未指定开源许可证。
