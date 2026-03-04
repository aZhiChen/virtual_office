# Virtual Office 项目架构说明

> 写给 Junior 程序员的项目导读手册

---

## 目录

1. [项目是什么](#1-项目是什么)
2. [整体架构全景](#2-整体架构全景)
3. [为什么要前后端分离](#3-为什么要前后端分离)
4. [后端目录详解](#4-后端目录详解)
5. [前端目录详解](#5-前端目录详解)
6. [数据流：一条消息的旅程](#6-数据流一条消息的旅程)
7. [技术选型与原因](#7-技术选型与原因)
8. [如何维护这个项目](#8-如何维护这个项目)
9. [什么是好的项目结构](#9-什么是好的项目结构)
10. [常见开发场景速查](#10-常见开发场景速查)

---

## 1. 项目是什么

**Virtual Office** 是一个多人实时虚拟办公室。用户可以：

- 用像素风头像在 2D 地图里走动
- 和其他在线用户实时聊天
- 坐在虚拟办公桌、会议椅、跑步机上
- 养一个虚拟宠物跟着自己
- 开启 AFK 模式，让 AI 自动帮你回复消息

这个项目的技术核心是：**REST API 处理慢操作 + WebSocket 处理实时同步 + Phaser 游戏引擎渲染画面**。

---

## 2. 整体架构全景

```
┌─────────────────────────────────────────────────────────┐
│                        浏览器                            │
│                                                          │
│   ┌────────────────┐        ┌──────────────────────┐    │
│   │   Next.js      │        │    Phaser 3          │    │
│   │  (React UI)    │◄──────►│   (游戏渲染引擎)      │    │
│   │                │ 事件   │                      │    │
│   │  页面路由      │ 通信   │  地图/角色/碰撞检测   │    │
│   │  聊天面板      │        │  动画/深度排序        │    │
│   │  用户列表      │        │                      │    │
│   └───────┬────────┘        └──────────────────────┘    │
│           │                                              │
└───────────┼──────────────────────────────────────────────┘
            │  HTTP / WebSocket
            │
┌───────────▼──────────────────────────────────────────────┐
│                     Python 后端                           │
│                                                          │
│   ┌──────────────┐   ┌──────────────┐  ┌─────────────┐  │
│   │  REST API    │   │  WebSocket   │  │  后台任务   │  │
│   │  auth/profile│   │  /ws         │  │  动物移动   │  │
│   │  chat/note   │   │  实时消息    │  │  公告调度   │  │
│   │  announcement│   │              │  │             │  │
│   │  easter_egg  │   │              │  │             │  │
│   └──────┬───────┘   └──────┬───────┘  └─────────────┘  │
│          │                  │                            │
│   ┌──────▼──────────────────▼──────────────────────┐    │
│   │              业务逻辑层                          │    │
│   │   manager.py (连接/状态管理)                    │    │
│   │   world.py   (消息路由与处理)                   │    │
│   │   llm_client.py (AI 自动回复)                  │    │
│   │   announcement_service.py (系统公告/每日统计)   │    │
│   └──────────────────────┬─────────────────────────┘    │
│                          │                               │
│   ┌──────────────────────▼─────────────────────────┐    │
│   │              数据层                              │    │
│   │   SQLite 数据库  ← SQLAlchemy ORM               │    │
│   │   User/ChatMessage/Note/Task/SystemMessage/     │    │
│   │   PersonalPost/AnnouncementLike/Comment/       │    │
│   │   PlantEasterEgg/UserDailyStat                  │    │
│   └────────────────────────────────────────────────┘    │
│                          │                               │
│   ┌──────────────────────▼─────────────────────────┐    │
│   │              外部服务                            │    │
│   │   OpenAI 兼容 LLM API (AFK 自动回复)            │    │
│   └────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

**一句话概括**：浏览器里的 React 负责 UI，Phaser 负责游戏画面，两者通过 window 事件通信；所有数据通过 HTTP 或 WebSocket 与后端同步；后端 FastAPI 管理游戏状态和用户数据。

---

## 3. 为什么要前后端分离

很多初学者会问：为什么不把前端和后端写在一起？

### 分离的理由

| 问题 | 不分离的痛苦 | 分离后的好处 |
|------|-------------|-------------|
| 团队协作 | 前后端代码混在一起，互相影响 | 前端团队和后端团队可以并行开发 |
| 部署 | 改个按钮颜色要重启整个服务器 | 前端可以独立部署到 CDN，后端单独扩容 |
| 技术栈 | 被迫用同一种语言写所有东西 | 前端用 TypeScript，后端用 Python，各选最合适的 |
| 扩展性 | 用户多了，整个服务器都要扩容 | 可以只扩容后端，或者只扩容前端 |
| 可维护性 | 10000 行代码在一个文件里 | 各司其职，找问题更容易 |

### 这个项目的具体分工

```
前端（浏览器负责）          后端（服务器负责）
──────────────────          ──────────────────
• 渲染像素画面              • 验证用户身份（JWT）
• 处理键盘/鼠标输入         • 存储用户数据（数据库）
• 本地碰撞检测              • 权威游戏状态（位置/座位）
• UI 交互（聊天面板等）      • 广播消息给所有玩家
• 生成头像纹理（Canvas）     • 驱动 AI 自动回复
• 离线时的本地动画           • 驱动动物随机移动
```

**权威状态原则**：在多人游戏里，所有玩家位置的"真相"由服务器决定。客户端做本地预测（让操作感觉流畅），但最终以服务器广播的数据为准。这就是为什么 `manager.py` 维护所有人的坐标，而不是让客户端自己说"我在哪里"。

---

## 4. 后端目录详解

```
backend/
├── app/
│   ├── api/          ← HTTP 接口（慢操作）
│   ├── core/         ← 基础设施（不含业务逻辑）
│   ├── models/       ← 数据库表结构
│   ├── services/     ← 外部服务调用
│   ├── ws/           ← WebSocket 实时通信
│   └── main.py       ← 应用入口
├── .env              ← 环境变量（密码/密钥，不提交 git）
├── .env.example      ← 环境变量模板（提交 git，给同事参考）
└── requirements.txt  ← Python 依赖列表
```

### `core/` — 基础设施层

**原则**：这里的代码不包含任何业务逻辑，只提供"工具"。

```
core/
├── config.py      # 读取环境变量，暴露为配置对象
├── database.py    # 数据库连接和 Session 工厂
├── logger.py      # 日志配置
└── security.py    # 密码哈希 + JWT 生成/验证
```

**为什么单独放 `core/`？**

假设你想把数据库从 SQLite 换成 PostgreSQL，你只需要改 `database.py` 一个文件，其他所有业务代码不用动。这叫**依赖倒置**——业务代码依赖抽象接口，不依赖具体实现。

`config.py` 里用 Pydantic Settings 读取 `.env` 文件：

```python
# 所有配置统一从这里取，不要在业务代码里直接读 os.environ
from app.core.config import settings
db_url = settings.DATABASE_URL
```

**不要在 `core/` 里写业务逻辑**。比如"用户注册时发欢迎邮件"不应该放在 `core/`，而应该放在 `api/` 或 `services/`。

---

### `models/` — 数据库模型层

**原则**：这里只描述数据长什么样，不写操作数据的逻辑。

```
models/
├── user.py              # User：账户、头像、宠物、性格、AFK、status
├── chat_message.py      # ChatMessage：私聊消息持久化
├── note.py              # Note：用户便签
├── note_item.py         # NoteItem：便签项与 Task 关联
├── task.py              # Task：待办任务（pending/completed）
├── system_message.py    # SystemMessage：系统公告
├── personal_post.py    # PersonalPost：个人帖子
├── announcement_like.py # AnnouncementLike：点赞
├── announcement_comment.py # AnnouncementComment：评论
├── plant_easter_egg.py  # PlantEasterEgg：盆栽彩蛋
└── user_daily_stat.py   # UserDailyStat：每日统计（便签使用、全部完成）
```

```python
# models/user.py 示例
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True)
    hashed_password = Column(String)    # 注意：存哈希，不存明文！
    avatar_config = Column(JSON)         # 头像配置序列化存储
    personality = Column(Text)           # AI 性格描述
    is_afk = Column(Boolean)
    status = Column(String)              # 头顶状态文案（含 emoji）
```

**为什么用 ORM（SQLAlchemy）而不直接写 SQL？**

- 防止 SQL 注入攻击（ORM 自动转义参数）
- 代码更易读（Python 对象 vs 拼接字符串）
- 换数据库时改动最小

---

### `api/` — HTTP 接口层

**原则**：这里处理"不需要实时"的操作——注册、登录、修改头像、设置性格、聊天历史、便签、公告、彩蛋。

```
api/
├── auth.py         # POST /api/auth/register, POST /api/auth/login
├── profile.py      # GET/PUT /api/profile/...（含 status）
├── chat.py         # GET /api/chat/history（聊天历史 REST）
├── note.py         # 便签/任务 CRUD（Note、Task、NoteItem、Box）
├── announcement.py # 公告墙（系统消息、个人帖子、点赞、评论）
└── easter_egg.py   # 盆栽彩蛋（藏/发现）
```

**什么时候用 REST API，什么时候用 WebSocket？**

| 操作 | 用哪个 | 原因 |
|------|--------|------|
| 注册/登录 | REST | 一次性请求，不需要持久连接 |
| 修改头像 | REST | 低频操作，无需实时 |
| 聊天历史 | REST | 按需拉取，持久化存储 |
| 便签/任务 | REST | CRUD 操作，无需实时 |
| 公告墙 | REST | 读/写帖子、点赞、评论 |
| 角色移动 | WebSocket | 需要毫秒级实时同步 |
| 聊天消息 | WebSocket | 需要服务器推送给其他人 |
| 动物位置 | WebSocket | 每 100ms 更新一次 |
| 公告更新 | WebSocket | 广播 announcement_updated |

每个接口函数通过 FastAPI 的依赖注入拿到数据库 Session：

```python
@router.get("/me")
async def get_profile(
    current_user: User = Depends(get_current_user),  # 自动验证 JWT
    db: Session = Depends(get_db)                    # 自动管理数据库连接
):
    return current_user
```

---

### `ws/` — WebSocket 实时层

这是项目里最复杂的部分，承担实时多人同步的核心职责。

```
ws/
├── manager.py        # 状态中心：谁在线、在哪里、坐在哪
├── world.py          # 消息路由：收到消息 → 执行对应操作
└── office_animals.py # 服务器驱动的动物 AI
```

**三个文件的关系**：

```
客户端发消息
     │
     ▼
world.py           ← 消息路由，决定"这条消息该做什么"
     │
     ├── 读/写游戏状态 → manager.py  ← 内存中的游戏状态
     │
     └── 广播给其他人 → manager.py.broadcast()
                              │
                              └── 发给所有连接的客户端
```

**`manager.py` 为什么需要单独存在？**

它是整个多人游戏的"内存数据库"——存储着当前所有在线玩家的位置、座位占用情况等**实时状态**。这些数据不需要写入数据库（用户下线就清空），但需要在所有 WebSocket 连接之间共享。

**`office_animals.py` 的设计亮点**：动物的移动由服务器计算，然后广播给所有客户端。这叫**服务端权威（Server-Authoritative）**设计——避免了客户端之间看到的动物位置不一致。

---

### `services/` — 外部服务与业务服务层

```
services/
├── llm_client.py          # 调用 OpenAI 兼容的 LLM API（AFK 自动回复）
└── announcement_service.py # 系统公告生成、每日统计刷新
```

**`llm_client.py`**：将第三方 LLM 调用隔离在这里，换提供商只改此文件。

**`announcement_service.py`**：
- `generate_system_messages(db)`：每日 10 点后生成系统公告（连续打卡、任务完成等）。
- `refresh_user_daily_stat(db, user_id)`：刷新用户每日统计（便签使用、全部完成）。

**为什么单独放 `services/`？**

1. 换 LLM 提供商只改 `llm_client.py`
2. 可以在这里统一处理超时、重试、错误
3. 方便写单元测试（Mock 这些模块就行）

---

## 5. 前端目录详解

```
frontend/src/
├── app/           ← Next.js 路由（每个文件夹 = 一个 URL 路径）
├── components/    ← 可复用的 React 组件
├── game/          ← Phaser 游戏引擎相关代码
└── lib/           ← 工具函数和服务客户端
```

### `app/` — 页面路由层

Next.js App Router 的规则：**文件夹名 = URL 路径，`page.tsx` = 该路径的页面**。

```
app/
├── page.tsx              → 访问 /      → 检查登录状态，跳转
├── layout.tsx            → 所有页面共享的外层结构
├── login/page.tsx        → 访问 /login  → 登录/注册界面
├── customize/page.tsx    → 访问 /customize → 头像定制
├── customize/personality/page.tsx → 访问 /customize/personality → 性格设置
└── office/page.tsx       → 访问 /office → 游戏主界面
```

**用户流程对应的页面流程**：

```
/ → 检查 token → 无 token → /login → 注册成功 → /customize → /customize/personality → /office
                         ↑
                    有 token → /office（直接进入）
```

**`office/page.tsx` 是前端最复杂的文件**，它做了：

- 建立 WebSocket 连接
- 把后端发来的消息转化为游戏事件（通过 `window.dispatchEvent`）
- 管理 React 状态（在线用户列表、聊天消息、通知、便签、公告、彩蛋）
- 渲染 UI 层（聊天面板、用户列表、控制按钮、便签、公告墙、状态设置、彩蛋）
- 启动 Phaser 游戏

---

### `components/` — 可复用组件层

**原则**：一个组件只做一件事，可以在多个页面复用。

```
components/
├── PhaserGame.tsx            # 包装 Phaser 游戏实例，处理生命周期
├── ChatPanel.tsx             # 聊天 UI（消息列表 + 输入框）
├── PixelAvatar.tsx           # 像素头像预览（Canvas 绘制）
├── ControlToggle.tsx         # AFK/控制切换按钮
├── MessageNotification.tsx    # 新消息弹窗通知
├── NotePanel.tsx             # 便签/任务面板
├── AnnouncementPanel.tsx      # 公告墙（系统消息 + 个人帖子）
├── AnnouncementNotification.tsx # 公告更新弹窗
├── StatusSetter.tsx          # 状态设置（头顶显示文案）
└── EasterEggSetter.tsx       # 盆栽彩蛋（藏/发现）
```

**`PhaserGame.tsx` 解决了一个重要问题**：Phaser 是命令式的（直接操作 DOM），React 是声明式的（描述 UI 状态）。这个组件把两者"粘合"在一起，并在 React 组件销毁时正确清理 Phaser 实例（防止内存泄漏）。

**`PixelAvatar.tsx` 的设计**：头像不是图片文件，而是用 Canvas API 动态绘制的。输入是 `avatar_config`（肤色、发色、服装颜色等参数），输出是像素画。这样无限种组合不需要存储任何图片文件。

---

### `game/` — 游戏引擎层

```
game/
├── scenes/
│   └── OfficeScene.ts   # 主游戏场景（~2000 行，游戏核心）
├── maps/
│   ├── officeMap.ts     # 地图布局定义（瓦片、家具、区域）
│   └── tileRegistry.ts  # 瓦片类型注册表
└── sprites/
    └── colors.ts        # 颜色调色盘（皮肤/头发/服装/宠物）
```

**`OfficeScene.ts` 做了什么？**

Phaser Scene 是游戏的"大脑"，每帧（60fps）都在执行：

```
create() 阶段（只执行一次）：
  → 生成地图瓦片（地板/装饰/墙壁三层）
  → 放置家具（桌子/椅子/跑步机）
  → 创建玩家精灵 + 宠物精灵
  → 设置碰撞规则
  → 监听 window 事件（接收来自 React 的消息）

update() 阶段（每帧执行）：
  → 读取键盘输入 → 计算移动方向
  → 本地碰撞检测（撞墙停止）
  → 通过 WebSocket 发送新位置
  → 按 Y 坐标排序所有精灵（实现"前面的人挡住后面的人"效果）
```

**`officeMap.ts` 的作用**：把地图数据从游戏逻辑里分离出来。如果你想添加新区域、移动桌子位置、修改地图大小，只需要改这一个文件，不用动 `OfficeScene.ts`。

---

### `lib/` — 服务客户端层

```
lib/
├── api.ts    # REST API 调用封装（auth/profile/chat/note/announcement/easter_egg）
├── ws.ts     # WebSocket 连接管理（单例）
├── auth.tsx  # 登录状态工具函数
└── emoji.ts  # 表情符号工具
```

**为什么要封装 `api.ts` 和 `ws.ts`？**

不封装的话，每个组件都要自己写 `fetch('/api/auth/login', { method: 'POST', headers: {...}, body: JSON.stringify(...) })`，重复且容易出错。封装后：

```typescript
// 调用方只需要：
const { token } = await login(username, password);
// 不需要关心 HTTP 细节
```

**`ws.ts` 是单例模式**：整个应用只有一个 WebSocket 连接，避免重复建立连接浪费资源。它用事件系统让不同组件订阅自己感兴趣的消息类型。

---

## 6. 数据流：一条消息的旅程

以"用户 A 向用户 B 发送聊天消息"为例：

```
用户 A 在聊天框输入消息，点击发送
         │
         ▼
ChatPanel.tsx（React 组件）
  → 调用 ws.send({ type: 'chat_send', target: 'B', message: '你好' })
         │
         ▼
ws.ts（WebSocket 客户端）
  → 把对象序列化为 JSON 字符串
  → 通过 WebSocket 连接发给服务器
         │
         ▼
═══════════════════ 网络传输 ═══════════════════
         │
         ▼
world.py（FastAPI WebSocket 处理器）
  → 解析 JSON，识别 type = 'chat_send'
  → 调用 manager.get_connection(target_user_id)
  → 通过 manager.send_to_user() 发给用户 B
  → （如果 B 是 AFK 状态）调用 llm_client.generate_reply()
         │
         ▼
═══════════════════ 网络传输 ═══════════════════
         │
         ▼
ws.ts（用户 B 的 WebSocket 客户端）
  → 收到 { type: 'chat_message', from: 'A', message: '你好' }
  → 触发已注册的监听器
         │
         ▼
office/page.tsx
  → 更新 chatMessages 状态
  → 如果聊天面板关闭，显示 MessageNotification 弹窗
         │
         ▼
ChatPanel.tsx（用户 B 看到新消息）
```

---

## 7. 技术选型与原因

| 技术 | 用途 | 为什么选它 |
|------|------|-----------|
| **FastAPI** | 后端框架 | 原生支持异步，WebSocket 支持好，自动生成 API 文档 |
| **SQLite** | 数据库 | 开发阶段零配置，单文件，适合中小规模 |
| **SQLAlchemy** | ORM | Python 生态最成熟的 ORM，支持多种数据库 |
| **JWT** | 身份认证 | 无状态，不需要服务器存储 Session，适合前后端分离 |
| **Next.js** | 前端框架 | App Router 路由优雅，支持 SSR/SSG，生态成熟 |
| **Phaser 3** | 游戏引擎 | 专为 2D 浏览器游戏设计，碰撞检测、精灵管理、地图渲染开箱即用 |
| **TypeScript** | 类型系统 | 大型前端项目的标配，减少运行时错误 |
| **Tailwind CSS** | 样式 | 原子化 CSS，开发速度快，不需要起类名 |

---

## 8. 如何维护这个项目

### 添加新功能的标准流程

**场景：添加一个"表情反应"功能（用户可以对消息点赞）**

**第一步：想清楚数据流**
- 需要持久化吗？（点赞数需要存数据库）→ 需要改 `models/`
- 需要实时推送吗？（所有人看到点赞数变化）→ 需要改 `ws/`
- 需要 API 接口吗？（可以通过 WebSocket 处理，不一定需要）

**第二步：后端**
1. 如需持久化，在 `models/` 添加新表或新字段
2. 在 `ws/world.py` 添加新消息类型处理函数 `handle_reaction()`
3. 在 `ws/manager.py` 添加状态管理（如果需要维护内存状态）

**第三步：前端**
1. 在 `lib/ws.ts` 定义新的消息类型
2. 在 `office/page.tsx` 注册新消息的监听器
3. 创建新组件 `components/ReactionPanel.tsx` 或修改 `ChatPanel.tsx`
4. 如果需要在游戏中显示，在 `game/scenes/OfficeScene.ts` 添加处理

### 调试技巧

**后端日志**：日志写到 `backend/logs/` 目录，查看 `world.py` 的 WebSocket 收发记录。

**前端调试**：
```typescript
// ws.ts 里有调试模式，浏览器 Console 可以看到所有 WebSocket 消息
```

**常见问题排查**：
- 角色位置不同步 → 检查 `manager.py` 的位置存储逻辑
- 消息发不出去 → 检查 `world.py` 的消息类型匹配
- 头像显示异常 → 检查 `PixelAvatar.tsx` 的 Canvas 绘制逻辑
- AFK 回复不工作 → 检查 `.env` 里的 LLM 配置

### 代码规范

**后端**：
```python
# 好的写法：函数职责单一，命名清晰
async def handle_chat_send(data: dict, user_id: int, manager: ConnectionManager):
    target_id = data.get("target")
    message = data.get("message", "").strip()
    if not message:
        return
    await manager.send_to_user(target_id, {...})

# 坏的写法：一个函数做太多事，命名模糊
async def process(d, u, m):
    ...
```

**前端**：
```typescript
// 好的写法：明确类型，事件处理分离
interface ChatMessage {
  from: string;
  message: string;
  isAutoReply: boolean;
}

// 坏的写法：any 类型满天飞
const handleMessage = (data: any) => { ... }
```

---

## 9. 什么是好的项目结构

### 核心原则

**1. 单一职责（Single Responsibility）**

每个文件、每个函数只做一件事。

```
❌ 把认证、数据库、业务逻辑全写在 main.py 里
✅ auth.py 负责认证，database.py 负责连接，user.py 负责用户逻辑
```

**2. 关注点分离（Separation of Concerns）**

UI 代码不该知道 API 细节；游戏逻辑不该知道 UI 状态。

```
❌ 在 OfficeScene.ts 里直接调用 fetch('/api/profile')
✅ 通过 window 事件与 React 通信，让 React 调用 api.ts
```

**3. 依赖方向单一（Dependency Direction）**

高层模块不依赖低层实现细节。

```
API 层 → 依赖 → 模型层 → 依赖 → 数据库层
✅ api/auth.py 用 models/user.py，但不直接写 SQL

API 层 ← 不依赖 ← 模型层
❌ models/user.py 里不应该调用 API 逻辑
```

**4. 配置与代码分离**

```
❌ API_KEY = "sk-abc123"  写死在代码里
✅ API_KEY = settings.LLM_API_KEY  从环境变量读取
```

**5. 显式优于隐式**

```
❌ 函数名叫 process()，不知道处理什么
✅ 函数名叫 handle_chat_send()，一眼明白
```

### 好结构的检验标准

问自己这几个问题：

1. **新同事能在 10 分钟内找到"处理登录逻辑的代码"在哪里吗？** → 目录命名是否清晰
2. **改数据库类型需要改几个文件？** → 如果超过 3 个，说明耦合太紧
3. **能单独测试某个模块而不启动整个服务吗？** → 模块是否独立
4. **两个不相关功能的代码是否会互相影响？** → 是否有正确的边界

### 这个项目哪些地方还可以改进

| 现状 | 更好的做法 |
|------|-----------|
| `OfficeScene.ts` 约 2000 行 | 拆分为 `PlayerController.ts`、`AnimationManager.ts`、`SeatManager.ts` 等 |
| 游戏状态全在 `manager.py` 内存中 | 大规模时可用 Redis 替代内存，支持多实例部署 |
| SQLite 单文件数据库 | 生产环境应换成 PostgreSQL |
| 缺少自动化测试 | 为 `world.py` 的消息处理函数、`api/` 的接口添加单元测试 |
| WebSocket 消息没有类型定义 | 前后端共享消息类型定义（如用 JSON Schema 或 Protobuf） |

---

## 10. 常见开发场景速查

| 我想... | 应该改哪里 |
|---------|-----------|
| 添加新的地图区域 | `frontend/src/game/maps/officeMap.ts` |
| 添加新的头像颜色选项 | `frontend/src/game/sprites/colors.ts` |
| 添加新的 WebSocket 消息类型 | `backend/app/ws/world.py` + `frontend/src/lib/ws.ts` |
| 修改 AI 自动回复的风格 | `backend/app/services/llm_client.py`（System Prompt） |
| 添加新的用户属性 | `backend/app/models/user.py` + 对应 API + 前端展示 |
| 修改聊天 UI | `frontend/src/components/ChatPanel.tsx` |
| 修改便签/任务逻辑 | `backend/app/api/note.py` + `frontend/src/components/NotePanel.tsx` |
| 修改公告墙逻辑 | `backend/app/api/announcement.py` + `frontend/src/components/AnnouncementPanel.tsx` |
| 修改彩蛋逻辑 | `backend/app/api/easter_egg.py` + `frontend/src/components/EasterEggSetter.tsx` |
| 修改角色移动速度/碰撞 | `frontend/src/game/scenes/OfficeScene.ts` |
| 添加新的家具类型 | `frontend/src/game/maps/officeMap.ts` + `OfficeScene.ts` |
| 修改系统公告生成规则 | `backend/app/services/announcement_service.py` |
| 修改数据库配置 | `backend/.env` 文件 |
| 查看服务器错误日志 | `backend/logs/` 目录 |

---

*最后一个建议：读代码比写代码重要。在动手改代码之前，先顺着数据流把相关文件通读一遍，理解为什么这么写，再决定怎么改。好的代码是改出来的，不是一次写成的。*
