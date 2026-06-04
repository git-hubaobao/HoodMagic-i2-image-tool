# Architecture

## Electron 架构

- Electron `main` 负责窗口、IPC、任务执行和本地持久化
- `preload` 用 `contextBridge` 暴露 `window.imageTool`
- `renderer` 是 React 单页界面

## 文生图链路

1. renderer 组装请求
2. preload 透传到 main IPC
3. main 调 `provider-adapters/image2`
4. 返回标准化结果
5. main 写入历史和会话状态
6. renderer 展示图片和元数据

## 图生图链路

1. renderer 准备参考图
2. main 材料化图片数据和尺寸
3. adapter 走 multipart `image` 提交
4. 返回结果后入历史

## 局部编辑链路

1. renderer 生成源图与 mask
2. main 校验 mask 类型、大小、尺寸
3. adapter 走 `/v1/images/edits`
4. 结果入队列、入历史、回写会话

## 任务队列链路

1. renderer 创建任务
2. main 创建 `queued` 任务
3. 执行时切到 `running`
4. 成功切到 `succeeded`
5. 失败切到 `failed`
6. 通过 IPC 事件同步到 renderer

## 提示词模板库链路

1. renderer 编辑模板、分类、预览图
2. main 负责导入导出、预览图资产落盘
3. `storage` 负责模板和分类数据清洗

## 多会话链路

- `storage` 管理项目组、会话、回收站和活动会话
- 历史记录与会话 ID 关联
- 删除走回收站，永久删除会清理对应历史图
