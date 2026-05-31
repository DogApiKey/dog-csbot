# Railway 部署指南

## 架构

```
┌─────────────────────────────────────────────────────┐
│                    Railway Project                   │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐ │
│  │ PostgreSQL│  │  Redis   │  │  CSBot Server     │ │
│  │ (内置)    │  │ (内置)   │  │  (Docker)         │ │
│  └──────────┘  └──────────┘  └───────────────────┘ │
│                                                      │
│  ┌──────────────────┐  ┌──────────────────────────┐ │
│  │  Admin Dashboard │  │  Qdrant (可选，后续)     │ │
│  │  (Static Site)   │  │                          │ │
│  └──────────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## 部署步骤

### 1. 创建 Railway Project

```bash
# 安装 Railway CLI
npm i -g @railway/cli

# 登录
railway login

# 创建项目
railway init
```

### 2. 添加数据库服务

在 Railway Dashboard 中：

1. 点击 **"+ New"** → **"Database"** → **"PostgreSQL"**
2. 点击 **"+ New"** → **"Database"** → **"Redis"**

记下自动生成的连接变量：
- `DATABASE_URL`
- `REDIS_URL`

### 3. 部署 CSBot Server

```bash
# 在项目根目录
cd /Users/orca/Code/typescript/csbot

# 关联 Railway 项目
railway link

# 添加环境变量
railway variables set LLM_PROVIDER=openai
railway variables set LLM_MODEL=mimo-v2.5-pro
railway variables set LLM_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1
railway variables set LLM_API_KEY=tp-cu7wexg7ylyz6p8ohxe0tcoxaxahtqf93lpebwvgbaf8awc3
railway variables set CORS_ORIGINS=*

# 部署
railway up --service csbot-server
```

或者在 Railway Dashboard 中：

1. 点击 **"+ New"** → **"GitHub Repo"**
2. 选择 `DogApiKey/dog-csbot`
3. 设置 Root Directory 为 `/`
4. 设置 Dockerfile 路径为 `packages/server/Dockerfile`
5. 添加环境变量

### 4. 部署 Admin Dashboard

方式 A: 作为 Static Site（推荐）

```bash
# 在 Railway Dashboard
# 点击 "+ New" → "GitHub Repo"
# 选择 DogApiKey/dog-csbot
# 设置 Root Directory 为 packages/admin
# 设置 Build Command: npm run build
# 设置 Output Directory: dist
```

方式 B: 本地构建后部署

```bash
cd packages/admin
npm run build

# 用 Railway 部署静态文件
railway up --service csbot-admin
```

### 5. 环境变量清单

| 变量 | 说明 | 示例 |
|---|---|---|
| `PORT` | 服务端口（Railway 自动设置） | `3000` |
| `DATABASE_URL` | PostgreSQL 连接（Railway 自动生成） | `postgres://...` |
| `REDIS_URL` | Redis 连接（Railway 自动生成） | `redis://...` |
| `LLM_PROVIDER` | LLM 提供商 | `openai` |
| `LLM_MODEL` | 模型名称 | `mimo-v2.5-pro` |
| `LLM_BASE_URL` | LLM API 地址 | `https://...` |
| `LLM_API_KEY` | LLM API Key | `tp-xxx` |
| `CORS_ORIGINS` | 允许的跨域来源 | `*` |

### 6. 绑定自定义域名

在 Railway Dashboard 中：

1. 选择服务 → **Settings** → **Networking**
2. 点击 **"Generate Domain"** 获取 `.up.railway.app` 域名
3. 或点击 **"Custom Domain"** 绑定你的域名

建议域名规划：
- `api.dogapi.com` → CSBot Server
- `admin.dogapi.com` → Admin Dashboard

### 7. 持续部署

连接 GitHub 仓库后，每次 push 到 main 分支会自动部署。

## 本地开发 vs Railway 生产

| 配置 | 本地开发 | Railway 生产 |
|---|---|---|
| PostgreSQL | Docker | Railway 内置 |
| Redis | Docker | Railway 内置 |
| Qdrant | Docker | 暂不部署（用关键词搜索） |
| Server | `bun run dev` | Docker |
| Admin | `vite dev` | Static Site |
