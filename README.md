# Version Source

一个最小的 TypeScript Cloudflare Worker，为 `version-select` 提供固定目录 API。

## 本地运行

需要 Node.js 24+。首次运行：

```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

默认 Token 是 `.dev.vars` 中的 `MOCK_CATALOG_TOKEN`。接口示例：

```bash
curl http://localhost:8787/catalog/v1/health

curl -H 'Authorization: Bearer replace-me' \
  'http://localhost:8787/catalog/v1/services?query=api&limit=2'

curl -H 'Authorization: Bearer replace-me' \
  'http://localhost:8787/catalog/v1/services/payments-api/versions?query=2.4&limit=50'
```

目录数据直接维护在 `src/data.ts`，修改后重新部署即可。

## 常用命令

```bash
npm run dev        # 本地开发
npm test           # 运行测试
npm run typecheck  # TypeScript 检查
npm run check      # 完整校验和部署 dry-run
npm run deploy     # 部署 Worker
```

## 部署

手动部署前先登录 Wrangler 并创建 Token Secret：

```bash
npx wrangler login
npx wrangler secret put MOCK_CATALOG_TOKEN
npm run deploy
```

GitHub Actions 会校验所有 push 和 pull request，并在 `main` push 校验通过后自动部署。仓库需要配置三个 Actions Secret：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `MOCK_CATALOG_TOKEN`

