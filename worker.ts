// worker.ts - Cloudflare Workers 版本
// 对应原 server.ts，但兼容 Workers 运行环境

// ============ 工具定义 ============
const tools: Record<string, (args: any) => Promise<any>> = {
  get_weather: async (args: { city: string }) => {
    return {
      city: args.city,
      temperature: "22°C",
      condition: "晴朗",
      humidity: "45%",
      advice: "适合外出",
    };
  },
  save_note: async (args: { content: string }) => {
    if (args.content.length > 200) return { error: "笔记内容过长（限制200字）" };
    if (/admin|password|token/i.test(args.content)) return { error: "内容包含敏感词" };
    console.log("📝 保存笔记:", args.content);
    return { success: true, message: "笔记已保存" };
  },
};

async function executeTool(name: string, args: any) {
  const fn = tools[name];
  if (!fn) return { error: `工具 '${name}' 不存在` };
  try {
    return await fn(args);
  } catch (e: any) {
    return { error: e.message };
  }
}

// ============ Agent 核心 ============
function buildSystemPrompt(): string {
  const toolList = Object.keys(tools).join(", ");
  return `你是一个私人助手。你能使用以下工具：${toolList}。
【重要】如果需要调用工具，必须严格按照以下JSON格式返回，**不要添加任何额外文字或代码块标记**：
{"type":"tool","name":"工具名","args":{"参数":"值"}}
如果直接回答用户，请用正常自然语言回复，但若之前已获得工具结果，请结合结果回答。`;
}

function compressHistory(messages: { role: string; content: string }[]) {
  if (messages.length > 8) {
    const summary = `[历史摘要：用户曾询问了关于${messages[0].content.slice(0, 30)}...的问题，工具已返回相应信息]`;
    const recent = messages.slice(-4);
    return [summary, ...recent];
  }
  return messages;
}

async function callDeepSeek(messages: { role: string; content: string }[], apiKey: string): Promise<string> {
  const DEEPSEEK_BASE = "https://api.deepseek.com/v1";
  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      temperature: 0.1,
    }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

function robustParse(raw: string): any {
  const jsonMatch = raw.match(/\{(?:[^{}]|{[^{}]*})*\}/s);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {}
  }
  return { type: "text", content: raw };
}

async function agentLoop(userMessage: string, history: { role: string; content: string }[], apiKey: string) {
  const systemMsg = { role: "system", content: buildSystemPrompt() };
  const compressed = compressHistory(history);
  const messages = [systemMsg, ...compressed, { role: "user", content: userMessage }];

  let loopCount = 0;
  const maxLoops = 5;

  while (loopCount < maxLoops) {
    const raw = await callDeepSeek(messages as any, apiKey);
    const parsed = robustParse(raw);

    if (parsed.type === "tool") {
      const { name, args } = parsed;
      console.log(`🔧 Tool Call: ${name}`, args);
      const result = await executeTool(name, args);
      messages.push({
        role: "assistant",
        content: `已调用工具 ${name}，结果：${JSON.stringify(result)}`,
      });
    } else {
      return parsed.content || raw;
    }
    loopCount++;
  }
  return "处理超时，请重试。";
}

// ============ 内联 HTML ============
const HTML_CONTENT = `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Agent 演示 - 私人助手</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 2rem auto; }
    #chat { height: 400px; border: 1px solid #ccc; overflow-y: auto; padding: 1rem; margin-bottom: 1rem; background: #f9f9f9; }
    .user, .agent { margin-bottom: 0.5rem; }
    .user strong { color: blue; }
    .agent strong { color: green; }
    input { width: 75%; padding: 0.5rem; }
    button { padding: 0.5rem 1rem; }
  </style>
</head>
<body>
  <h1>🤖 智能助手 Demo</h1>
  <div id="chat"></div>
  <input id="input" type="text" placeholder="输入消息，例如：查一下杭州的天气" />
  <button onclick="send()">发送</button>
  <script>
    const chatDiv = document.getElementById("chat");
    let history = [];
    async function send() {
      const input = document.getElementById("input");
      const message = input.value.trim();
      if (!message) return;
      addMessage("user", message);
      input.value = "";
      const res = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      const data = await res.json();
      const reply = data.reply || "错误";
      addMessage("agent", reply);
      history.push({ role: "user", content: message });
      history.push({ role: "assistant", content: reply });
      if (history.length > 20) history = history.slice(-20);
    }
    function addMessage(role, text) {
      const div = document.createElement("div");
      div.className = role;
      div.innerHTML = "<strong>" + (role === "user" ? "我" : "助手") + ":</strong> " + text;
      chatDiv.appendChild(div);
      chatDiv.scrollTop = chatDiv.scrollHeight;
    }
    document.getElementById("input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") send();
    });
  </script>
</body>
</html>`;

// ============ Workers 导出 ============
export default {
  async fetch(request: Request, env: { DEEPSEEK_API_KEY: string }): Promise<Response> {
    const url = new URL(request.url);

    // 聊天 API
    if (request.method === "POST" && url.pathname === "/chat") {
      const { message, history } = await request.json();
      if (!message) return new Response("Missing message", { status: 400 });
      try {
        const reply = await agentLoop(message, history || [], env.DEEPSEEK_API_KEY);
        return new Response(JSON.stringify({ reply }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ reply: "出错：" + err.message }), { status: 500 });
      }
    }

    // 静态文件（返回内联 HTML）
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      return new Response(HTML_CONTENT, {
        headers: { "Content-Type": "text/html;charset=utf-8" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};
