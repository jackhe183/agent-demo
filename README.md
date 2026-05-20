# Agent Demo

> 基于 DeepSeek 的 AI 助手，支持工具调用与上下文记忆，部署至 Cloudflare Workers。

## 快速开始

```bash
# 本地运行
bun install
bun run server.ts

# 部署到 Cloudflare
wrangler deploy
```

访问 http://localhost:3000 或 Workers 域名即可使用聊天界面。

---

## 工作原理

```
用户输入 → Agent Loop → DeepSeek API → 判断: 工具调用 / 直接回复
                              ↓
                        工具执行 (get_weather, save_note)
                              ↓
                        结果注入上下文 → 再次调用 DeepSeek
```

**Agent Loop 核心流程：**

1. 用户发送消息，拼接 [System Prompt + 历史压缩 + 用户消息]
2. 调用 DeepSeek，解析返回的 JSON 判断是否工具调用
3. 若调用工具，结果注入上下文，循环直到模型直接回复
4. 记忆压缩：超过 8 条消息时，保留摘要 + 最近 4 条

---

## 项目结构

```
agent-demo/
├── worker.ts          # Workers 部署入口 (export default fetch)
├── server.ts          # Bun 本地开发版
├── skills.ts          # 工具函数定义 (get_weather, save_note)
└── public/
    └── index.html     # 聊天界面 (内联在 worker.ts 用于 Workers 部署)
```

---

## 部署

### 前置要求

- [Bun](https://bun.sh) (本地开发)
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (部署)

### 步骤

```bash
# 1. 克隆项目
git clone https://github.com/jackhe183/agent-demo.git
cd agent-demo

# 2. 安装依赖
bun install

# 3. 登录 Cloudflare
wrangler login

# 4. 配置 API Key (替换为你的 DeepSeek Key)
wrangler secret put DEEPSEEK_API_KEY

# 5. 部署
wrangler deploy
```

部署成功后将获得 `https://agent-demo.<subdomain>.workers.dev`

---

## API

### 聊天

```
POST /chat
Content-Type: application/json

{"message": "杭州天气", "history": []}
```

### 可用工具

| 工具 | 参数 | 说明 |
|------|------|------|
| `get_weather` | `city` | 查询城市天气 |
| `save_note` | `content` | 保存笔记（限200字） |

---

## License

MIT