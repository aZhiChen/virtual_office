## Virtual Office - 项目结构总览

本文件总结虚拟办公室项目的整体结构与主要模块，便于快速理解与维护。

---

## 目录结构

```text
virtual_office/
├── .gitignore
├── README.md
├── PROJECT_OVERVIEW.md          # 本说明文件
├── backend/                     # Python FastAPI 后端
│   ├── .env.example             # 环境变量模板（DB/LLM/JWT 等）
│   ├── requirements.txt
│   └── app/
│       ├── __init__.py
│       ├── main.py              # FastAPI 入口，路由 & CORS & DB 初始化
│       ├── api/
│       │   ├── __init__.py
│       │   ├── auth.py          # 注册 / 登录（JWT）
│       │   └── profile.py       # 头像、宠物、性格、AFK 的 CRUD + 性格测试
│       ├── core/
│       │   ├── __init__.py
│       │   ├── config.py        # 配置（DATABASE_URL / JWT / LLM 等，读 .env）
│       │   ├── database.py      # SQLAlchemy + SQLite Session & Base
│       │   └── security.py      # bcrypt 密码哈希 + JWT 编解码
│       ├── models/
│       │   ├── __init__.py
│       │   └── user.py          # User 表：头像配置、宠物、性格、AFK 状态
│       ├── services/
│       │   ├── __init__.py
│       │   └── llm_client.py    # OpenAI-compatible LLM 客户端（挂机自动回复）
│       └── ws/
│           ├── __init__.py
│           ├── manager.py       # WebSocket 连接与世界状态管理
│           └── world.py         # WS 消息处理（移动、聊天、坐下、AFK 等）
└── frontend/                    # Next.js + Phaser 前端
    ├── next.config.ts
    ├── next-env.d.ts
    ├── package.json
    ├── postcss.config.mjs
    ├── tsconfig.json
    └── src/
        ├── app/                 # App Router 页面
        │   ├── globals.css      # Tailwind + 像素风全局样式
        │   ├── layout.tsx       # 根布局
        │   ├── page.tsx         # 首页：根据是否有 token 跳转 login / office
        │   ├── login/
        │   │   └── page.tsx     # 登录 / 注册界面
        │   ├── customize/
        │   │   ├── page.tsx     # 头像定制 + 宠物选择
        │   │   └── personality/
        │   │       └── page.tsx # 性格编辑器 + LLM 测试回复预览
        │   └── office/
        │       └── page.tsx     # 办公室主界面（Phaser 画布 + 聊天 + 控制栏）
        ├── components/
        │   ├── ChatPanel.tsx    # 聊天面板（消息气泡、输入框）
        │   ├── ControlToggle.tsx# AFK / 控制角色或宠物 / 站起按钮
        │   ├── PhaserGame.tsx   # Phaser 3 动态加载包装组件
        │   └── PixelAvatar.tsx  # Canvas 像素头像预览
        ├── game/
        │   ├── maps/
        │   │   └── officeMap.ts # 40×30 瓦片地图 + 12 张桌子 + 家具 + 区域标签
        │   ├── scenes/
        │   │   └── OfficeScene.ts
        │   │       # Phaser 主场景：地图渲染、角色/宠物精灵、键盘移动、
        │   │       # 碰撞、近距检测（桌子/其他角色）、WS 事件桥接
        │   └── sprites/
        │       └── colors.ts    # 肤色、发色、服装、宠物配色表
        └── lib/
            ├── api.ts           # REST API 客户端（auth/profile/personality 等）
            ├── auth.tsx         # Auth Context（localStorage 中管理 token）
            └── ws.ts            # WebSocket 客户端（自动重连 + 订阅事件）
```

---

## 逻辑模块概览

- **身份认证（backend/app/api/auth.py）**
  - 注册：`POST /api/auth/register`
  - 登录：`POST /api/auth/login`
  - 使用 bcrypt 存储密码、使用 JWT 做会话（`core/security.py`）。

- **用户资料（backend/app/api/profile.py）**
  - `GET /api/profile/me`：获取当前用户 profile。
  - `PUT /api/profile/avatar`：更新头像配置（前端 AvatarConfig）。
  - `PUT /api/profile/pet`：是否养宠物 + 选择宠物类型。
  - `PUT /api/profile/personality`：人物性格文本（作为 LLM system prompt）。
  - `PUT /api/profile/afk`：挂机开关，影响是否由 LLM 自动回复。
  - `POST /api/profile/test-personality`：用当前性格描述 + 示例消息测试 LLM 回复。

- **实时世界与 WebSocket（backend/app/ws）**
  - `manager.py`：管理在线连接、角色/宠物位置、桌子占用、AFK 状态等。
  - `world.py`：统一处理 WS 消息：
    - `move`：角色 / 宠物移动广播。
    - `chat_send`：聊天消息路由，若目标用户 AFK + 有 personality 则调用 LLM 自动回复。
    - `sit_at_desk` / `stand_up`：桌子坐下 / 站起状态的广播。
    - `set_afk` / `control_target`：挂机开关、控制目标（人物/宠物）切换。

- **LLM 挂机回复（backend/app/services/llm_client.py）**
  - 封装 OpenAI-compatible `/chat/completions` 接口。
  - `generate_afk_reply(personality, chat_history, incoming_message)`：
    - 以人物性格为 system prompt，结合最近对话 + 当前消息生成一条简短回复。
    - 所有 LLM 地址、Key、模型名（如 `gpt-5-mini`）均在 `.env` 中配置。

- **前端页面流转**
  1. `login/page.tsx`：注册/登录 → 保存 JWT 到 `localStorage` → 跳转 `/customize`。
  2. `customize/page.tsx`：配置头像 + 宠物 → 保存到 `/api/profile/avatar` 和 `/api/profile/pet` → 跳转 `/customize/personality`。
  3. `customize/personality/page.tsx`：编辑性格描述 + 预设模板 + 测试 LLM 回复 → 保存到 `/api/profile/personality` → 进入 `/office`。
  4. `office/page.tsx`：
     - 通过 WebSocket 加入虚拟办公室（世界同步）。
     - 嵌入 Phaser 场景，键盘控制人物 / 宠物移动，靠近桌子弹出“坐下办公”按钮。
     - 左上角显示在线用户列表，右侧聊天窗口与近距离聊天入口。
     - AFK 模式开启后，别人与该角色聊天将触发后端 LLM 自动回复。

---

## 场景与空间布局（简要）

- **办公区**：12 张独立工位，每张桌子上有一台笔记本 + 一个显示屏，角色可“坐下办公”。
- **会议厅**：大会议桌，位于地图左下的第一块区域。
- **用餐区**：零食、泡面、咖啡机道具，位于右下第一块区域。
- **游戏室**：一张桌球台，位于左下第二块区域。
- **宠物区**：有围栏的草地区域，所有宠物首次出现位置在此，之后可由用户通过键盘控制宠物移动。

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

