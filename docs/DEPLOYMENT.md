# 部署指南 / Deployment Guide

## 中文

要求：Linux、Docker Compose、可用的生产端口和 TLS 证书。

```bash
git clone https://github.com/eliotnash/webrtc-peer-test.git
cd webrtc-peer-test
sh scripts/build-cli.sh
mkdir -p certs
```

将证书保存为 `certs/server.crt`，私钥保存为 `certs/server.key`。测试环境可创建 IP 自签名证书：

```bash
SERVER_IP=203.0.113.10
openssl req -x509 -newkey rsa:2048 -sha256 -days 825 -nodes \
  -keyout certs/server.key -out certs/server.crt \
  -subj "/CN=$SERVER_IP" -addext "subjectAltName=IP:$SERVER_IP"
```

启动与检查：

```bash
# 生产环境：9443
docker compose -p webrtc-peer-prod -f compose.prod.yml up -d --build

# 开发环境：8444，挂载宿主机源码
docker compose -p webrtc-peer-dev -f compose.dev.yml up -d --build

docker compose -p webrtc-peer-prod -f compose.prod.yml ps
curl -k https://127.0.0.1/health
```

当前生产配置使用 `9443/TCP`；仅在需要公网开发访问时开放 `8444/TCP`。证书私钥不得提交到 Git。

## English

Requirements: Linux, Docker Compose, an available production port, and a TLS certificate.

```bash
git clone https://github.com/eliotnash/webrtc-peer-test.git
cd webrtc-peer-test
sh scripts/build-cli.sh
mkdir -p certs
```

Store the certificate as `certs/server.crt` and the key as `certs/server.key`. For an IP-only test server:

```bash
SERVER_IP=203.0.113.10
openssl req -x509 -newkey rsa:2048 -sha256 -days 825 -nodes \
  -keyout certs/server.key -out certs/server.crt \
  -subj "/CN=$SERVER_IP" -addext "subjectAltName=IP:$SERVER_IP"
```

Start and verify:

```bash
# Production on 9443
docker compose -p webrtc-peer-prod -f compose.prod.yml up -d --build

# Development on 8444 with source mounted from the host
docker compose -p webrtc-peer-dev -f compose.dev.yml up -d --build

docker compose -p webrtc-peer-prod -f compose.prod.yml ps
curl -k https://127.0.0.1/health
```

The current production configuration uses `9443/TCP`. Open `8444/TCP` only when public development access is required. Never commit certificate private keys.
