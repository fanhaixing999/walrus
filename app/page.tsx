'use client';

import { useChat } from 'ai/react';
import { useState, useEffect, useRef } from 'react';

export default function WorldCupAgent() {
  const [userId, setUserId] = useState<string | null>(null);

  // 初始化时从 localStorage 读取或创建唯一的持久化用户ID
  useEffect(() => {
    let savedId = localStorage.getItem('walrus_worldcup_user_id');
    if (!savedId) {
      savedId = `user-${Math.random().toString(36).substring(2, 11)}-${Date.now().toString().slice(-4)}`;
      localStorage.setItem('walrus_worldcup_user_id', savedId);
    }
    setUserId(savedId);
  }, []);

  // 确保 userId 在客户端完全加载后再渲染聊天，避免 SSR 产生随机 ID 覆盖
  if (!userId) {
    return <div className="container">正在初始化 Walrus 记忆凭证...</div>;
  }

  return <ChatWindow userId={userId} />;
}

function ChatWindow({ userId }: { userId: string }) {
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    body: { userId },
  });

  // 自动滚动到最新消息
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  return (
    <div className="container">
      <h1>⚽ World Cup Walrus Memory Agent</h1>
      <p style={{ margin: "5px 0 15px 0", opacity: 0.8 }}>
        基于 <strong>Walrus Mainnet</strong> 的持久记忆智能体 · 随时刷新页面测试去中心化跨会话记忆
      </p>
      <div style={{ fontSize: '12px', background: '#1e2937', padding: '6px 12px', borderRadius: '6px', display: 'inline-block', border: '1px solid #334155' }}>
        🔑 你的专属链上记忆凭证 ID: <span style={{ color: '#22d3ee', fontFamily: 'monospace' }}>{userId}</span>
      </div>

      <div className="chat-box" ref={chatContainerRef}>
        {messages.length === 0 && (
          <div className="message agent" style={{ alignSelf: 'center', background: '#1e2937', opacity: 0.8, maxWidth: '90%' }}>
            👋 哈喽！我是你的世界杯记忆伙伴。我已经连接到 Walrus 主网。<br /><br />
            试着输入 3 个不同的世界杯预测（例如：“预测法国夺冠”、“我觉得英格兰要爆冷”）。之后你可以任意关闭、刷新网页，再回来考考我的记忆力！
          </div>
        )}
        
        {messages.map((m) => (
          <div key={m.id} className={`message ${m.role === 'user' ? 'user' : 'agent'}`}>
            <strong>{m.role === 'user' ? '你' : '记忆伙伴'}:</strong><br />
            <div style={{ marginTop: '4px', whiteSpace: 'pre-wrap' }}>{m.content}</div>
          </div>
        ))}
        {isLoading && <div className="message agent" style={{ opacity: 0.7 }}>⚡ 正在连线大模型并检索 Walrus 主网记忆...</div>}
      </div>

      <form onSubmit={handleSubmit} className="input-form">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="输入你的世界杯预测、吐槽（超过5个字将自动上链保存）..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>
          发送
        </button>
      </form>

      <div style={{ marginTop: "20px", fontSize: "13px", color: '#94a3b8', lineHeight: '1.6' }}>
        💡 <strong>如何向评委证明持久记忆：</strong><br />
        1. 输入一段非常离谱的预测并发送 ➔ 2. 彻底关闭浏览器标签页 ➔ 3. 重新打开该网页 ➔ 4. 问 AI：“回顾一下我刚才说了什么离谱的预测？”，见证它从 Walrus 主网秒级调出历史。
      </div>
    </div>
  );
}
