import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { MemWal } from '@mysten-incubation/memwal';

// 强制开启 Edge Runtime，突破 Vercel 10秒超时硬限制，确保 Walrus 主网数据完美上链
export const runtime = 'edge';

let memwalInstance: any = null;

// 单例懒加载：防止 Serverless 环境冷启动时环境变量未就绪导致崩溃
function getMemWalClient() {
  if (!memwalInstance) {
    const key = process.env.MEMWAL_DELEGATE_KEY;
    const accountId = process.env.MEMWAL_ACCOUNT_ID;

    if (!key || !accountId) {
      throw new Error("❌ 缺失核心环境变量：MEMWAL_DELEGATE_KEY 或 MEMWAL_ACCOUNT_ID 未配置。");
    }

    memwalInstance = MemWal.create({
      key,
      accountId,
      serverUrl: "https://relayer.memory.walrus.xyz",   // 🔥 已修正：官方唯一正确的 Mainnet Relayer 生产端点
      namespace: "worldcup-2026-agent",                // 独立业务命名空间隔离
    });
  }
  return memwalInstance;
}

export async function POST(req: Request) {
  try {
    const { messages, userId } = await req.json();
    const safeUserId = userId ? String(userId).trim() : "anonymous_user";
    
    // 过滤并提取出用户发送的最新一条有效文本（防止闪断、重试等机制将 assistant 的回复误当做输入）
    const userMessages = messages.filter((m: any) => m.role === 'user');
    const lastUserMessage = userMessages[userMessages.length - 1];

    const memwal = getMemWalClient();

    // 1. 保存记忆（仅当输入有效且长度大于 5 时写入，使用 rememberAndWait 强制等待 Relayer 向量索引完成）
    if (lastUserMessage && lastUserMessage.content?.trim().length > 5) {
      try {
        await memwal.rememberAndWait(
          `[User:${safeUserId}] ${lastUserMessage.content}`,
          {
            tags: ["worldcup", `user-${safeUserId}`], // 双重标签：大分类 + 用户专属私有 ID 隔离
            metadata: { 
              timestamp: new Date().toISOString(), 
              userId: safeUserId 
            }
          }
        );
      } catch (err) {
        // 记录日志，但是通过 catch 释放，防止因链上拥堵、Gas 不足直接卡死整个对话流
        console.error("❌ Walrus 记忆写入失败 (可能由于中继节点拥堵或钱包余额不足):", err);
      }
    }

    // 2. 精确读取该用户的历史记忆
    let memoryContext = "这是该用户在 Walrus 主网上的第一次对话，暂无任何历史预测和观点记录。";
    try {
      const recallResponse = await memwal.recall({
        // 基于用户当前输入的主题，去链上检索最相关的历史发言
        query: lastUserMessage?.content || "世界杯预测、球队观点、实时反应",
        limit: 6,
        tags: [`user-${safeUserId}`] // 核心防穿帮设计：强制只读取带该用户专属标签的数据
      });

      // 新版 SDK 返回结构嵌套在 .results 数组中
      const memories = recallResponse?.results || [];
      if (memories.length > 0) {
        memoryContext = memories
          .map((m: any) => {
            // 解决 Edge Runtime 带来的全球服务器时区漂移，统一格式化为中国标准时间
            const dateStr = new Date(m.createdAt || Date.now()).toLocaleDateString('zh-CN', {
              timeZone: 'Asia/Shanghai',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            });
            // 兼容多版本 SDK 字段定义，使用 content 或 text 兜底
            return `- [记忆时间: ${dateStr}] ${m.content || m.text}`;
          })
          .join("\n");
      }
    } catch (error) {
      console.error("❌ Walrus Recall 失败:", error);
      memoryContext = "由于主网中继节点网络波动，暂时无法从 Walrus 实时读取您的历史记忆。";
    }

    // 3. 构造极具针对性的 System Prompt 强迫大模型引用记忆（直击活动高分要求）
    const systemPrompt = `你是「世界杯记忆吐槽伙伴」——一个真正运行在去中心化存储网络 Walrus Mainnet 上的持久记忆 AI Agent。

【从 Walrus 主网成功召回的当前用户专属历史记忆如下】（这代表他过去真实说过的观点，必须高度重视）：
${memoryContext}

当前用户的最新一句话是："${lastUserMessage?.content || ''}"

回复核心要求（这是 Walrus Sessions 4 活动获取高分的绝对核心）：
1. 你必须主动、生动、具体地引用上面【历史记忆】中的某条内容！将其与用户当前的言论进行实时对比、深度分析或幽默吐槽。
2. 仔细审查历史。如果用户当前的观点与过去的预测发生矛盾（例如以前看好巴西，现在疯狂贬低），请充分发挥你毒舌、犀利、一针见血的资深球评家风格指出来，狠狠吐槽他的立场不坚定。
3. 整体语调请保持一个狂热球迷的专业性、激情与无情毒舌的幽默感。
4. 始终在对话中通过各种方式（如“我的 Walrus 记忆告诉我...”、“你记录在 Walrus 链上的历史预测...”）强调或暗示你拥有跨越会话、无法被抹除的去中心化持久记忆。`;

    // 调用 OpenAI 将流式数据无缝吐回给前端
    const result = streamText({
      model: openai("gpt-4o-mini"),
      system: systemPrompt,
      messages,
    });

    return result.toDataStreamResponse();

  } catch (globalError: any) {
    console.error("💥 接口发生内部致命错误:", globalError);
    return new Response(
      JSON.stringify({ error: "服务器内部发生未预期错误，请稍后重试" }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
