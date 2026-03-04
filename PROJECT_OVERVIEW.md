## Virtual Office - 项目结构总览

本文件总结虚拟办公室项目的整体结构与主要模块，便于快速理解与维护。

---

## 目录结构

```text
virtual_office/
├── .gitignore
├── README.md
├── PROJECT_OVERVIEW.md          # 本说明文件
├── ARCHITECTURE.md               # 架构详解（面向 Junior 程序员）
├── backend/                      # Python FastAPI 后端
│   ├── .env.example              # 环境变量模板（DB/LLM/JWT 等）
│   ├── requirements.txt
│   └── app/
│       ├── __init__.py
│       ├── main.py               # FastAPI 入口，路由 & CORS & DB 初始化 & 后台任务
│       ├── api/
│       │   ├── __init__.py
│       │   ├── auth.py           # 注册 / 登录（JWT）
│       │   ├── profile.py        # 头像、宠物、性格、AFK、状态 的 CRUD + 性格测试
│       │   ├── chat.py           # 聊天历史 REST API（GET /api/chat/history）
│       │   ├── note.py          # 便签/任务 CRUD（Note、Task、NoteItem、Box）
│       │   ├── announcement.py   # 公告墙：系统消息、个人帖子、点赞、评论
│       │   └── easter_egg.py     # 盆栽彩蛋：藏彩蛋、发现彩蛋
│       ├── core/
│       │   ├── __init__.py
│       │   ├── config.py         # 配置（DATABASE_URL / JWT / LLM 等，读 .env）
│       │   ├── database.py       # SQLAlchemy + SQLite Session & Base
│       │   ├── logger.py         # 日志配置
│       │   └── security.py       # bcrypt 密码哈希 + JWT 编解码
│       ├── models/
│       │   ├── __init__.py
│       │   ├── user.py           # User 表：头像、宠物、性格、AFK、status
│       │   ├── chat_message.py   # ChatMessage 表：私聊消息持久化
│       │   ├── note.py           # Note 表：用户便签
│       │   ├── note_item.py      # NoteItem 表：便签项与 Task 关联
│       │   ├── task.py           # Task 表：待办任务
│       │   ├── system_message.py # SystemMessage 表：系统公告
│       │   ├── personal_post.py  # PersonalPost 表：个人帖子
│       │   ├── announcement_like.py    # AnnouncementLike 表：点赞
│       │   ├── announcement_comment.py # AnnouncementComment 表：评论
│       │   ├── plant_easter_egg.py      # PlantEasterEgg 表：盆栽彩蛋
│       │   └── user_daily_stat.py       # UserDailyStat 表：每日统计（便签使用、完成）
│       ├── services/
│       │   ├── __init__.py
│       │   ├── llm_client.py     # OpenAI-compatible LLM 客户端（挂机自动回复）
│       │   └── announcement_service.py  # 系统公告生成、每日统计刷新
│       └── ws/
│           ├── __init__.py
│           ├── manager.py        # WebSocket 连接与世界状态管理
│           ├── world.py          # WS 消息处理（移动、聊天、坐下、AFK 等）
│           └── office_animals.py # 办公室动物 AI 循环（随机移动广播）
└── frontend/                     # Next.js + Phaser 前端
    ├── next.config.ts
    ├── next-env.d.ts
    ├── package.json
    ├── postcss.config.mjs
    ├── tsconfig.json
    └── src/
        ├── app/                  # App Router 页面
        │   ├── globals.css       # Tailwind + 像素风全局样式
        │   ├── layout.tsx        # 根布局
        │   ├── page.tsx          # 首页：根据是否有 token 跳转 login / office
        │   ├── login/
        │   │   └── page.tsx      # 登录 / 注册界面
        │   ├── customize/
        │   │   ├── page.tsx      # 头像定制 + 宠物选择
        │   │   └── personality/
        │   │       └── page.tsx  # 性格编辑器 + LLM 测试回复预览
        │   └── office/
        │       └── page.tsx      # 办公室主界面（Phaser 画布 + 聊天 + 控制栏）
        ├── components/
        │   ├── ChatPanel.tsx     # 聊天面板（消息气泡、输入框）
        │   ├── ControlToggle.tsx # AFK / 控制角色或宠物 / 站起按钮
        │   ├── PhaserGame.tsx   # Phaser 3 动态加载包装组件
        │   ├── PixelAvatar.tsx  # Canvas 像素头像预览
        │   ├── MessageNotification.tsx   # 新消息弹窗通知
        │   ├── AnnouncementPanel.tsx      # 公告墙面板（系统消息 + 个人帖子）
        │   ├── AnnouncementNotification.tsx # 公告更新弹窗
        │   ├── NotePanel.tsx    # 便签/任务面板
        │   ├── StatusSetter.tsx # 状态设置（头顶显示文案）
        │   └── EasterEggSetter.tsx # 盆栽彩蛋：藏/发现彩蛋
        ├── game/
        │   ├── maps/
        │   │   ├── officeMap.ts  # 40×30 瓦片地图 + 12 张桌子 + 家具 + 区域标签
        │   │   └── tileRegistry.ts # 瓦片类型注册表
        │   ├── scenes/
        │   │   └── OfficeScene.ts
        │   │       # Phaser 主场景：地图渲染、角色/宠物精灵、键盘移动、
        │   │       # 碰撞、近距检测（桌子/其他角色）、WS 事件桥接
        │   └── sprites/
        │       └── colors.ts    # 肤色、发色、服装、宠物配色表
        └── lib/
            ├── api.ts           # REST API 客户端（auth/profile/chat/note/announcement/easter_egg）
            ├── auth.tsx         # Auth Context（localStorage 中管理 token）
            ├── ws.ts            # WebSocket 客户端（自动重连 + 订阅事件）
            └── emoji.ts         # 表情符号工具
```

---

## 逻辑模块概览

### 身份认证（backend/app/api/auth.py）

- 注册：`POST /api/auth/register`
- 登录：`POST /api/auth/login`
- 使用 bcrypt 存储密码、使用 JWT 做会话（`core/security.py`）。

### 用户资料（backend/app/api/profile.py）

- `GET /api/profile/me`：获取当前用户 profile。
- `PUT /api/profile/avatar`：更新头像配置（前端 AvatarConfig）。
- `PUT /api/profile/pet`：是否养宠物 + 选择宠物类型。
- `PUT /api/profile/personality`：人物性格文本（作为 LLM system prompt）。
- `PUT /api/profile/afk`：挂机开关，影响是否由 LLM 自动回复。
- `PUT /api/profile/status`：角色头顶状态文案（含 emoji，最多约 15 字）。
- `POST /api/profile/test-personality`：用当前性格描述 + 示例消息测试 LLM 回复。

### 聊天（backend/app/api/chat.py）

- `GET /api/chat/history?with_user_id=&limit=`：获取与指定用户的聊天历史（REST 持久化，WS 实时收发）。

### 便签/任务（backend/app/api/note.py）

- `GET /api/note`：获取当前便签（Note + NoteItem + Task）。
- `POST /api/note/task`：创建任务并加入便签。
- `POST /api/note/add`：将已有待办加入便签。
- `PUT /api/note/complete/{task_id}`：完成任务。
- `DELETE /api/note/clear`：清空便签（任务保留）。
- `PUT /api/note/reorder`：便签项排序。
- `DELETE /api/note/item/{note_item_id}`：从便签移除单项。
- `GET /api/note/box/pending`：待办池。
- `GET /api/note/box/completed`：已完成池。

### 公告墙（backend/app/api/announcement.py）

- `GET /api/announcement/feed`：系统消息 + 个人帖子流。
- `GET /api/announcement/feed/summary`：最新时间戳摘要。
- `GET /api/announcement/unread-count`：未读数量。
- `POST /api/announcement/post`：发个人帖子（文字/图片）。
- `DELETE /api/announcement/post/{post_id}`：删除自己的帖子。
- `POST /api/announcement/like`、`POST /api/announcement/unlike`：点赞/取消点赞。
- `GET /api/announcement/comments`：评论列表。
- `POST /api/announcement/comment`：发表评论。
- `POST /api/announcement/system/generate`：手动触发系统公告生成（测试用）。

### 盆栽彩蛋（backend/app/api/easter_egg.py）

- `GET /api/easter-egg/plants`：获取所有盆栽的彩蛋状态。
- `POST /api/easter-egg/hide`：在盆栽中藏彩蛋。
- `POST /api/easter-egg/discover/{plant_id}`：发现彩蛋（生成系统公告并清除彩蛋）。

### 实时世界与 WebSocket（backend/app/ws）

- `manager.py`：管理在线连接、角色/宠物位置、桌子/会议椅/餐椅/跑步机占用、AFK 状态等。
- `world.py`：统一处理 WS 消息：
  - `move`：角色 / 宠物移动广播。
  - `chat_send`：聊天消息路由，持久化到 ChatMessage，若目标用户 AFK + 有 personality 则调用 LLM 自动回复。
  - `sit_at_desk` / `stand_up`：办公桌坐下 / 站起。
  - `sit_meeting_chair` / `sit_dining_chair` / `on_treadmill`：会议椅、餐椅、跑步机占用。
  - `set_afk` / `control_target`：挂机开关、控制目标（人物/宠物）切换。
  - 会议厅/用餐区多人时自动生成系统公告。
- `office_animals.py`：办公室动物 AI 循环，定期广播动物位置。

### LLM 挂机回复（backend/app/services/llm_client.py）

- 封装 OpenAI-compatible `/chat/completions` 接口。
- `generate_afk_reply(personality, chat_history, incoming_message)`：
  - 以人物性格为 system prompt，结合最近对话 + 当前消息生成一条简短回复。
  - 所有 LLM 地址、Key、模型名均在 `.env` 中配置。

### 公告服务（backend/app/services/announcement_service.py）

- `generate_system_messages(db)`：每日 10 点后生成系统公告（连续打卡、任务完成等）。
- `refresh_user_daily_stat(db, user_id)`：刷新用户每日统计（便签使用、全部完成）。

### 后台任务（main.py lifespan）

- 动物循环：`run_office_animals_loop` 定期广播动物位置。
- 公告调度：每日 10 点后执行 `generate_system_messages`，有新公告时广播 `announcement_updated`。

---

## 前端页面流转

1. `login/page.tsx`：注册/登录 → 保存 JWT 到 `localStorage` → 跳转 `/customize`。
2. `customize/page.tsx`：配置头像 + 宠物 → 保存到 `/api/profile/avatar` 和 `/api/profile/pet` → 跳转 `/customize/personality`。
3. `customize/personality/page.tsx`：编辑性格描述 + 预设模板 + 测试 LLM 回复 → 保存到 `/api/profile/personality` → 进入 `/office`。
4. `office/page.tsx`：
   - 通过 WebSocket 加入虚拟办公室（世界同步）。
   - 嵌入 Phaser 场景，键盘控制人物 / 宠物移动，靠近桌子/会议椅/餐椅/跑步机弹出“坐下”按钮。
   - 左上角显示在线用户列表，右侧聊天窗口与近距离聊天入口。
   - 便签面板（NotePanel）、公告墙（AnnouncementPanel）、状态设置（StatusSetter）、盆栽彩蛋（EasterEggSetter）。
   - AFK 模式开启后，别人与该角色聊天将触发后端 LLM 自动回复。

---

## 场景与空间布局（简要）

- **办公区**：12 张独立工位，每张桌子上有一台笔记本 + 一个显示屏，角色可“坐下办公”。
- **会议厅**：大会议桌，位于地图左下的第一块区域；多人坐下时生成系统公告。
- **用餐区**：零食、泡面、咖啡机道具，位于右下第一块区域；多人坐下时生成系统公告。
- **游戏室**：一张桌球台，位于左下第二块区域。
- **跑步机区**：跑步机，可坐下占用。
- **宠物区**：有围栏的草地区域，所有宠物首次出现位置在此，之后可由用户通过键盘控制宠物移动。
- **盆栽区**：6 盆植物，可藏彩蛋、发现彩蛋。

---

## 启动方式（简述）

- **后端（推荐 conda 环境 `virtual_office`）**
  - `conda activate virtual_office`
  - `cd backend && pip install -r requirements.txt`
  - `cp .env.example .env` 并填写 LLM 配置
  - `python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`

- **前端**
  - `cd frontend && npm install`
  - `npm run dev` 或 `npm run start`
  - 浏览器访问：`http://localhost:3000`
