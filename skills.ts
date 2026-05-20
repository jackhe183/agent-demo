// skills.ts
export const tools: Record<string, (args: any) => Promise<any>> = {
  get_weather: async (args: { city: string }) => {
    // 模拟天气查询（实际可接免费 API）
    return {
      city: args.city,
      temperature: "22°C",
      condition: "晴朗",
      humidity: "45%",
      advice: "适合外出",
    };
  },
  save_note: async (args: { content: string }) => {
    // 安全沙箱：长度限制、敏感词示例
    if (args.content.length > 200) return { error: "笔记内容过长（限制200字）" };
    if (/admin|password|token/i.test(args.content)) return { error: "内容包含敏感词" };
    // 真实场景可写入数据库或文件
    console.log("📝 保存笔记:", args.content);
    return { success: true, message: "笔记已保存" };
  },
};

export async function executeTool(name: string, args: any) {
  const fn = tools[name];
  if (!fn) return { error: `工具 '${name}' 不存在` };
  try {
    return await fn(args);
  } catch (e: any) {
    return { error: e.message };
  }
}