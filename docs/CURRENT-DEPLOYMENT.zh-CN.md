# 当前部署记录

> 本文包含当前私有测试环境的信息，不适合原样复制到公开仓库。严禁在本文或 Git 中记录 SSH 密码、令牌和证书私钥。

最后核对时间：2026-08-19（Asia/Shanghai）

## 服务器

| 项目 | 当前值 |
|---|---|
| 云服务商 | 腾讯云 |
| 公网 IP | `43.142.181.71` |
| 操作系统 | Ubuntu 24.04.4 LTS |
| SSH 用户 | `ubuntu` |
| SSH 地址 | `ubuntu@43.142.181.71` |
| 项目部署目录 | `/opt/webrtc-test` |
| Docker Compose 项目名 | `webrtc-test` |

SSH 凭据单独保管，不得提交到仓库。

## 访问地址

- 浏览器入口：<https://43.142.181.71>
- WSS 信令地址：`wss://43.142.181.71/ws`
- 健康检查：<https://43.142.181.71/health>
- 服务器证书下载：<https://43.142.181.71/server.crt>

当前使用以公网 IP 签发的自签名证书。浏览器首次访问时会显示安全警告，需要手动继续访问；CLI 测试需要增加 `--insecure`。

## WebRTC 测试服务

| 项目 | 当前值 |
|---|---|
| 容器名 | `webrtc-test` |
| 镜像名 | `webrtc-test-webrtc-test` |
| 运行状态 | 运行中 |
| 启动时间 | 2026-08-10 20:08（Asia/Shanghai） |
| 端口映射 | 宿主机 `443/TCP` → 容器 `10443/TCP` |
| Compose 文件 | `/opt/webrtc-test/docker-compose.yml` |
| Docker 网络 | `webrtc-test_default` |
| 证书挂载 | `/opt/webrtc-test/certs` → `/app/certs`（只读） |

健康检查实测返回：

```json
{"ok":true}
```

当前容器未配置 Docker `HEALTHCHECK`，所以应以 `/health` 接口和实际页面访问结果判断服务状态。

## 运维命令

```bash
cd /opt/webrtc-test

# 查看状态
sudo docker compose ps

# 查看日志
sudo docker compose logs --tail=200 webrtc-test

# 健康检查
curl -k https://127.0.0.1/health

# 重新构建并启动本项目
sudo docker compose up -d --build

# 停止本项目
sudo docker compose down
```

这些命令必须在 `/opt/webrtc-test` 执行，以免操作其他 Compose 项目。

## 代码与线上版本关系

- 私有仓库：`https://github.com/eliotnash/webrtc-peer-test`
- 默认分支：`main`
- 当前线上目录最初通过部署包上传，不是 Git clone 工作区。
- 仓库文档和通用化参数可能晚于当前线上镜像；更新线上版本前应先备份证书、执行构建并验证容器配置。
