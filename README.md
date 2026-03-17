# Soul Journey

灵魂旅程 (Soul Journey) 是一款基于 AI 的深度心理与情感匹配系统。通过 60 道专业维度的问题，结合大语言模型的深度分析，为你绘制专属的灵魂图谱。

## 🚀 快速开始

### 1. 克隆并安装依赖

```bash
git clone <your-repo-url>
cd xoin
npm install
```

### 2. 环境配置

在项目根目录创建一个 `.env.local` 文件，并填入以下环境变量：

```env
# Google Gemini API Key (用于 AI 灵魂分析)
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# Supabase 配置 (用于数据持久化与匹配引擎)
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> **重要安全提示**: 永远不要将 `.env.local` 文件提交到 GitHub。该文件已包含在 `.gitignore` 中。

### 3. 运行开发服务器

```bash
npm run dev
```

## 🛠️ 核心架构

- **前端**: React + Vite + Tailwind CSS + Framer Motion (实现流畅动效)
- **后端**: Supabase (PostgreSQL + pgvector 实现高维向量匹配)
- **AI**: Google Gemini API (深度描述与性格建模)

## 📡 环境变量说明

| 变量名                   | 描述                            | 获取方式                                                   |
| :----------------------- | :------------------------------ | :--------------------------------------------------------- |
| `VITE_GEMINI_API_KEY`    | Google AI Studio 的 API 密钥    | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `VITE_SUPABASE_URL`      | Supabase 项目的 API URL         | Supabase Dashboard > Settings > API                        |
| `VITE_SUPABASE_ANON_KEY` | Supabase 项目的 Anon/Public Key | Supabase Dashboard > Settings > API                        |

## 📦 部署建议

该项目是静态单页应用 (SPA)，可以轻松部署在以下平台：

- **Vercel / Netlify / Cloudflare Pages**: 推荐，支持自动化的环境变量配置与 CI/CD。
- **配置注意**: 在部署平台的设置界面中，务必添加上述三个 `VITE_` 开头的环境变量。
