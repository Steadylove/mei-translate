# MeiTrans - AI 驱动的网页翻译插件

[English](./README.md)

<p align="center">
  <strong>一个基于多 AI 模型的 Chrome 智能翻译扩展</strong>
</p>

<p align="center">
  机器翻译 + 大模型翻译 | PDF 翻译 | 语音朗读 | 8 大 AI 厂商
</p>

---

## 功能特性

### 核心翻译

- **划词翻译** - 在任意网页选中文本，即时获取双重翻译（机器翻译 + AI 翻译）
- **全页翻译** - 一键翻译整个网页内容
- **PDF 翻译** - 上传 PDF 文件，选中文字自动翻译，支持上下分栏对照
- **上下文感知** - 自动检测内容类型（技术文档、新闻、学术论文等），优化翻译质量

### AI 大模型

- **8 大模型厂商** - OpenAI、Claude、DeepSeek、Gemini、通义千问、月之暗面、智谱 GLM、Groq
- **双翻译模式** - 机器翻译（快速免费）+ AI 翻译（高质量）并排展示
- **自带 Key** - 用户自行配置 API Key，随时切换模型
- **智能缓存** - 翻译结果自动缓存，节省 API 费用

### 用户体验

- **语音朗读** - 支持原文和译文的 TTS 朗读
- **可拖拽面板** - 翻译弹窗支持自由拖拽移动
- **快捷键** - `Alt+Shift+T` 全页翻译，`Alt+Shift+D` 打开翻译输入框
- **站点黑名单** - 指定网站禁用翻译
- **翻译记忆** - 自动学习历史翻译，提高效率

## 项目结构

```
webtrans-ext/
├── packages/
│   ├── extension/          # Chrome 扩展（React + TypeScript + Vite）
│   │   ├── src/
│   │   │   ├── popup/      # 扩展弹窗 UI
│   │   │   ├── options/    # 设置页面 & PDF 阅读器
│   │   │   ├── content/    # 内容脚本（注入网页）
│   │   │   ├── background/ # Service Worker
│   │   │   ├── hooks/      # React Hooks（翻译、TTS 等）
│   │   │   ├── services/   # API 服务 & 本地存储
│   │   │   └── components/ # 可复用 UI 组件
│   │   └── dist/           # 构建产物（Chrome 加载此目录）
│   │
│   └── backend/            # API 后端（Cloudflare Workers + Hono）
│       └── src/
│           ├── routes/     # API 路由
│           ├── providers/  # 大模型适配器
│           ├── agents/     # 翻译、摘要、上下文分析
│           └── utils/      # 缓存、哈希工具
```

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 8

### 安装 & 运行

```bash
# 安装依赖
pnpm install

# 启动开发环境（扩展 + 后端）
pnpm dev
```

### 在 Chrome 中加载扩展

1. 打开 `chrome://extensions/`
2. 开启 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择 `packages/extension/dist` 目录

### 配置 AI 模型

1. 点击扩展图标 → **More Settings**
2. 在 AI Model Configuration 中添加任意厂商的 API Key
3. 点击 **Use** 激活，选择你喜欢的模型

> 机器翻译无需任何 API Key 即可使用。AI 翻译需要至少配置一个厂商。

## 开发指南

```bash
# 启动所有服务
pnpm dev

# 仅启动扩展（popup/options 支持热更新）
pnpm dev:extension

# 仅启动后端
pnpm dev:backend

# 生产构建
pnpm build

# 构建扩展（开发模式，使用 localhost API）
cd packages/extension && pnpm build:dev

# 构建扩展（生产模式，使用线上 API）
cd packages/extension && pnpm build

# 代码检查 & 格式化
pnpm lint
pnpm format
```

## 部署

### 后端（Cloudflare Workers）

```bash
cd packages/backend

# 首次部署：初始化资源
./deploy.sh init      # 创建 KV 缓存 + D1 数据库
# 编辑 wrangler.toml 填入生成的资源 ID
./deploy.sh migrate   # 初始化数据库表
./deploy.sh deploy    # 部署到 Cloudflare
```

免费额度：

- 每天 100,000 次请求
- 5 GB D1 数据库存储
- KV 缓存

### 扩展

部署后端后，更新 `packages/extension/vite.config.ts` 中的 API 地址，然后：

```bash
cd packages/extension
pnpm build            # 生产构建
```

在 Chrome 中加载 `dist` 目录，或打包为 `.crx` 分发。

## API 接口

| 接口                       | 方法 | 说明                     |
| -------------------------- | ---- | ------------------------ |
| `/api/translate`           | POST | 单文本翻译（需 API Key） |
| `/api/translate/dual`      | POST | 双翻译（机器 + AI）      |
| `/api/translate/free`      | POST | 免费机器翻译             |
| `/api/translate/batch`     | POST | 批量翻译（最多 50 条）   |
| `/api/translate/detect`    | POST | 语言检测                 |
| `/api/translate/providers` | GET  | 获取支持的 AI 厂商列表   |
| `/api/context`             | POST | 上下文分析               |
| `/api/summary`             | POST | 文本摘要                 |
| `/api/memory/*`            | CRUD | 翻译记忆管理             |

## 支持语言

中文、英文、日文、韩文、法文、德文、西班牙文、俄文、阿拉伯文、葡萄牙文

## 快捷键

| 快捷键        | 功能           |
| ------------- | -------------- |
| `Alt+Shift+T` | 切换全页翻译   |
| `Alt+Shift+D` | 打开翻译输入框 |
| `Esc`         | 关闭翻译弹窗   |

## 技术栈

| 模块     | 技术                                      |
| -------- | ----------------------------------------- |
| 扩展前端 | React 18、TypeScript、Vite、Tailwind CSS  |
| 后端     | Cloudflare Workers、Hono、D1 (SQLite)、KV |
| PDF      | PDF.js (Mozilla)                          |
| 语音     | Web Speech API                            |
| 工程化   | pnpm workspaces                           |

## 开源协议

MIT
