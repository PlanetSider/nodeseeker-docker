# NodeSeeker Docker 部署指南

当前仓库只保留一套 Compose 部署文件：

1. `docker-compose.yml`

它直接拉取 GHCR 镜像运行，并把运行参数写在文件内，不再依赖 `.env` 文件。

## 文件说明

1. `Dockerfile`
   用于构建项目镜像，CI 会基于它发布 GHCR 镜像。
2. `docker-compose.yml`
   唯一保留的 Compose 文件，直接使用 `ghcr.io/planetsider/nodeseeker-docker:latest`。
3. `.dockerignore`
   Docker 构建上下文忽略规则。

## 快速开始

### 方式一：直接运行 GHCR 镜像

```bash
docker run -d \
  --name nodeseeker \
  -p 3010:3010 \
  -v ./data:/usr/src/app/data \
  -v ./logs:/usr/src/app/logs \
  -e NODE_ENV=production \
  -e PORT=3010 \
  -e HOST=0.0.0.0 \
  -e DATABASE_PATH=/usr/src/app/data/nodeseeker.db \
  -e CORS_ORIGINS=http://localhost:3010 \
  -e RSS_TIMEOUT=10000 \
  -e RSS_CHECK_ENABLED=true \
  -e RSS_ARTICLE_BODY_ENRICHMENT_ENABLED=true \
  -e TRACKED_TOPIC_FETCH_ENABLED=true \
  -e AI_SUMMARY_ENABLED=true \
  -e RSS_PLAYWRIGHT_FALLBACK=true \
  -e RSS_ARTICLE_BROWSER_FALLBACK_LIMIT=1 \
  -e TRACKED_TOPIC_BROWSER_FALLBACK_LIMIT=1 \
  -e PLAYWRIGHT_FAILURE_THRESHOLD=3 \
  -e PLAYWRIGHT_COOLDOWN_MS=300000 \
  -e PLAYWRIGHT_HEADLESS=true \
  --shm-size=1g \
  --ulimit core=0 \
  -e TELEGRAM_WEBHOOK_URL= \
  -e LOG_LEVEL=info \
  ghcr.io/planetsider/nodeseeker-docker:latest
```

### 方式二：使用 Docker Compose

```bash
docker compose up -d
```

这会：

1. 拉取最新 GHCR 镜像
2. 启动应用容器
3. 挂载本地 `./data` 和 `./logs`
4. 增大 Chromium 共享内存并关闭 core dump 文件输出

## 当前 Compose 配置特征

`docker-compose.yml` 当前是简化后的单服务配置，特点如下：

1. 不再依赖 `.env`
2. 不再区分 `prod` 文件名
3. 不再包含 `watchtower`
4. 不再配置容器健康检查
5. 所有基础运行参数直接写在 `environment` 中
6. 为 Chromium 增加 `shm_size` 并禁用 `core dump`

## 当前内置环境参数

`docker-compose.yml` 直接写入了这些参数：

| 变量 | 当前值 | 说明 |
|------|--------|------|
| `NODE_ENV` | `production` | 生产模式 |
| `PORT` | `3010` | 服务端口 |
| `HOST` | `0.0.0.0` | 监听地址 |
| `DATABASE_PATH` | `/usr/src/app/data/nodeseeker.db` | SQLite 路径 |
| `CORS_ORIGINS` | `http://localhost:3010` | 允许的跨域源 |
| `RSS_TIMEOUT` | `10000` | RSS 请求超时 |
| `RSS_CHECK_ENABLED` | `true` | 是否启用定时抓取 |
| `RSS_ARTICLE_BODY_ENRICHMENT_ENABLED` | `true` | 是否启用文章正文增强；关闭后跳过正文抓取和基于正文的 AI 摘要 |
| `TRACKED_TOPIC_FETCH_ENABLED` | `true` | 是否启用追踪帖子抓取检查 |
| `AI_SUMMARY_ENABLED` | `true` | 是否启用 AI 摘要生成 |
| `RSS_PLAYWRIGHT_FALLBACK` | `true` | RSS 抓取失败时启用 Playwright 兜底 |
| `RSS_ARTICLE_BROWSER_FALLBACK_LIMIT` | `1` | 每轮 RSS 新文章正文允许触发浏览器兜底的最大次数 |
| `TRACKED_TOPIC_BROWSER_FALLBACK_LIMIT` | `1` | 每轮帖子追踪允许触发浏览器兜底的最大次数 |
| `PLAYWRIGHT_FAILURE_THRESHOLD` | `3` | Playwright 连续失败多少次后开启熔断 |
| `PLAYWRIGHT_COOLDOWN_MS` | `300000` | Playwright 熔断冷却时间（ms） |
| `PLAYWRIGHT_HEADLESS` | `true` | Playwright 无头模式 |
| `TELEGRAM_WEBHOOK_URL` | 空字符串 | 可选覆盖 Webhook URL |
| `LOG_LEVEL` | `info` | 日志级别 |

如果你要修改部署参数，直接编辑：

1. `docker-compose.yml`

## 数据与日志目录

Compose 默认挂载：

1. `./data` -> `/usr/src/app/data`
2. `./logs` -> `/usr/src/app/logs`

建议你在部署目录下提前创建这两个目录。

## Playwright 兜底说明

镜像中已经包含 Playwright Chromium 所需依赖。

当普通 RSS 抓取失败时，服务会自动尝试：

1. 启动 Playwright Chromium
2. 使用浏览器方式访问 RSS 地址
3. 再按原有 XML 解析逻辑处理结果

如果你不希望启用兜底，直接把 `docker-compose.yml` 中的：

```yaml
RSS_PLAYWRIGHT_FALLBACK: true
```

改成：

```yaml
RSS_PLAYWRIGHT_FALLBACK: false
```

当前 Compose 还额外启用了：

1. `shm_size: "1gb"`，降低 Chromium 在容器内因共享内存不足而崩溃的概率
2. `ulimits.core: 0`，避免原生进程崩溃时持续生成 `core.*` 文件占满磁盘

如果你需要进一步降低风险，建议优先尝试：

1. `RSS_ARTICLE_BODY_ENRICHMENT_ENABLED=false`
2. `TRACKED_TOPIC_FETCH_ENABLED=false`
3. `AI_SUMMARY_ENABLED=false`

## 常用命令

### 启动

```bash
docker compose up -d
```

### 拉取最新镜像并重建容器

```bash
docker compose pull
docker compose up -d
```

### 查看状态

```bash
docker compose ps
```

### 查看日志

```bash
docker compose logs -f nodeseeker
```

### 停止服务

```bash
docker compose down
```

## 故障排除

### 1. 容器无法启动

```bash
docker compose logs nodeseeker
```

重点检查：

1. `./data` 目录是否可写
2. 端口 `3010` 是否被占用
3. `docker-compose.yml` 中的参数是否写错

### 2. RSS 抓取失败

重点检查：

1. RSS 源是否可访问
2. 网络或代理是否异常
3. Playwright fallback 是否启用

### 3. 拉不到镜像

确认以下镜像是否存在：

```text
ghcr.io/planetsider/nodeseeker-docker:latest
```

如果镜像不可见，先确认 GitHub Actions 是否已经成功发布镜像。

## 备份建议

直接备份宿主机目录即可：

1. `./data`
2. `./logs`

例如：

```bash
tar czf nodeseeker-backup.tar.gz data logs
```
