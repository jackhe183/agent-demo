// server.ts
import { tools, executeTool } from "./skills";

const DEEPSEEK_API_KEY = "sk-0d9e7d2091b34537bcdbc9a48962cb19";
const DEEPSEEK_BASE = "https://api.deepseek.com/v1";

// JINJA 风格动态 System Prompt
function buildSystemPrompt() {
  const toolList = Object.keys(tools).join(", ");
  return `你是一个私人助手。你能使用以下工具：${toolList}。
【重要】如果需要调用工具，必须严格按照以下JSON格式返回，**不要添加任何额外文字或代码块标记**：
{"type":"tool","name":"工具名","args":{"参数":"值"}}
如果直接回答用户，请用正常自然语言回复，但若之前已获得工具结果，请结合结果回答。`;
}

// 记忆压缩（简易滑动窗口 + 摘要）
function compressHistory(messages: { role: string; content: string }[]) {
  if (messages.length > 8) {
    const summary = `[历史摘要：用户曾询问了关于${messages[0].content.slice(0, 30)}...的问题，工具已返回相应信息]`;
    // 保留最近4条完整记录
    const recent = messages.slice(-4);
    return [summary, ...recent];
  }
  return messages;
}

// 调用 DeepSeek API
async function callDeepSeek(messages: { role: string; content: string }[]) {
  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat", // 或 deepseek-reasoner
      messages,
      temperature: 0.1, // 降低随机性，让 JSON 输出更稳定
    }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

// 鲁棒解析：从可能杂乱的文本中提取 JSON
function robustParse(raw: string): any {
  // 优先提取 {} 包裹的纯 JSON
  const jsonMatch = raw.match(/\{(?:[^{}]|{[^{}]*})*\}/s);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {}
  }
  // 失败则返回文本回答
  return { type: "text", content: raw };
}

// Agent 主循环
async function agentLoop(userMessage: string, history: { role: string; content: string }[]) {
  const systemMsg = { role: "system", content: buildSystemPrompt() };
  const compressed = compressHistory(history);
  const messages = [systemMsg, ...compressed, { role: "user", content: userMessage }];

  let loopCount = 0;
  const maxLoops = 5;

  while (loopCount < maxLoops) {
    const raw = await callDeepSeek(messages as any);
    const parsed = robustParse(raw);

    if (parsed.type === "tool") {
      const { name, args } = parsed;
      console.log(`🔧 Tool Call: ${name}`, args);
      const result = await executeTool(name, args);
      // 将工具结果填入对话
      messages.push({
        role: "assistant",
        content: `已调用工具 ${name}，结果：${JSON.stringify(result)}`,
      });
      // 简化：也可以按 OpenAI 原生 tool 消息格式，但 DeepSeek 对话模型这样也有效
    } else {
      // 普通文本回答
      return parsed.content || raw;
    }
    loopCount++;
  }
  return "处理超时，请重试。";
}

// 启动 HTTP 服务
Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    // 聊天 API
    if (req.method === "POST" && url.pathname === "/chat") {
      const { message, history } = await req.json();
      if (!message) return new Response("Missing message", { status: 400 });
      try {
        const reply = await agentLoop(message, history || []);
        return new Response(JSON.stringify({ reply }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ reply: "出错：" + err.message }), { status: 500 });
      }
    }
    // 静态文件服务
    const filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = Bun.file("./public" + filePath);
    if (await file.exists()) {
      return new Response(file);
    }
    return new Response("Not Found", { status: 404 });
  },
});
console.log("🚀 Agent server running on http://localhost:3000");