# NodeSeeker Docker 部署指南

本项目当前提供两种 Docker 部署方式：

1. 使用仓库内的 `Dockerfile` 本地构建镜像
2. 直接拉取 GHCR 已发布镜像运行

## 文件说明

1. `Dockerfile`
   用于构建应用镜像，基于 Bun 运行时，并内置 Playwright Chromium 依赖。
2. `docker-compose.yml`
   适合本地开发、测试或自建环境，直接从当前仓库构建镜像。
3. `docker-compose.prod.yml`
   适合生产环境，默认拉取 `ghcr.io/planetsider/nodeseeker-docker:latest`。
4. `.dockerignore`
   Docker 构建上下文忽略规则。
5. `.env.example`
   环境变量模板。

## 快速开始

### 方式一：直接运行 GHCR 镜像

```bash
docker run -d \
  --name nodeseeker \
  -p 3010:3010 \
  -v ./data:/usr/src/app/data \
  -v ./logs:/usr/src/app/logs \
  --env-file .env \
  ghcr.io/planetsider/nodeseeker-docker:latest
```

访问 `http://localhost:3010`，首次使用时创建管理员账户。

### 方式二：使用本地 Compose 构建运行

```bash
cp .env.example .env
docker compose up -d --build
```

这会：

1. 根据当前仓库 `Dockerfile` 构建镜像
2. 启动应用容器
3. 挂载本地 `./data` 和 `./logs`

### 方式三：生产环境 Compose

```bash
cp .env.example .env
docker compose -f docker-compose.prod.yml up -d
```

这会直接拉取：

```text
ghcr.io/planetsider/nodeseeker-docker:latest
```

## 环境变量

项目支持零配置启动，但建议通过 `.env` 显式管理运行参数。

当前仍由环境变量控制的主要项目：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3010` | 服务端口 |
| `HOST` | `0.0.0.0` | 服务监听地址 |
| `CORS_ORIGINS` | `http://localhost:3010` | 允许的跨域源 |
| `RSS_TIMEOUT` | `10000` | RSS 请求超时 |
| `RSS_CHECK_ENABLED` | `true` | 是否启用定时 RSS 抓取 |
| `RSS_PLAYWRIGHT_FALLBACK` | `true` | 普通 RSS 抓取失败时是否启用 Playwright 兜底 |
| `PLAYWRIGHT_HEADLESS` | `true` | Playwright 是否使用无头模式 |
| `TELEGRAM_WEBHOOK_URL` | 空 | 可选覆盖 Telegram Webhook URL |
| `LOG_LEVEL` | `info` | 日志级别 |

以下业务配置已经迁移到数据库和 Web 管理界面：

1. RSS 源地址
2. RSS 抓取间隔
3. RSS 代理
4. Telegram Bot Token
5. Telegram Chat ID
6. Server酱 配置
7. MeoW 配置

## 数据与日志目录

Compose 文件默认使用以下宿主机目录挂载：

1. `./data` -> `/usr/src/app/data`
2. `./logs` -> `/usr/src/app/logs`

这样更适合：

1. 直接备份 SQLite 数据库
2. 检查运行日志
3. 在本机和服务器上保持一致的目录结构

## Playwright 兜底说明

镜像中已包含 Playwright Chromium 所需依赖，用于 RSS 抓取兜底。

工作方式：

1. 默认先使用普通 `fetch` 抓取 RSS
2. 如果出现 TLS、反爬、连接中断等问题
3. 自动回退到 Playwright 浏览器抓取

如果你不希望启用兜底，可在 `.env` 中设置：

```bash
RSS_PLAYWRIGHT_FALLBACK=false
```

## 常用命令

### 查看服务状态

```bash
docker compose ps
docker compose -f docker-compose.prod.yml ps
```

### 查看日志

```bash
docker compose logs -f nodeseeker
docker compose -f docker-compose.prod.yml logs -f nodeseeker
```

### 停止服务

```bash
docker compose down
docker compose -f docker-compose.prod.yml down
```

### 重新构建本地镜像

```bash
docker compose up -d --build
```

### 拉取最新生产镜像

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

## 健康检查

镜像内置健康检查：

```text
GET /health
```

你也可以手动检查：

```bash
curl http://localhost:3010/health
```

## 自动更新

`docker-compose.prod.yml` 默认带有 `watchtower` 服务，可用于自动更新生产镜像。

如果你不需要自动更新，可以直接删掉或注释掉 `watchtower` 服务。

## 故障排除

### 1. 容器无法启动

```bash
docker compose logs nodeseeker
```

重点检查：

1. `./data` 目录是否可写
2. 端口 `3010` 是否被占用
3. `.env` 配置是否有非法值

### 2. RSS 抓取失败

先检查：

1. RSS 源是否可访问
2. 网络或代理是否异常
3. Playwright fallback 是否已启用

### 3. 生产环境拉不到镜像

确认以下镜像是否存在：

```text
ghcr.io/planetsider/nodeseeker-docker:latest
```

如果仓库是私有或访问受限，需要先登录 GHCR。

### 4. 数据迁移问题

数据库文件挂载在：

```text
/usr/src/app/data/nodeseeker.db
```

升级镜像前建议先备份 `./data` 目录。

## 备份建议

最直接的备份方式是备份宿主机目录：

1. `./data`
2. `./logs`

例如：

```bash
tar czf nodeseeker-backup.tar.gz data logs
```
