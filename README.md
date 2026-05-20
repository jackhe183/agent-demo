# 🤖 Agent Demo

基于 DeepSeek API 的智能助手，支持工具调用、记忆压缩，可部署至 Cloudflare Workers。

## 技术栈

- **运行时**: Bun (开发) / Cloudflare Workers (部署)
- **语言**: TypeScript
- **AI**: DeepSeek Chat API (OpenAI 兼容格式)
- **前端**: 原生 HTML + JavaScript（无框架）

## 文件结构

```
agent-demo/
├── worker.ts          # Workers 主文件（部署用）
├── server.ts          # Bun 本地开发版
├── skills.ts          # 工具函数定义
├── public/
│   └── index.html     # 前端聊天界面
├── wrangler.toml      # Workers 配置
└── package.json
```

## 本地开发

### 1. 安装 Bun

```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# Windows (PowerShell)
irm bun.sh/install.ps1 | iex
```

### 2. 安装依赖

```bash
bun install
```

### 3. 启动本地服务

```bash
bun run server.ts
```

访问 http://localhost:3000

---

## 部署到 Cloudflare Workers

### 1. 安装 Wrangler CLI

```bash
npm install -g wrangler
```

### 2. 登录 Cloudflare

```bash
wrangler login
```

### 3. 设置 DeepSeek API Key

```bash
wrangler secret put DEEPSEEK_API_KEY
# 输入你的 DeepSeek API Key
```

### 4. 部署

```bash
wrangler deploy
```

部署成功后获得：`https://agent-demo.<your-subdomain>.workers.dev`

---

## API 使用

### 聊天接口

```
POST /chat
Content-Type: application/json

{
  "message": "杭州天气怎么样？",
  "history": []
}
```

**响应：**

```json
{
  "reply": "杭州今天天气晴朗，气温22°C，适合外出。"
}
```

**JavaScript 调用示例：**

```javascript
const res = await fetch("/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: "杭州天气怎么样？", history: [] }),
});
const { reply } = await res.json();
console.log(reply);
```

---

## 可用工具

| 工具名 | 参数 | 说明 |
|--------|------|------|
| `get_weather` | `city` | 查询城市天气 |
| `save_note` | `content` | 保存笔记（限200字） |

---

## 项目初始化

```bash
bun init
```
