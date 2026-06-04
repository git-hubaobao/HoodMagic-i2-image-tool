# API Template

## 官方兼容接口

项目保留一个内置模板：`Compatible API`。它面向标准 Images API 或兼容代理。

## 用户自建模板

用户可以在应用内新增、编辑、删除自定义模板。

## Base URL

- 内置模板默认 `https://api.openai.com`
- 用户模板可配置自定义 Base URL

## Generation Endpoint

- 默认 `/v1/images/generations`

## Edit Endpoint

- 默认 `/v1/images/edits`

## API Key 隔离

- API Key 按模板 ID 存储
- 切换模板时使用对应模板的凭据
- 不应把真实 API Key 写入仓库文件
