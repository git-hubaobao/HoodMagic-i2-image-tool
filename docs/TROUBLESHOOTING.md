# Troubleshooting

## API 未配置

先在应用设置中检查 Base URL、模型名和 API Key。

## API 异常

优先看错误码、HTTP 状态和 request summary，不要把真实密钥写入日志。

## 上游 load saturated

这是上游负载问题，先重试或降低并发，不要改业务请求字段。

## mask size mismatch

mask 尺寸必须与源图一致，否则编辑请求会在本地校验阶段失败。

## 参考图失败

确认参考图是支持的 JPEG / PNG / WEBP，且总大小不超过限制。

## Electron 标题 / 菜单栏

窗口标题应固定为 `HoodMagic小魔帽 - i2 生图工具`，菜单栏应隐藏。

## Windows symlink 测试问题

如果工作区被安全策略限制，优先重新执行 `pnpm install`，避免手工复制依赖目录。
