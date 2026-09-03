# Version Source

这是一个使用 Go 编写的目录 mock 服务，响应格式与 `version-select` 的固定外部 API 契约一致。服务启动时从 `data.yml` 读取服务、版本和 Bearer Token。健康检查无需 Token，服务及版本接口需要 Bearer Token。

## 本地运行

```bash
go run .
```

验证接口：

```bash
curl http://127.0.0.1:8080/catalog/v1/health

curl -H 'Authorization: Bearer dev-token' \
  'http://127.0.0.1:8080/catalog/v1/services?query=api&limit=2'

curl -H 'Authorization: Bearer dev-token' \
  'http://127.0.0.1:8080/catalog/v1/services/payments-api/versions?query=2.4&limit=50'
```

可用环境变量：

- `CONFIG_FILE`：YAML 文件路径，默认 `data.yml`。
- `MOCK_CATALOG_PORT`：覆盖 `server.address` 中的监听端口，与原 Node mock 兼容。
- `PORT`：覆盖监听端口，优先级高于 `MOCK_CATALOG_PORT`。
- `MOCK_CATALOG_TOKEN`：覆盖 YAML 中的 Token，适合部署时注入 Secret。

YAML 中 `id` 和 `name` 必须是非空字符串；服务 ID 必须全局唯一，同一服务内的版本 ID 必须唯一。修改数据后需要重启进程。

## Docker

```bash
docker build -t version-source .
docker run --rm -p 8080:8080 version-source
```

挂载自定义数据文件：

```bash
docker run --rm -p 8080:8080 \
  -v "$PWD/data.yml:/config/data.yml:ro" \
  -e CONFIG_FILE=/config/data.yml \
  -e MOCK_CATALOG_TOKEN=replace-me \
  version-source
```

`version-select` 部署在 Forge 后不能访问本机 HTTP 地址。联调时需把该服务部署到 HTTPS 环境或通过可信隧道暴露，并在应用配置中批准对应主机。
