# HoodMagic i2 macOS 版本

这个目录集中保存 macOS 版本相关内容，包括 macOS 专用打包配置、图标资源、构建脚本和兼容性说明。应用源码仍复用项目根目录下的 `apps/image-tool`，避免维护两套业务代码。

## 兼容性结论

从当前代码和配置看，HoodMagic i2 具备 macOS 运行基础：

- 主进程使用 Electron 的 `app.getPath('userData')` 保存本地数据，不依赖 Windows 固定目录。
- 文件路径使用 Node `path` API 组合，未发现业务逻辑硬编码 Windows 盘符。
- 窗口生命周期已经包含 macOS 常见行为：关闭全部窗口后不会立即退出，Dock 激活时可重新创建窗口。
- 参考图上传、粘贴、拖拽、图片预览、任务队列和 API 请求逻辑都运行在 Electron/浏览器标准能力上。
- Windows 专用的 `rcedit.exe` 图标修复脚本只在 `win32` 平台执行，不会影响 macOS 打包。

需要注意的是，macOS 最终安装包建议在真实 macOS 环境中打包、签名和公证。Windows 上可以做 TypeScript/Electron 代码构建检查，但不能作为最终 macOS 安装包产出环境。

## 文件说明

```text
macos-version/
  README.md                     # macOS 版本说明
  electron-builder.macos.yml    # macOS 专用 electron-builder 配置
  assets/
    icon.icns                   # macOS App 图标
  github-actions/
    build-macos.yml             # GitHub Actions macOS runner 模板
  scripts/
    build-macos.sh              # macOS/Linux shell 构建脚本
    build-macos.ps1             # PowerShell 构建入口，会检查当前系统
```

## 在 macOS 上打包

在 macOS 机器上进入项目根目录后执行：

```bash
chmod +x macos-version/scripts/build-macos.sh
macos-version/scripts/build-macos.sh
```

脚本会执行：

```bash
pnpm install
pnpm --filter image-tool build
pnpm --filter image-tool exec electron-builder \
  --config ../../macos-version/electron-builder.macos.yml \
  --mac dmg zip \
  --universal \
  --publish never
```

产物会输出到：

```text
macos-version/dist/
```

常见产物包括：

```text
HoodMagic-i2-mac-universal-1.0.0.dmg
HoodMagic-i2-mac-universal-1.0.0.zip
```

## 签名与公证

当前配置默认生成未签名包，适合本地验证。正式分发给其他 macOS 用户时，建议使用 Apple Developer 证书进行签名和公证，否则用户首次打开时可能遇到 Gatekeeper 拦截。

正式签名通常需要在 macOS 环境设置以下信息：

```bash
export CSC_IDENTITY_AUTO_DISCOVERY=true
export APPLE_ID="your-apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="YOURTEAMID"
```

如暂时只做内部测试，可以保持当前未签名配置，并在目标 Mac 上通过系统安全设置手动允许打开。

## Windows 环境说明

当前项目所在机器是 Windows。可以在 Windows 上完成：

- 代码兼容性检查
- TypeScript 构建
- macOS 专用配置准备
- macOS 图标资源准备

但不能在 Windows 上直接产出最终 macOS `.dmg`。electron-builder 会直接拒绝在 Windows 上构建 macOS 目标，并提示 macOS 构建只支持在 macOS 上运行。electron-builder 官方也提醒不要把多平台打包当作“任意平台生成全部平台安装包”的流程；macOS 签名只能在 macOS 上完成。

## GitHub Actions 模板

如果没有本地 Mac，也可以借助 GitHub Actions 的 macOS runner 打包。本目录提供了模板：

```text
macos-version/github-actions/build-macos.yml
```

GitHub 只会识别仓库根目录 `.github/workflows/` 下的 workflow 文件，因此模板默认放在本目录内，不会自动启用。需要远程打包时，再把模板复制到 `.github/workflows/build-macos.yml`，运行完成后从 Actions artifact 下载 `macos-version/dist/` 内的安装包。

## 发布前检查

在 macOS 打包前建议先执行：

```bash
pnpm build
pnpm test
git status --short
```

如果需要分发给外部用户，还应完成：

- Apple Developer 证书签名
- Notarization 公证
- 在 Intel Mac 和 Apple Silicon Mac 上分别安装启动验证
- 生成包体 SHA256 校验值
