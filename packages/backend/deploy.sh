#!/bin/bash

# Cloudflare Workers 部署脚本
# 用法: ./deploy.sh [init|deploy]

set -e

# 取消代理设置，避免 wrangler 请求被代理拦截
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY all_proxy ALL_PROXY

echo "🚀 MeiTrans Backend 部署工具"
echo "================================"

case "$1" in
  init)
    echo ""
    echo "📦 初始化 Cloudflare 资源..."
    echo ""

    # 登录
    echo "1. 登录 Cloudflare..."
    npx wrangler login

    # 创建 KV
    echo ""
    echo "2. 创建 KV Namespace..."
    npx wrangler kv:namespace create TRANSLATION_CACHE
    echo ""
    echo "⚠️  请复制上面的 'id' 值，更新到 wrangler.toml 的 kv_namespaces.id"
    echo ""

    # 创建预览 KV
    npx wrangler kv:namespace create TRANSLATION_CACHE --preview
    echo ""
    echo "⚠️  请复制上面的 'preview_id' 值，更新到 wrangler.toml 的 kv_namespaces.preview_id"
    echo ""

    # 创建 D1
    echo "3. 创建 D1 数据库..."
    npx wrangler d1 create webtrans-memory
    echo ""
    echo "⚠️  请复制上面的 'database_id' 值，更新到 wrangler.toml 的 d1_databases.database_id"
    echo ""

    echo "================================"
    echo "✅ 资源创建完成！"
    echo ""
    echo "📝 下一步："
    echo "  1. 编辑 wrangler.toml，填入上面创建的 ID"
    echo "  2. 运行 ./deploy.sh migrate 初始化数据库"
    echo "  3. 运行 ./deploy.sh deploy 部署应用"
    ;;

  migrate)
    echo ""
    echo "📦 初始化 D1 数据库表 (线上)..."
    npx wrangler d1 execute webtrans-memory --remote --file=./src/db/schema.sql
    echo ""
    echo "✅ 数据库初始化完成！"
    ;;

  deploy)
    echo ""
    echo "🚀 部署到 Cloudflare Workers..."
    npx wrangler deploy
    echo ""
    echo "✅ 部署完成！"
    echo ""
    echo "📝 部署后："
    echo "  1. 复制部署后的 URL (例如: https://webtrans-api.xxx.workers.dev)"
    echo "  2. 更新 packages/extension/vite.config.ts 中的生产环境 API URL"
    echo "  3. 重新打包扩展: pnpm build:extension"
    ;;

  login)
    echo ""
    echo "🔑 登录 Cloudflare..."
    npx wrangler login
    echo ""
    echo "✅ 登录完成！"
    ;;

  *)
    echo ""
    echo "用法: ./deploy.sh [命令]"
    echo ""
    echo "命令:"
    echo "  login    - 仅登录 Cloudflare 账号"
    echo "  init     - 初始化 Cloudflare 资源 (KV, D1)"
    echo "  migrate  - 初始化数据库表结构"
    echo "  deploy   - 部署应用到 Cloudflare Workers"
    echo ""
    echo "首次部署流程:"
    echo "  1. ./deploy.sh init"
    echo "  2. 编辑 wrangler.toml 填入资源 ID"
    echo "  3. ./deploy.sh migrate"
    echo "  4. ./deploy.sh deploy"
    ;;
esac
