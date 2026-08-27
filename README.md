# WebRTC Peer Test

[中文](#中文) · [English](#english)

## 中文

一个可自行部署的跨平台 WebRTC 端到端连通性测试工具，支持浏览器与命令行客户端自由组合。

### 功能

- 浏览器 ↔ 浏览器：DataChannel 消息、摄像头、屏幕共享
- 浏览器 ↔ CLI、CLI ↔ CLI：DataChannel 消息
- 两人测试房间与中英文网页切换
- 本地、STUN 映射及最终选中 ICE 候选地址
- Windows、Linux、macOS CLI
- Docker 开发与生产环境隔离

### 文档

- [部署指南](docs/DEPLOYMENT.md)
- [使用指南](docs/USAGE.md)

## English

A self-hosted, cross-platform WebRTC peer-to-peer connectivity tester for browser and CLI combinations.

### Features

- Browser ↔ browser: DataChannel messages, camera, and screen sharing
- Browser ↔ CLI and CLI ↔ CLI: DataChannel messages
- Two-peer rooms and a bilingual Chinese/English web UI
- Local, STUN-mapped, and selected ICE candidate addresses
- CLI builds for Windows, Linux, and macOS
- Isolated Docker development and production environments

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
