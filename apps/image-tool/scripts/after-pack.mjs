import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const hookDir = dirname(fileURLToPath(import.meta.url))
const appRoot = resolve(hookDir, '..')
const workspaceRoot = resolve(appRoot, '../..')

const findRceditPath = async () => {
  const pnpmStoreDir = join(workspaceRoot, 'node_modules', '.pnpm')
  const packageDirs = await readdir(pnpmStoreDir)
  const electronWinstallerDir = packageDirs.find((packageDir) => packageDir.startsWith('electron-winstaller@'))

  if (!electronWinstallerDir) {
    throw new Error('Could not find electron-winstaller in node_modules/.pnpm')
  }

  const rceditPath = join(
    pnpmStoreDir,
    electronWinstallerDir,
    'node_modules',
    'electron-winstaller',
    'vendor',
    'rcedit.exe'
  )

  if (!existsSync(rceditPath)) {
    throw new Error(`Could not find rcedit at ${rceditPath}`)
  }

  return rceditPath
}

export default async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') {
    return
  }

  const iconPath = join(appRoot, 'build', 'icon.ico')
  const exePath = join(context.appOutDir, 'HoodMagic-i2.exe')

  if (!existsSync(iconPath)) {
    throw new Error(`Could not find Windows icon at ${iconPath}`)
  }

  if (!existsSync(exePath)) {
    throw new Error(`Could not find packaged executable at ${exePath}`)
  }

  const rceditPath = await findRceditPath()
  await execFileAsync(rceditPath, [exePath, '--set-icon', iconPath])
}
