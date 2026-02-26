# 聊天和自动回复调试指南

## 问题描述
LLM 自动回复生成后，聊天框没有显示回复内容

## 已添加的调试日志

### 前端 (打开浏览器开发者工具 F12 -> Console)
- 📨 Received chat_message: 收到 WebSocket 消息时
- 💬 Updated chatMessages: 更新消息数组后
- 🔔 Showing notification: 显示通知时
- 💭 Filtered messages: ChatPanel 过滤消息时

### 后端 (查看终端或 logs/app.log)
- "Chat message: from=X to=Y" - 收到聊天消息
- "LLM auto-reply generated" - LLM 生成回复成功
- "Sending auto-reply: from=X to=Y message=..." - 准备发送自动回复
- "Auto-reply sent to both parties" - 自动回复已发送

## 测试步骤

### 1. 准备两个用户
- 用户 A (例如 id=2)
- 用户 B (例如 id=5)

### 2. 设置用户 B 为 AFK 状态
- 用户 B 登录
- 点击右上角 AFK 按钮，设置为 AFK 状态
- 在个人资料中设置性格描述（如"我是一个友好的同事"）

### 3. 用户 A 发送消息
- 用户 A 打开与用户 B 的聊天窗口
- 发送一条消息
- **检查浏览器控制台**，应该看到：
  ```
  📨 Received chat_message: {from_user_id: 2, to_user_id: 5, ...}
  💬 Updated chatMessages: [...]
  ```

### 4. 等待自动回复
- 约 5-10 秒后（取决于 LLM API 响应时间）
- **检查后端日志**，应该看到：
  ```
  LLM auto-reply generated
  Sending auto-reply: from=5 to=2 message=...
  Auto-reply sent to both parties
  ```
- **检查用户 A 的浏览器控制台**，应该看到：
  ```
  📨 Received chat_message: {from_user_id: 5, to_user_id: 2, is_auto_reply: true, ...}
  💬 Updated chatMessages: [...]
  💭 Filtered messages for chat with user 5: [...]
  ```

### 5. 验证显示
- 用户 A 的聊天窗口应该显示自动回复（黄色背景 + "[Auto]" 标签）
- 如果用户 A 没有打开聊天窗口，应该在右下角看到通知

## 可能的问题点

### 问题 1: 收到消息但没有显示
**症状**: 浏览器控制台显示收到消息，但聊天窗口是空的
**检查**:
- 控制台中 "💭 Filtered messages" 显示的数组是否包含该消息
- 消息的 from_user_id 和 to_user_id 是否正确
- profile.id 和 chatTarget.id 的值

### 问题 2: 完全没收到消息
**症状**: 浏览器控制台没有 "📨 Received chat_message"
**检查**:
- WebSocket 是否连接成功
- 后端日志是否显示 "Auto-reply sent to both parties"
- 网络面板 (F12 -> Network -> WS) 查看 WebSocket 帧

### 问题 3: 自动回复没有生成
**症状**: 后端日志只有 "Chat message" 但没有 "LLM auto-reply generated"
**检查**:
- 用户 B 是否真的设置了 AFK 状态
- 用户 B 是否设置了性格描述
- LLM API 配置是否正确（.env 文件）
- 是否在 5 秒冷却时间内重复发送

### 问题 4: LLM API 失败
**症状**: 后端日志显示 "LLM auto-reply failed"
**检查**:
- LLM_BASE_URL 是否正确
- LLM_API_KEY 是否有效
- 网络是否能访问 LLM API

## 消息过滤逻辑说明

假设用户 A (id=2) 与用户 B (id=5) 聊天：

**用户 A 的视角** (profile.id=2, chatTarget.id=5):
- 显示条件：
  ```javascript
  (m.from_user_id === 5 && m.to_user_id === 2) ||  // B 发给我的
  (m.from_user_id === 2 && m.to_user_id === 5)     // 我发给 B 的
  ```
- 原始消息 (A发送): {from: 2, to: 5} ✅ 显示
- 自动回复 (B回复): {from: 5, to: 2} ✅ 显示

**用户 B 的视角** (profile.id=5, chatTarget.id=2):
- 显示条件：
  ```javascript
  (m.from_user_id === 2 && m.to_user_id === 5) ||  // A 发给我的
  (m.from_user_id === 5 && m.to_user_id === 2)     // 我发给 A 的
  ```
- 原始消息 (A发送): {from: 2, to: 5} ✅ 显示
- 自动回复 (B回复): {from: 5, to: 2} ✅ 显示

理论上两边都应该能看到所有消息。

## 清理调试日志

测试完成后，可以删除添加的 console.log 语句以提高性能。
