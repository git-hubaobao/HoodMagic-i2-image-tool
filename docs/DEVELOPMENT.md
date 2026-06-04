# Development

## 环境要求

- Node.js `>= 24.11.1`
- pnpm `10.27.0`
- Windows 10/11

## 安装

```bash
pnpm install
```

## 开发

```bash
pnpm dev
```

## 构建

```bash
pnpm build
```

## Lint

```bash
pnpm lint
```

## Test

```bash
pnpm test
```

## Package

```bash
pnpm package
```

## Windows 注意事项

- 不要把桌面上的真实 API 配置文件复制进项目
- 如果安装包被系统拦截，先确认签名策略和 Defender 提示
- 如果 `pnpm dev` 打不开窗口，先确认 Electron 依赖安装完整
