# AI Context

## 项目是什么

这是独立的 `image-tool` 项目，产品名为 `HoodMagic小魔帽`，定位是独立的 `i2 生图工具`。

## 抽取来源

- 只在当前项目 workspace 内读取和修改源码
- 不依赖外部仓库的业务代码
- 当前项目是独立 workspace，不允许再依赖外部绝对路径

## 核心功能

- 文生图
- 图生图 / 参考图生成
- 局部编辑
- 多会话与项目分组
- 任务队列
- API 模板
- 提示词模板库

## 关键路径

- `apps/image-tool/src/main/index.ts`
- `apps/image-tool/src/preload/index.ts`
- `apps/image-tool/src/renderer/src/App.tsx`
- `apps/image-tool/src/shared/image2.ts`
- `packages/storage/src/index.ts`
- `packages/task-core/src/index.ts`
- `packages/provider-adapters/src/image2/index.ts`
- `packages/model-core/src/index.ts`

## main / preload / renderer 分工

- `main`：文件读写、数据持久化、任务执行、IPC、Electron 窗口
- `preload`：把安全桥接 API 暴露给 renderer
- `renderer`：全部 UI、交互、状态编排、编辑器和模板库

## storage / task / provider 分工

- `storage`：image-tool 数据结构、sanitize、迁移、项目/会话/模板管理
- `task-core`：任务类型、状态和安全请求快照
- `provider-adapters`：image2 请求拼装、响应标准化、错误标准化
- `model-core`：图片尺寸校验和预设解析

## API Key 安全规则

- 不把 API Key 写入仓库
- 不把 API Key 输出到 README、docs、测试、日志
- request summary 里不能泄露 API Key

## 不允许乱改的地方

- 不要改 `image2` 的请求字段名
- 不要破坏 `compatible` 编辑模式
- 不要移除内置“官方兼容接口”模板
- 不要删掉多会话、回收站、提示词导入导出

## 常见坑

- `mask` 必须是 PNG，且尺寸要和源图一致
- `pnpm package` 依赖先成功 `pnpm build`
- 打包配置必须指向当前项目，不能引用原 外部 路径
