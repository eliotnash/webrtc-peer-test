# WebRTC Peer Test

[中文](#中文) · [English](#english)

## 中文

一个可自行部署的跨平台 WebRTC 端到端连通性测试工具，支持浏览器与命令行客户端自由组合。

### 功能

- 浏览器 ↔ 浏览器：DataChannel 消息、摄像头、屏幕共享
- 浏览器 ↔ CLI、CLI ↔ CLI：DataChannel 消息
- 两人测试房间与中英文网页切换
- ICE、WebRTC 状态及 P2P/TURN 路径识别
- Windows、Linux、macOS CLI
- Docker 开发与生产环境隔离

### 快速使用

打开部署后的 HTTPS 页面。输入房间号后可创建/进入指定房间；留空则自动生成房间号。另一台设备使用相同房间号加入。

```bash
webrtc-test --server wss://example.com/ws --room ABC123
```

自签名证书环境可增加 `--insecure`（仅建议测试使用）。

### 文档

- [部署指南](docs/DEPLOYMENT.md)
- [使用指南](docs/USAGE.md)

## English

A self-hosted, cross-platform WebRTC peer-to-peer connectivity tester for browser and CLI combinations.

### Features

- Browser ↔ browser: DataChannel messages, camera, and screen sharing
- Browser ↔ CLI and CLI ↔ CLI: DataChannel messages
- Two-peer rooms and a bilingual Chinese/English web UI
- ICE/WebRTC status and P2P/TURN route detection
- CLI builds for Windows, Linux, and macOS
- Isolated Docker development and production environments

### Quick start

Open the deployed HTTPS page. Enter a room ID to create or enter that room, or leave it blank to generate one automatically. Join from another device with the same room ID.

```bash
webrtc-test --server wss://example.com/ws --room ABC123
```

Add `--insecure` only when testing with a self-signed certificate.

### Documentation

- [Deployment Guide](docs/DEPLOYMENT.md)
- [Usage Guide](docs/USAGE.md)

## Project structure

```text
cli/                  Go + Pion WebRTC CLI
scripts/              Cross-platform CLI build script
signaling/            HTTPS, static web UI, and WSS signaling
docs/                 Bilingual documentation
compose.dev.yml       Development container
compose.prod.yml      Production container
```

## Security

Use a trusted HTTPS certificate in production. Room IDs are not authentication credentials. Add authentication and access controls before using this project for sensitive communication.

## License

No open-source license has been selected yet.
