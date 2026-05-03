# NodeSeeker Docker

[![Docker Build](https://github.com/PlanetSider/nodeseeker-docker/actions/workflows/docker-build.yml/badge.svg)](https://github.com/PlanetSider/nodeseeker-docker/actions/workflows/docker-build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker Hub](https://img.shields.io/docker/v/ersichub/nodeseeker?label=Docker%20Hub)](https://hub.docker.com/r/ersichub/nodeseeker)
[![Bun](https://img.shields.io/badge/Bun-1.0+-ff69b4.svg)](https://bun.sh/)

基于 **Bun + Hono.js + SQLite** 的 NodeSeek 社区 RSS 监控与多通道通知系统，支持 Telegram、Server酱 和 MeoW 推送。

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 🔄 自动 RSS 抓取 | 定时抓取 NodeSeek 社区 RSS，支持自定义间隔、代理与 Playwright 兜底 |
| 🎯 智能关键词匹配 | 多关键词组合 + 正则表达式，按创建者/分类过滤 |
| 📱 多通道通知 | Telegram、Server酱、MeoW 推送，支持独立开关与测试发送 |
| 🌐 Web 控制台 | RESTful API + 可视化管理界面 |
| 🔐 安全认证 | Session 认证 + 密码加密存储 |
| 📊 实时统计 | 推送统计与系统监控 |
| 🩺 健康面板 | 展示最近测试结果、最近发送时间、最近错误信息 |
| 📲 PWA 支持 | 离线访问、安装到桌面、推送通知 |

## 🚀 快速开始

### Docker 部署（推荐）

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
  -e PLAYWRIGHT_MAX_CONCURRENCY=1 \
  -e PLAYWRIGHT_HEADLESS=true \
  -e TELEGRAM_WEBHOOK_URL= \
  -e LOG_LEVEL=info \
  ghcr.io/planetsider/nodeseeker-docker:latest
```

访问 http://localhost:3010，首次使用时创建管理员账户即可。

### Docker Compose

```bash
git clone https://github.com/PlanetSider/nodeseeker-docker.git
cd nodeseeker-docker

# 直接拉取并启动镜像
docker compose up -d
```

默认镜像：`ghcr.io/planetsider/nodeseeker-docker:latest`

### 本地开发

```bash
# 安装依赖（需要 Bun 1.0+）
bun install

# 启动开发服务器（热重载）
bun run dev
```

<details>
<summary>更多开发命令</summary>

```bash
bun run dev          # 开发模式（热重载）
bun run build        # 构建项目
bun run start        # 生产模式
bun run db:migrate   # 数据库迁移
bun test             # 运行测试
```

</details>

## ⚙️ 配置

默认 `docker-compose.yml` 已经把运行参数直接写在文件里，开箱即用。

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3010` | 服务端口 |
| `HOST` | `0.0.0.0` | 监听地址 |
| `CORS_ORIGINS` | `http://localhost:3010` | 允许的跨域源 |
| `RSS_CHECK_ENABLED` | `true` | 是否启用定时抓取 |
| `RSS_ARTICLE_BODY_ENRICHMENT_ENABLED` | `true` | 是否启用文章正文增强；关闭后跳过正文抓取和基于正文的 AI 摘要 |
| `TRACKED_TOPIC_FETCH_ENABLED` | `true` | 是否启用追踪帖子抓取检查 |
| `AI_SUMMARY_ENABLED` | `true` | 是否启用 AI 摘要生成 |
| `RSS_TIMEOUT` | `10000` | RSS 请求超时（ms） |
| `RSS_PLAYWRIGHT_FALLBACK` | `true` | 普通 RSS 抓取失败时，是否启用 Playwright 浏览器兜底 |
| `RSS_ARTICLE_BROWSER_FALLBACK_LIMIT` | `1` | 每轮 RSS 新文章正文允许触发浏览器兜底的最大次数 |
| `TRACKED_TOPIC_BROWSER_FALLBACK_LIMIT` | `1` | 每轮帖子追踪允许触发浏览器兜底的最大次数 |
| `PLAYWRIGHT_FAILURE_THRESHOLD` | `3` | Playwright 连续失败多少次后开启熔断 |
| `PLAYWRIGHT_COOLDOWN_MS` | `300000` | Playwright 熔断冷却时间（ms） |
| `PLAYWRIGHT_MAX_CONCURRENCY` | `1` | Playwright 浏览器兜底允许的全局最大并发数 |
| `PLAYWRIGHT_HEADLESS` | `true` | Playwright 是否以无头模式运行 |
| `LOG_LEVEL` | `info` | 日志级别 |

> **RSS 源地址、抓取间隔、代理** 等配置已迁移到数据库，可在 Web 控制台 → **基础设置** 中动态修改。

当 RSS 源出现 TLS、反爬、连接中断等问题时，服务会在普通 `fetch` 抓取失败后自动尝试 Playwright 浏览器兜底，以提高抓取成功率。

如果你想进一步降低线上风险，可以直接关闭以下高负载功能：

1. `RSS_ARTICLE_BODY_ENRICHMENT_ENABLED=false`：关闭文章正文增强
2. `TRACKED_TOPIC_FETCH_ENABLED=false`：关闭追踪帖子抓取检查
3. `AI_SUMMARY_ENABLED=false`：关闭 AI 摘要生成

## 🐳 部署说明

当前仓库只保留一个 Compose 文件：`docker-compose.yml`

它会：

1. 直接拉取 `ghcr.io/planetsider/nodeseeker-docker:latest`
2. 将运行参数直接写在 `environment` 中
3. 挂载 `./data` 到容器数据库目录
4. 挂载 `./logs` 到容器日志目录
5. 暴露 `3010` 端口

## 🔧 初始化配置

1. 访问 http://localhost:3010，创建管理员账户
2. **配置通知通道**（可选）：
   - 在 Telegram 中通过 [@BotFather](https://t.me/BotFather) 创建 Bot 并获取 Token
   - 在控制台配置 Bot Token，向 Bot 发送 `/start` 完成绑定
   - 在控制台可额外配置 `Server酱` 的 `UID + SendKey`
   - 在控制台可额外配置 `MeoW` 的 `接口地址 + 昵称`
   - 三个通道都支持单独开关和测试发送
3. **配置 RSS 源**（可选）：
    - 控制台 → 基础设置 → RSS 抓取设置
    - 可修改源地址、间隔、代理，支持 **测试连接**

## 🔔 通知通道

当前支持 3 条通知通道，消息内容使用统一模板：

| 通道 | 配置项 | 发送方式 | 说明 |
|------|--------|----------|------|
| Telegram | `Bot Token`、`Chat ID` | Bot API | 支持交互命令、Webhook、Polling |
| Server酱 | `UID`、`SendKey` | `POST` JSON | 推送内容与 Telegram 一致 |
| MeoW | `接口地址`、`昵称` | `POST` JSON | 默认接口地址为 `https://api.chuckfang.com` |

管理界面中的 **通知通道总览** 会展示：

1. 通道启用状态
2. 配置完整性
3. 最近一次测试结果
4. 最近一次发送时间
5. 最近错误信息

## 🤖 Telegram Bot 命令

| 命令 | 说明 |
|------|------|
| `/start` | 绑定账户 |
| `/list` | 查看订阅列表 |
| `/add 关键词1 关键词2` | 添加订阅（最多 3 个关键词） |
| `/del 订阅ID` | 删除订阅 |
| `/post` | 查看最近文章 |
| `/stop` / `/resume` | 停止 / 恢复推送 |

<details>
<summary>关键词匹配格式</summary>

**普通字符串**：`JavaScript` — 匹配包含该文本的内容

**正则表达式**：
- `/javascript/i` — 不区分大小写
- `/\d{4}年/` — 匹配 4 位数字 + "年"
- `regex:新特性|特性` — `regex:` 前缀

```bash
# 示例
/add /javascript/i React       # 混合使用
/add regex:AI|人工智能 深度学习    # regex: 前缀
/add /\d+\.?\d*GB/ 内存         # 匹配规格
```

</details>

## 📁 项目结构

```
src/
├── config/          # 配置文件
├── components/      # React 组件
├── database/        # 数据库迁移
├── routes/          # API 路由
├── services/        # 业务逻辑服务
├── types/           # TypeScript 类型
└── utils/           # 工具函数
```

## 🔧 故障排除

| 问题 | 解决方案 |
|------|----------|
| 端口冲突 | 修改 `docker-compose.yml` 中的 `PORT` 和端口映射 |
| 数据库权限 | 确保 `data/` 目录有写权限 |
| Telegram Bot 无响应 | 检查 Token、Chat ID，并发送 `/start` 绑定 |
| Server酱 测试失败 | 检查 UID、SendKey 是否正确 |
| MeoW 测试失败 | 检查昵称、接口地址是否正确可达 |
| RSS 抓取失败 | 检查网络 / RSS 源可用性 / 代理设置 / Playwright 浏览器依赖是否完整 |
| RSS 配置不生效 | 修改间隔后点击 **重启任务** |

```bash
# 诊断命令
docker compose logs nodeseeker    # 查看日志
```

## 📚 更多文档

| 文档 | 说明 |
|------|------|
| [Docker 部署指南](docs/Docker.md) | 详细的 Docker / Compose / 生产部署说明 |
| [API 文档](API.md) | 完整的 RESTful API 接口文档 |
| [PWA 文档](PWA.md) | PWA 功能、离线缓存、推送通知 |
| [PWA 快速入门](PWA-QUICKSTART.md) | PWA 安装与验证 |

## 🙏 技术栈

[Bun](https://bun.sh/) · [Hono.js](https://hono.dev/) · [SQLite](https://sqlite.org/) · [grammY](https://grammy.dev/)

## 📄 许可证

[MIT](LICENSE)
