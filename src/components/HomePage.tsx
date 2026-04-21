import type { FC } from "hono/jsx";
import { Layout } from "./Layout";

export const HomePage: FC = () => {
  return (
    <Layout
      title="NodeSeeker"
      description="NodeSeek RSS 文章列表"
      scriptSrc="/js/home.js"
    >
      <div class="home-container">
        {/* 顶部导航栏 */}
        <header class="home-header">
          <a href="/" class="header-logo">
            <span class="logo-icon">📡</span>
            <span class="logo-text">NodeSeeker</span>
          </a>
          <div class="header-actions">
            <button id="themeToggleBtn" class="icon-btn" title="切换主题">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
              </svg>
            </button>
            {/* 登录按钮 - 未登录时显示 */}
            <button id="loginBtn" class="icon-btn" title="登录" style="display: none;">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
            </button>
            {/* 设置下拉菜单 - 登录时显示 */}
            <div class="dropdown" id="settingsDropdown" style="display: none;">
              <button id="settingsBtn" class="icon-btn" title="设置">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/>
                </svg>
              </button>
              <div class="dropdown-menu">
                <button class="dropdown-item" data-drawer="stats">
                  <span>📊</span> 统计信息
                </button>
                <button class="dropdown-item" data-drawer="subscriptions">
                  <span>📝</span> 订阅管理
                </button>
                <button class="dropdown-item" data-drawer="trackedTopics">
                  <span>🧵</span> 追踪列表
                </button>
                <button class="dropdown-item" data-drawer="rss">
                  <span>📡</span> RSS 配置
                </button>
                <button class="dropdown-item" data-drawer="telegram">
                  <span>🤖</span> Telegram
                </button>
                <button class="dropdown-item" data-drawer="feishu">
                  <span>🪶</span> 飞书
                </button>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item text-danger" id="logoutBtn">
                  <span>🚪</span> 退出登录
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* 主内容区 - 统一宽度 */}
        <div class="content-wrapper">
          {/* 搜索框 居中 */}
          <div class="search-area">
            <div class="search-box">
              <svg class="search-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
              </svg>
              <input
                type="text"
                id="searchInput"
                placeholder="搜索标题、作者..."
                class="search-input"
              />
              <button id="clearSearchBtn" class="search-clear" style="display: none;">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                </svg>
              </button>
            </div>
          </div>

          {/* 工具栏 */}
          <div class="toolbar">
            <div class="toolbar-left">
              {/* 只看订阅 - 登录时显示 */}
              <div class="toggle-chip" id="subscribedOnlyChip" role="button" tabindex={0} style="display: none;">
                <span class="toggle-chip-label">只看订阅</span>
              </div>
              <button id="filterToggleBtn" class="filter-toggle-btn" title="更多筛选">
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fill-rule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clip-rule="evenodd"/>
                </svg>
                <span>筛选</span>
              </button>
            </div>
            <div class="toolbar-right">
              <button id="refreshBtn" class="btn btn-icon" title="刷新">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
                </svg>
              </button>
            </div>
          </div>

          {/* 可折叠筛选面板 */}
          <div id="filterPanel" class="filter-panel" style="display: none;">
            <div class="filter-panel-inner">
              <select id="filterCategory" class="filter-select">
                <option value="">全部分类</option>
                <option value="daily">日常</option>
                <option value="tech">技术</option>
                <option value="info">情报</option>
                <option value="review">测评</option>
                <option value="trade">交易</option>
                <option value="carpool">拼车</option>
                <option value="promotion">推广</option>
                <option value="life">生活</option>
                <option value="dev">Dev</option>
                <option value="expose">曝光</option>
                <option value="inside">内版</option>
                <option value="sandbox">沙盒</option>
              </select>
              {/* 订阅筛选 - 登录时显示 */}
              <select id="filterSubscription" class="filter-select" style="display: none;">
                <option value="">全部订阅</option>
              </select>
              <input type="text" id="filterCreator" placeholder="作者筛选" class="filter-input" />
              <button id="clearFiltersBtn" class="btn btn-text">清除筛选</button>
            </div>
          </div>

          {/* 帖子列表 */}
          <div id="postsList" class="posts-list">
            {/* 骨架屏 */}
            <div class="skeleton-wrapper">
              {[1, 2, 3, 4, 5].map(() => (
                <div class="skeleton-card post-skeleton">
                  <div class="skeleton skeleton-title"></div>
                  <div class="skeleton skeleton-line"></div>
                  <div class="skeleton skeleton-line" style={{ width: "60%" }}></div>
                  <div class="skeleton-meta">
                    <div class="skeleton skeleton-badge"></div>
                    <div class="skeleton skeleton-badge"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 空状态 */}
          <div id="emptyState" class="empty-state" style="display: none;">
            <div class="empty-icon">📰</div>
            <div class="empty-title">暂无文章</div>
            <div class="empty-desc">点击右上角"抓取 RSS"按钮获取最新文章</div>
          </div>

          {/* 分页 */}
          <div id="pagination" class="pagination-wrapper" style="display: none;">
            <div class="pagination-controls">
              {/* 首页 */}
              <button id="firstPageBtn" class="pagination-btn icon-only" title="首页" disabled>
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fill-rule="evenodd" d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 010 1.414zm-6 0a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 1.414L5.414 10l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/>
                </svg>
              </button>
              {/* 上一页 */}
              <button id="prevPageBtn" class="pagination-btn icon-only" title="上一页" disabled>
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
              </button>
              {/* 页码 */}
              <div id="pageNumbers" class="page-numbers"></div>
              {/* 下一页 */}
              <button id="nextPageBtn" class="pagination-btn icon-only" title="下一页" disabled>
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
                </svg>
              </button>
            </div>
            <div class="pagination-info">
              <span id="paginationInfo">1 / 1</span>
            </div>
          </div>
        </div>
      </div>

      {/* 抽屉遮罩 */}
      <div id="drawerOverlay" class="drawer-overlay" style="display: none;"></div>

      {/* 订阅管理抽屉 */}
      <div id="subscriptionsDrawer" class="drawer drawer-large" style="display: none;">
        <div class="drawer-header">
          <h3 class="drawer-title">订阅管理</h3>
          <button class="drawer-close" data-drawer="subscriptions">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>
        <div class="drawer-content">
          {/* 添加订阅表单 */}
          <form id="addSubForm" class="sub-form">
            {/* 第一行：关键词 */}
            <div class="sub-form-row">
              <div class="sub-keywords-inputs">
                <input type="text" id="keyword1" class="input-field" placeholder="关键词1" />
                <input type="text" id="keyword2" class="input-field" placeholder="关键词2" />
                <input type="text" id="keyword3" class="input-field" placeholder="关键词3" />
              </div>
            </div>
            {/* 第二行：作者和分类 */}
            <div class="sub-form-row">
              <div class="sub-form-group">
                <label class="sub-form-label">作者</label>
                <input type="text" id="subCreator" class="input-field" placeholder="作者名" />
              </div>
              <div class="sub-form-group">
                <label class="sub-form-label">分类</label>
                <select id="subCategory" class="input-field">
                  <option value="">全部</option>
                  <option value="daily">日常</option>
                  <option value="tech">技术</option>
                  <option value="info">情报</option>
                  <option value="review">测评</option>
                  <option value="trade">交易</option>
                  <option value="carpool">拼车</option>
                  <option value="promotion">推广</option>
                  <option value="life">生活</option>
                  <option value="dev">Dev</option>
                  <option value="expose">曝光</option>
                  <option value="inside">内版</option>
                  <option value="sandbox">沙盒</option>
                </select>
              </div>
            </div>
            {/* 第三行：添加按钮 */}
            <div class="sub-form-row sub-form-row-action">
              <button type="submit" class="btn btn-primary">添加订阅</button>
            </div>
          </form>

          {/* 订阅列表 */}
          <div id="subscriptionsList" class="subscriptions-list">
            <div class="skeleton-wrapper">
              {[1, 2, 3].map(() => (
                <div class="skeleton-list-item">
                  <div class="skeleton skeleton-badge"></div>
                  <div class="skeleton skeleton-line"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 追踪列表抽屉 */}
      <div id="trackedTopicsDrawer" class="drawer drawer-large" style="display: none;">
        <div class="drawer-header">
          <h3 class="drawer-title">追踪列表</h3>
          <button class="drawer-close" data-drawer="trackedTopics">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>
        <div class="drawer-content">
          <form id="trackedTopicForm" class="form-stack">
            <div class="form-group">
              <label for="trackedTopicInput" class="form-label">帖子 ID 或链接</label>
              <input type="text" id="trackedTopicInput" class="input-field" placeholder="694190 或 https://www.nodeseek.com/post-694190-1" />
              <span class="form-hint">添加后系统会持续检查该帖子的后续跟帖更新，并通过当前启用的推送通道发送通知。</span>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">开始追踪</button>
            </div>
          </form>

          <div class="form-group" style={{ marginTop: "20px" }}>
            <label for="trackedTopicsSearch" class="form-label">搜索追踪列表</label>
            <input type="text" id="trackedTopicsSearch" class="input-field" placeholder="按标题、Track ID、最近回复作者或内容搜索" />
          </div>

          <div id="trackedTopicsList" class="subscriptions-list" style={{ marginTop: "20px" }}>
            <div class="skeleton-wrapper">
              {[1, 2, 3].map(() => (
                <div class="skeleton-list-item">
                  <div class="skeleton skeleton-badge"></div>
                  <div class="skeleton skeleton-line"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* RSS 配置抽屉 */}
      <div id="rssDrawer" class="drawer" style="display: none;">
        <div class="drawer-header">
          <h3 class="drawer-title">RSS 配置</h3>
          <button class="drawer-close" data-drawer="rss">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>
        <div class="drawer-content">
          <form id="rssConfigForm" class="form-stack">
            <div class="form-group">
              <label for="rssUrl" class="form-label">RSS 源地址</label>
              <input type="url" id="rssUrl" class="input-field" placeholder="https://rss.nodeseek.com/" />
              <span class="form-hint">支持标准的 RSS/Atom 格式</span>
            </div>
            <div class="form-group">
              <label for="rssInterval" class="form-label">抓取间隔（秒）</label>
              <input type="number" id="rssInterval" class="input-field" min="10" max="3600" placeholder="60" />
              <span class="form-hint">最小 10 秒，建议 60 秒以上</span>
            </div>
            <div class="form-group">
              <label for="rssProxy" class="form-label">代理地址（可选）</label>
              <input type="text" id="rssProxy" class="input-field" placeholder="http://127.0.0.1:7890" />
              <span class="form-hint">HTTP/HTTPS 代理，留空则不使用代理</span>
            </div>
            <div class="form-group">
              <label for="rssCookie" class="form-label">抓取 Cookie（可选）</label>
              <textarea id="rssCookie" class="input-field" rows={5} placeholder="填写用于抓取 NodeSeek 的 Cookie"></textarea>
              <span class="form-hint">配置后，RSS 抓取和 Playwright 兜底都会自动带上该 Cookie。Cookie 疑似过期时会通过已启用通知通道发送告警。</span>
            </div>
            <div class="form-group">
              <div class="checkbox-wrapper">
                <input type="checkbox" id="aiEnabled" />
                <div class="checkbox-content">
                  <div class="checkbox-label">启用 AI 总结</div>
                  <div class="checkbox-description">抓取文章正文后，调用兼容 OpenAI Chat Completions 的接口生成摘要，并附加到通知内容</div>
                </div>
              </div>
            </div>
            <div class="form-group">
              <label for="aiApiUrl" class="form-label">AI API URL</label>
              <input type="url" id="aiApiUrl" class="input-field" placeholder="https://your-api.example.com/v1/chat/completions" />
            </div>
            <div class="form-group">
              <label for="aiApiKey" class="form-label">AI API Key</label>
              <input type="password" id="aiApiKey" class="input-field" placeholder="sk-..." />
            </div>
            <div class="form-group">
              <label for="aiModel" class="form-label">AI 模型</label>
              <input type="text" id="aiModel" class="input-field" placeholder="gpt-4o-mini" />
            </div>
            <div class="form-group">
              <label for="aiPrompt" class="form-label">总结提示词（可选）</label>
              <textarea id="aiPrompt" class="input-field" rows={4} placeholder="留空则使用默认中文总结提示词"></textarea>
              <span class="form-hint">需要兼容 OpenAI 的 `/v1/chat/completions` 响应格式。</span>
            </div>
            <div class="form-actions">
              <button type="button" id="testRssBtn" class="btn btn-secondary">
                测试连接
              </button>
              <button type="button" id="testAiBtn" class="btn btn-secondary">
                测试 AI 总结
              </button>
              <button type="submit" class="btn btn-primary">
                保存配置
              </button>
            </div>
          </form>
          <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border-light);">
            <button id="fetchRssBtn" class="btn btn-primary" style="width: 100%;">
              立即抓取 RSS
            </button>
          </div>
        </div>
      </div>

      {/* 飞书配置抽屉 */}
      <div id="feishuDrawer" class="drawer" style="display: none;">
        <div class="drawer-header">
          <h3 class="drawer-title">飞书配置</h3>
          <button class="drawer-close" data-drawer="feishu">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>
        <div class="drawer-content">
          <div class="form-card">
            <h4 class="form-section-title">🪶 命令通道总览</h4>
            <div class="info-grid">
              <div class="info-item">
                <strong>飞书状态:</strong> <span id="overviewFeishuStatus">-</span>
              </div>
              <div class="info-item">
                <strong>飞书配置:</strong> <span id="overviewFeishuConfigStatus">-</span>
              </div>
              <div class="info-item">
                <strong>飞书绑定:</strong> <span id="overviewFeishuBindingStatus">-</span>
              </div>
              <div class="info-item">
                <strong>飞书最近测试:</strong> <span id="overviewFeishuLastTest">-</span>
              </div>
              <div class="info-item">
                <strong>飞书最近发送:</strong> <span id="overviewFeishuLastSend">-</span>
              </div>
              <div class="info-item" style={{ gridColumn: "1 / -1" }}>
                <strong>飞书最近错误:</strong> <span id="overviewFeishuLastError">-</span>
              </div>
            </div>
          </div>

          <div class="form-card" style={{ marginTop: "24px" }}>
            <h4 class="form-section-title">⚙️ 飞书应用配置</h4>
            <form id="feishuConfigForm" class="form-stack">
              <div class="form-group">
                <div class="checkbox-wrapper">
                  <input type="checkbox" id="feishuEnabled" />
                  <div class="checkbox-content">
                    <div class="checkbox-label">启用飞书命令通道</div>
                    <div class="checkbox-description">飞书只接收命令，不直接接收 RSS 推送通知</div>
                  </div>
                </div>
              </div>
              <div class="form-group">
                <label for="feishuAppId" class="form-label">App ID</label>
                <input type="text" id="feishuAppId" class="input-field" placeholder="cli_xxx" />
              </div>
              <div class="form-group">
                <label for="feishuAppSecret" class="form-label">App Secret</label>
                <input type="password" id="feishuAppSecret" class="input-field" placeholder="应用密钥" />
              </div>
              <div class="form-group">
                <label for="feishuVerificationToken" class="form-label">Verification Token</label>
                <input type="text" id="feishuVerificationToken" class="input-field" placeholder="事件订阅验证 Token" />
              </div>
              <div class="form-group">
                <label for="feishuWebhookUrl" class="form-label">Webhook 地址</label>
                <input type="text" id="feishuWebhookUrl" class="input-field" readonly value="/feishu/webhook" />
                <span class="form-hint">在飞书事件订阅中配置该回调地址，文本消息命令会通过此地址进入系统。</span>
              </div>
              <div class="form-group">
                <label for="feishuBoundChatId" class="form-label">已绑定会话</label>
                <input type="text" id="feishuBoundChatId" class="input-field" readonly placeholder="发送 /start 后自动绑定" />
              </div>
              <div class="form-actions">
                <button type="button" id="testFeishuBtn" class="btn btn-secondary">
                  测试连接
                </button>
                <button type="submit" class="btn btn-primary">
                  保存配置
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Telegram 配置抽屉 */}
      <div id="telegramDrawer" class="drawer drawer-large" style="display: none;">
        <div class="drawer-header">
          <h3 class="drawer-title">Telegram 配置</h3>
          <button class="drawer-close" data-drawer="telegram">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>
        <div class="drawer-content">
          <div class="form-card">
            <h4 class="form-section-title">🔔 通知通道总览</h4>
            <div class="info-grid">
              <div class="info-item">
                <strong>Telegram:</strong> <span id="overviewTelegramStatus">-</span>
              </div>
              <div class="info-item">
                <strong>Telegram 配置:</strong> <span id="overviewTelegramConfigStatus">-</span>
              </div>
              <div class="info-item">
                <strong>Telegram 最近测试:</strong> <span id="overviewTelegramLastTest">-</span>
              </div>
              <div class="info-item">
                <strong>Telegram 最近发送:</strong> <span id="overviewTelegramLastSend">-</span>
              </div>
              <div class="info-item" style={{ gridColumn: "1 / -1" }}>
                <strong>Telegram 最近错误:</strong> <span id="overviewTelegramLastError">-</span>
              </div>
              <div class="info-item">
                <strong>Server酱:</strong> <span id="overviewServerchanStatus">-</span>
              </div>
              <div class="info-item">
                <strong>Server酱 配置:</strong> <span id="overviewServerchanConfigStatus">-</span>
              </div>
              <div class="info-item">
                <strong>Server酱 最近测试:</strong> <span id="overviewServerchanLastTest">-</span>
              </div>
              <div class="info-item">
                <strong>Server酱 最近发送:</strong> <span id="overviewServerchanLastSend">-</span>
              </div>
              <div class="info-item" style={{ gridColumn: "1 / -1" }}>
                <strong>Server酱 最近错误:</strong> <span id="overviewServerchanLastError">-</span>
              </div>
              <div class="info-item">
                <strong>MeoW:</strong> <span id="overviewMeowStatus">-</span>
              </div>
              <div class="info-item">
                <strong>MeoW 配置:</strong> <span id="overviewMeowConfigStatus">-</span>
              </div>
              <div class="info-item">
                <strong>MeoW 最近测试:</strong> <span id="overviewMeowLastTest">-</span>
              </div>
              <div class="info-item">
                <strong>MeoW 最近发送:</strong> <span id="overviewMeowLastSend">-</span>
              </div>
              <div class="info-item" style={{ gridColumn: "1 / -1" }}>
                <strong>MeoW 最近错误:</strong> <span id="overviewMeowLastError">-</span>
              </div>
            </div>
          </div>

          {/* 推送服务配置 */}
          <div class="form-card">
            <h4 class="form-section-title">🚀 推送服务配置</h4>
            <form id="telegramConfigForm" class="form-stack">
              <div class="form-group">
                <label for="botToken" class="form-label">Bot Token</label>
                <input type="text" id="botToken" class="input-field" placeholder="从 @BotFather 获取" />
                <span class="form-hint">格式: 123456:ABC-DEF...</span>
              </div>
              <div class="form-group">
                <label for="chatId" class="form-label">用户 Chat ID</label>
                <input type="text" id="chatId" class="input-field" placeholder="用户或群组的 Chat ID" />
                <span class="form-hint">可通过 /start 命令自动获取（需开启交互服务）</span>
              </div>
              <div class="form-group">
                <div class="checkbox-wrapper">
                  <input type="checkbox" id="stopPush" />
                  <div class="checkbox-content">
                    <div class="checkbox-label">停止推送</div>
                    <div class="checkbox-description">暂停所有 Telegram 消息推送</div>
                  </div>
                </div>
              </div>
              <div class="form-group">
                <div class="checkbox-wrapper">
                  <input type="checkbox" id="onlyTitle" />
                  <div class="checkbox-content">
                    <div class="checkbox-label">仅匹配标题</div>
                    <div class="checkbox-description">只在文章标题中搜索关键词</div>
                  </div>
                </div>
              </div>
              <div class="form-actions">
                <button type="button" id="testTelegramBtn" class="btn btn-secondary">
                  测试连接
                </button>
                <button type="submit" class="btn btn-primary">
                  保存配置
                </button>
              </div>
            </form>
          </div>

          {/* 交互服务配置 */}
          <div class="form-card" style={{ marginTop: "24px" }}>
            <h4 class="form-section-title">🔗 交互服务配置（可选）</h4>
            <div class="form-hint" style={{ background: "var(--bg-primary)", padding: "12px", borderRadius: "8px", marginBottom: "16px" }}>
              <strong>说明：</strong>交互服务允许通过 Telegram Bot 命令管理订阅、查看文章等。
              可以选择 Webhook 模式（需要 HTTPS 公网域名）或 Polling 模式（无需公网，适合内网部署）。
            </div>
            {/* 模式选择 */}
            <div class="form-group" style={{ marginBottom: "16px" }}>
              <label class="form-label">交互模式</label>
              <div class="mode-selector" id="telegramModeSelector">
                <label class="mode-option">
                  <input type="radio" name="telegramMode" value="disabled" checked />
                  <span class="mode-label">🚫 关闭</span>
                </label>
                <label class="mode-option">
                  <input type="radio" name="telegramMode" value="polling" />
                  <span class="mode-label">🔄 Polling</span>
                </label>
                <label class="mode-option">
                  <input type="radio" name="telegramMode" value="webhook" />
                  <span class="mode-label">🔗 Webhook</span>
                </label>
              </div>
            </div>
            {/* Webhook 模式内容 */}
            <div id="webhookModePanel" style="display: none;">
              <form id="webhookConfigForm" class="form-stack">
                <div class="form-group">
                  <label for="webhookUrl" class="form-label">Webhook URL</label>
                  <input type="url" id="webhookUrl" class="input-field" placeholder="https://your-domain.com/telegram/webhook" />
                  <span class="form-hint">需要 HTTPS，用于接收 Telegram 命令</span>
                </div>
                <div class="form-actions">
                  <button type="button" id="testWebhookBtn" class="btn btn-secondary">
                    测试连接
                  </button>
                  <button type="button" id="clearWebhookBtn" class="btn btn-danger">
                    清除 Webhook
                  </button>
                  <button type="submit" class="btn btn-primary">
                    设置 Webhook
                  </button>
                </div>
              </form>
            </div>
            {/* Polling 模式内容 */}
            <div id="pollingModePanel" style="display: none;">
              <div class="form-hint" style={{ background: "var(--bg-primary)", padding: "12px", borderRadius: "8px", marginBottom: "12px" }}>
                Polling 模式不需要公网域名，服务会主动向 Telegram 服务器轮询消息。适合内网或 NAT 环境。
              </div>
              <div id="pollingStatusIndicator" class="form-hint" style={{ padding: "10px 12px", borderRadius: "8px", marginBottom: "12px", background: "var(--bg-hover)", fontWeight: "500" }}>
                ⏹️ Polling 未运行
              </div>
              <div class="form-actions">
                <button type="button" id="startPollingBtn" class="btn btn-primary">
                  ▶️ 启动 Polling
                </button>
                <button type="button" id="stopPollingBtn" class="btn btn-danger" style="display: none;">
                  ⏹️ 停止 Polling
                </button>
              </div>
            </div>
          </div>

          {/* 状态信息 */}
          <div id="telegramStatusPanel" class="form-card" style={{ marginTop: "24px", display: "none" }}>
            <h4 class="form-section-title">📊 服务状态</h4>
            <div class="info-grid">
              <div class="info-item">
                <strong>Bot 状态:</strong> <span id="telegramBotStatus">-</span>
              </div>
              <div class="info-item">
                <strong>Webhook 状态:</strong> <span id="telegramWebhookStatus">-</span>
              </div>
              <div class="info-item">
                <strong>用户绑定:</strong> <span id="telegramBindingStatus">-</span>
              </div>
            </div>
          </div>

          <div class="form-card" style={{ marginTop: "24px" }}>
            <h4 class="form-section-title">📨 Server酱 推送</h4>
            <div class="info-grid" style={{ marginBottom: "16px" }}>
              <div class="info-item">
                <strong>通道状态:</strong> <span id="serverchanStatus">-</span>
              </div>
              <div class="info-item">
                <strong>配置完整:</strong> <span id="serverchanConfigStatus">-</span>
              </div>
            </div>
            <form id="serverChanConfigForm" class="form-stack">
              <div class="form-group">
                <div class="checkbox-wrapper">
                  <input type="checkbox" id="serverchanEnabled" />
                  <div class="checkbox-content">
                    <div class="checkbox-label">启用 Server酱 推送</div>
                    <div class="checkbox-description">匹配到订阅后，额外通过 Server酱 发送通知</div>
                  </div>
                </div>
              </div>
              <div class="form-group">
                <label for="serverchanUid" class="form-label">UID</label>
                <input type="text" id="serverchanUid" class="input-field" placeholder="Server酱 UID" />
              </div>
              <div class="form-group">
                <label for="serverchanSendkey" class="form-label">SendKey</label>
                <input type="text" id="serverchanSendkey" class="input-field" placeholder="Server酱 SendKey" />
              </div>
              <div class="form-actions">
                <button type="button" id="testServerChanBtn" class="btn btn-secondary">
                  测试发送
                </button>
              </div>
            </form>
          </div>

          <div class="form-card" style={{ marginTop: "24px" }}>
            <h4 class="form-section-title">🐱 MeoW 推送</h4>
            <div class="info-grid" style={{ marginBottom: "16px" }}>
              <div class="info-item">
                <strong>通道状态:</strong> <span id="meowStatus">-</span>
              </div>
              <div class="info-item">
                <strong>配置完整:</strong> <span id="meowConfigStatus">-</span>
              </div>
            </div>
            <form id="meowConfigForm" class="form-stack">
              <div class="form-group">
                <div class="checkbox-wrapper">
                  <input type="checkbox" id="meowEnabled" />
                  <div class="checkbox-content">
                    <div class="checkbox-label">启用 MeoW 推送</div>
                    <div class="checkbox-description">匹配到订阅后，额外通过 MeoW 发送 POST 通知</div>
                  </div>
                </div>
              </div>
              <div class="form-group">
                <label for="meowEndpoint" class="form-label">接口地址</label>
                <input type="text" id="meowEndpoint" class="input-field" placeholder="https://api.chuckfang.com" />
                <span class="form-hint">留空时默认使用 https://api.chuckfang.com</span>
              </div>
              <div class="form-group">
                <label for="meowNickname" class="form-label">昵称</label>
                <input type="text" id="meowNickname" class="input-field" placeholder="MeoW 用户昵称" />
              </div>
              <div class="form-actions">
                <button type="button" id="testMeowBtn" class="btn btn-secondary">
                  测试发送
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* 统计信息抽屉 */}
      <div id="statsDrawer" class="drawer drawer-large" style="display: none;">
        <div class="drawer-header">
          <h3 class="drawer-title">统计信息</h3>
          <button class="drawer-close" data-drawer="stats">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>
        <div class="drawer-content">
          {/* 数字统计卡片 */}
          <div class="stats-grid-simple">
            <div class="stat-card-simple">
              <span class="stat-value" id="drawerStatTodayPushed">0</span>
              <span class="stat-label">今日匹配</span>
            </div>
            <div class="stat-card-simple">
              <span class="stat-value" id="drawerStatTodayPosts">0</span>
              <span class="stat-label">今日帖子</span>
            </div>
            <div class="stat-card-simple">
              <span class="stat-value" id="drawerStatPushed">0</span>
              <span class="stat-label">历史匹配</span>
            </div>
            <div class="stat-card-simple">
              <span class="stat-value" id="drawerStatTotalPosts">0</span>
              <span class="stat-label">历史帖子</span>
            </div>
          </div>

          {/* 最近 24小时发帖趋势 */}
          <div class="chart-section">
            <div class="chart-section-title">最近 24小时发帖趋势</div>
            <div id="hourlyChart" class="hourly-chart">
              {/* 加载占位 */}
              {[...Array(24)].map((_, i) => (
                <div class="hourly-bar-wrap">
                  <div class="hourly-bar zero-bar" style={{ height: '2px' }}></div>
                </div>
              ))}
            </div>
          </div>

          {/* 分类分布 */}
          <div class="chart-section">
            <div class="chart-section-title">分类分布</div>
            <div id="categoryChart" class="category-chart">
              <div class="chart-empty">加载中...</div>
            </div>
          </div>

          {/* 时间范围选择器 (移至底部) */}
          <div class="chart-range-selector" id="chartRangeSelector">
            <button class="chart-range-btn active" data-days="-1">今日</button>
            <button class="chart-range-btn" data-days="7">近 7 天</button>
            <button class="chart-range-btn" data-days="30">近 30 天</button>
            <button class="chart-range-btn" data-days="0">全部</button>
          </div>
        </div>
      </div>

      {/* 登录抽屉 */}
      <div id="loginModal" class="drawer" style="display: none;">
        <div class="drawer-header">
          <h3 class="drawer-title">用户登录</h3>
          <button id="closeLoginModal" class="drawer-close" data-drawer="login">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>
        <div class="drawer-content">
          <form id="loginForm" class="form-stack">
            <div class="form-group">
              <label for="loginUsername" class="form-label">用户名</label>
              <input
                type="text"
                id="loginUsername"
                class="input-field"
                placeholder="请输入用户名"
                required
              />
            </div>
            <div class="form-group">
              <label for="loginPassword" class="form-label">密码</label>
              <input
                type="password"
                id="loginPassword"
                class="input-field"
                placeholder="请输入密码"
                required
              />
            </div>
            <div id="loginMessage" class="login-message" style="display: none;"></div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary" style="width: 100%;">
                登录
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Toast 容器 */}
      <div id="toastContainer" class="toast-container"></div>
    </Layout>
  );
};
