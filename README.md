# HoodMagic小魔帽 - i2 生图工具

HoodMagic小魔帽 i2 生图工具是一个独立的桌面端 AI 图像创作工具，基于 Electron、React 和 TypeScript 构建。它面向日常图片生成、参考图生成、局部重绘、提示词模板沉淀和多会话项目管理，适合把常用生图流程整理成一个可长期使用的本地工作台。

项目已经从原始 monorepo 中独立出来，当前仓库只保留 i2 生图工具所需的应用层、存储层、任务队列、模型定义和接口适配代码。仓库不包含真实 API Key、用户历史图片、运行数据或安装包构建产物。

<img width="1067" height="855" alt="窗口界面预览" src="https://github.com/user-attachments/assets/b8315c92-4145-407d-9b8f-b2c1bc2efdf5" />

<img width="1145" height="823" alt="提示词模板库" src="https://github.com/user-attachments/assets/4a719709-3190-4ad1-b0c8-7ddf7718ad69" />


## 项目定位

- 桌面端优先：使用 Electron 打包为 Windows 安装包，也保留 macOS 和 Linux 的构建配置。
- 生图流程优先：围绕文生图、图生图、参考图上传、局部编辑和历史复用设计。
- 本地数据优先：项目、会话、历史任务、提示词模板等数据保存在本机应用数据目录。
- 接口兼容优先：内置 Compatible API 模板，可对接标准 Images API 或兼容代理服务。
- 可维护优先：应用被拆分为 workspace 包，核心模型、存储、任务和 provider adapter 独立维护。

## 核心功能

### 图片生成

- 文生图：输入提示词后直接创建生成任务。
- 图生图：上传参考图后使用同一提示词入口发起生成。
- 多尺寸预设：内置常用尺寸，包含 4K 横图等高分辨率配置。
- 质量与格式配置：支持质量、输出格式等生成参数。
- 生成历史：结果会进入当前会话历史，可继续保存、复用、编辑或再次生成。

### 参考图上传

- 点击输入区的加号选择本地图片。
- 支持复制图片后使用快捷键粘贴上传。
- 支持把图片文件直接拖入应用窗口上传。
- 参考图会参与当前输入框的生成请求，不需要额外切换页面。

### 图片预览与查看

- 点击结果图片可打开大图预览窗口。
- 鼠标滚轮缩放会以当前鼠标位置为锚点放大或缩小。
- 图片可自由拖动查看细节，不必等到放大到特定比例。
- 预览窗口会跟随应用窗口尺寸响应式变化，适合在不同窗口比例下检查图片。
- 支持适应屏幕、100% 查看、保存图片和关闭预览。

### 局部编辑

- 支持基于源图和 mask 的局部重绘流程。
- 支持 `compatible` 和 `original` 两种编辑模式。
- mask 建议使用 PNG，尺寸需要与源图保持一致。
- 编辑结果会写回任务历史和当前会话，方便继续迭代。

### 多会话与项目管理

- 支持项目分组和多聊天会话。
- 未选择聊天时，可以直接在主界面输入提示词并生成，应用会自动创建新聊天。
- 支持会话回收站，删除后的内容可集中管理。
- 历史记录与会话 ID 关联，便于按项目追溯创作过程。

### 提示词模板库

- 支持文生图模板和图生图模板。
- 支持模板分类、收藏、变量占位和默认值。
- 支持给模板附加预览图，作为本地资源保存。
- 支持导入单个模板或模板包。
- 支持导出单个模板、分类模板或全部模板。
- 支持把当前生成提示词另存为模板，方便沉淀常用风格。

### API 模板与配置

- 内置 Compatible API 模板。
- 默认 Base URL 为 `https://api.openai.com`。
- 默认生成接口为 `/v1/images/generations`。
- 默认编辑接口为 `/v1/images/edits`。
- 支持在应用设置中新增、编辑、删除自定义 API 模板。
- API Key 按模板隔离保存，只应在应用运行时配置，不应写入仓库文件。

### 主题与界面

- 支持深色和浅色主题切换。
- 支持中文界面。
- 桌面端窗口、侧边栏、聊天区、输入区和设置区围绕高频生图工作流组织。

## 技术栈

- Electron `41.2.1`
- electron-vite `5.0.0`
- React `19.2.0`
- TypeScript `5.8`
- pnpm workspace `10.27.0`
- Vitest `3.2`
- Biome、ESLint、oxlint
- electron-builder `26.8`

## 目录结构

```text
HoodMagic-i2-image-tool/
  apps/
    image-tool/                 # Electron 桌面应用
      src/main/                 # 主进程、IPC、任务执行、本地持久化
      src/preload/              # contextBridge 暴露的安全 API
      src/renderer/             # React 单页界面
      electron-builder.yml      # 安装包构建配置
      electron.vite.config.ts   # Electron Vite 配置
  packages/
    model-core/                 # 通用类型和模型定义
    provider-adapters/          # Images API 适配层
    storage/                    # 项目、会话、历史、模板等本地存储逻辑
    task-core/                  # 任务队列与任务状态模型
  docs/                         # 架构、开发、发布、API、编辑、模板库文档
  .env.example                  # 环境变量示例，不包含真实密钥
```

## 环境要求

- Node.js `>= 24.11.1`
- pnpm `10.27.0`
- Windows 10/11 用于完整安装包验证

建议使用仓库声明的 pnpm 版本，避免 lockfile 或 workspace 解析差异。

## 快速开始

安装依赖：

```bash
pnpm install
```

启动开发环境：

```bash
pnpm dev
```

启动后会打开 Electron 桌面窗口。首次使用需要在应用设置中配置 API Base URL、模型和 API Key。

## 常用命令

```bash
# 构建 renderer、preload 和 main 产物
pnpm build

# 运行单元测试
pnpm test

# 格式化代码
pnpm format

# 检查格式、lint 并尝试自动修复
pnpm lint

# 打包安装包
pnpm package
```

`pnpm package` 会调用 `apps/image-tool` 的 electron-builder 配置。Windows 下默认生成的安装包文件名类似：

```text
HoodMagic-i2-Setup-1.0.0.exe
```

## 使用流程

1. 启动应用并进入设置。
2. 选择内置 Compatible API 模板，或创建自定义 API 模板。
3. 配置 Base URL、模型名和 API Key。
4. 回到主界面，直接输入提示词并生成图片。
5. 需要参考图时，可以点击加号、粘贴图片或把图片拖入窗口。
6. 点击生成结果查看大图，使用滚轮和拖动检查细节。
7. 对满意的提示词保存为模板，后续在模板库中复用。

## 数据与安全边界

本仓库只保存源代码、配置模板、文档和测试，不保存运行期隐私数据。

不应提交到 GitHub 的内容包括：

- 真实 API Key、token、cookie 或代理鉴权信息。
- 用户生成历史图片。
- 应用运行时的数据文件。
- 私有提示词模板库。
- `node_modules`、`out`、`dist`、release 安装包等构建产物。

API Key 应在应用设置界面中配置。本地运行数据由 Electron 的用户数据目录管理，仓库中的 `.env.example` 只作为安全提示，不包含真实密钥。

## 常见问题

### 启动后无法生成图片

先检查应用设置中的 Base URL、模型名和 API Key 是否正确。兼容代理服务还需要确认生成接口和编辑接口是否与标准 Images API 行为一致。

### 参考图没有被带入请求

确认图片已经显示在输入区附件列表中。支持的上传方式包括点击加号、粘贴剪贴板图片、拖拽图片文件到窗口。

### 局部编辑请求失败

优先检查源图和 mask 的尺寸是否一致，mask 是否为 PNG，以及上游接口是否支持 `/v1/images/edits` 的 multipart 提交。

### 打包失败

先确认依赖安装完整、Node 版本符合要求，并重新执行：

```bash
pnpm install
pnpm build
pnpm package
```

如果是 Windows 安装包构建失败，还需要确认 electron-builder 依赖下载是否可访问。

## 发布前检查

发布或上传仓库前建议执行：

```bash
pnpm build
pnpm test
git status --short
```

同时建议在本地额外扫描旧项目关键词，确认仓库内不包含历史品牌痕迹。README 不直接写入这些关键词，避免把检查项本身变成残留内容。

## License

Apache-2.0
