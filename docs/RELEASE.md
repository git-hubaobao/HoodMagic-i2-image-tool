# Release

## 打包命令

```bash
pnpm package
```

## 版本规则

当前精简项目默认版本号在 `apps/image-tool/package.json` 中维护。

## 安装包输出目录

- `C:\Users\15651\Desktop\HoodMagic-i2-release`

## SHA256 生成方式

Windows 可用：

```powershell
Get-FileHash .\\HoodMagic-i2-Setup-<version>.exe -Algorithm SHA256
```

## 发布前检查表

- `pnpm install` 成功
- `pnpm build` 成功
- `pnpm lint` 成功
- `pnpm test` 成功
- `pnpm dev` 可启动
- release 目录不混入源码、API Key、用户数据
