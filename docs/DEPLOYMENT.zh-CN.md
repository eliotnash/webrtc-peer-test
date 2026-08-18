# 部署文档

## 环境要求

- Linux 服务器
- Docker 与 Docker Compose
- 可用的 `443/TCP` 端口
- 域名证书或自签名证书

## 1. 获取代码

```bash
git clone https://github.com/eliotnash/webrtc-peer-test.git
cd webrtc-peer-test
```

## 2. 构建各平台 CLI

构建结果会写入 `signaling/public/download/`，并由网页提供下载：

```bash
sh scripts/build-cli.sh
```

生成以下版本：

- Windows x64
- Linux x64
- Linux ARM64
- macOS Intel
- macOS Apple Silicon

## 3. 准备 TLS 证书

创建证书目录：

```bash
mkdir -p certs
```

使用已有证书时，将文件放置为：

```text
certs/server.crt
certs/server.key
```

没有域名时，可为服务器 IP 创建自签名证书：

```bash
SERVER_IP=203.0.113.10
openssl req -x509 -newkey rsa:2048 -sha256 -days 3650 -nodes \
  -keyout certs/server.key \
  -out certs/server.crt \
  -subj "/CN=$SERVER_IP" \
  -addext "subjectAltName=IP:$SERVER_IP"
```

请把示例 IP 替换为实际公网 IP。

## 4. 启动服务

```bash
docker compose up -d --build
```

检查状态：

```bash
docker compose ps
curl -k https://127.0.0.1/health
```

返回 `{"ok":true}` 表示服务正常。

## 5. 防火墙与安全组

至少开放：

```text
443/TCP  网页、HTTPS 和 WSS 信令
```

如果另行部署 TURN，还需按 TURN 配置开放监听端口和 UDP 中继端口范围。

## 更新与停止

更新：

```bash
git pull
sh scripts/build-cli.sh
docker compose up -d --build
```

停止：

```bash
docker compose down
```

`docker compose down` 只会停止本项目容器，不会影响其他 Compose 项目。
