import { existsSync } from 'node:fs'
import { join, parse } from 'node:path'

export type ImageToolAppearanceTheme = 'dark' | 'light'

export type ImageToolSettings = {
  appearanceTheme: ImageToolAppearanceTheme
  providerTemplateId: string
  baseUrl: string
  endpointPath: string
  editEndpointPath: string
  model: string
  quality: 'auto' | 'low' | 'medium' | 'high'
  outputFormat: 'png' | 'jpeg' | 'webp'
  sendOutputFormat: boolean
  sendResponseFormat: boolean
  responseFormat?: 'url' | 'b64_json'
  sizeMode: 'auto' | 'fixed'
  sizePreset: string
  saveApiKey: boolean
  providerCredentials: ImageProviderCredentials
  customProviderTemplates: ImageProviderTemplate[]
}

export type ImageProviderCredential = {
  apiKey?: string
}

export type ImageProviderCredentials = Record<string, ImageProviderCredential>

export type ImageProviderTemplate = {
  id: string
  name: string
  description?: string
  defaultBaseUrl: string
  endpointPath: string
  editEndpointPath: string
  model: string
  sendResponseFormat: boolean
  responseFormat?: 'url' | 'b64_json'
  sendOutputFormat: boolean
  outputFormat?: 'png' | 'jpeg' | 'webp'
}

export type ProjectGroup = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  sortOrder: number
  isDefault?: boolean
}

export type Conversation = {
  id: string
  projectId: string | null
  title: string
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
  lastMessageAt?: string
  messageCount?: number
  imageCount?: number
}

export type ImageHistoryItem = {
  id: string
  conversationId: string
  taskId: string
  mode?: 'image_generation' | 'image_reference' | 'image_edit'
  prompt: string
  model: string
  size: string
  quality?: string
  outputFormat?: string
  imagePath?: string
  imageMimeType?: string
  imageFileName?: string
  imageDataUrl?: string
  referenceImages?: ImageHistoryReferenceImage[]
  createdAt: number
  updatedAt: number
  error?: {
    code?: string
    message: string
    status?: number
  }
}

export type ImageHistoryReferenceImage = {
  name: string
  mimeType: string
  size: number
}

export type PromptTemplateType = 'text_to_image' | 'image_to_image'

export type PromptTemplateVariable = {
  key: string
  label: string
  placeholder?: string
  required?: boolean
  defaultValue?: string
}

export type PromptTemplateRecommendedParams = {
  size?: string
  quality?: ImageToolSettings['quality']
  outputFormat?: ImageToolSettings['outputFormat']
}

export type PromptTemplateCategory = {
  id: string
  name: string
  parentId?: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type PromptTemplate = {
  id: string
  categoryId: string | null
  title: string
  description?: string
  templateType: PromptTemplateType
  prompt: string
  variables?: PromptTemplateVariable[]
  tags?: string[]
  previewAssetId?: string
  recommendedParams?: PromptTemplateRecommendedParams
  isFavorite?: boolean
  source?: 'user' | 'imported'
  createdAt: string
  updatedAt: string
}

export type PromptTemplatePreviewImage = {
  mimeType: string
  dataUrl: string
}

export type PromptTemplateImportRecord = Omit<
  Partial<PromptTemplate>,
  'id' | 'categoryId' | 'createdAt' | 'updatedAt' | 'previewAssetId'
> & {
  id?: string
  title: string
  categoryPath?: string[]
  templateType: PromptTemplateType
  prompt: string
  previewImage?: PromptTemplatePreviewImage
  createdAt?: string
  updatedAt?: string
}

export type ImagePromptTemplateFile = {
  schemaVersion: 1
  kind: 'image-prompt-template'
  template: PromptTemplateImportRecord
}

export type ImagePromptPackFile = {
  schemaVersion: 1
  kind: 'image-prompt-pack'
  name: string
  description?: string
  templates: PromptTemplateImportRecord[]
}

export type PromptTemplateImportDocument =
  | {
      kind: 'image-prompt-template'
      templates: PromptTemplateImportRecord[]
    }
  | {
      kind: 'image-prompt-pack'
      name: string
      description?: string
      templates: PromptTemplateImportRecord[]
    }

export type ImageToolData = {
  version: 1
  settings: ImageToolSettings
  projects: ProjectGroup[]
  conversations: Conversation[]
  activeConversationId?: string
  trashRetentionDays?: number
  history: ImageHistoryItem[]
  promptTemplateCategories: PromptTemplateCategory[]
  promptTemplates: PromptTemplate[]
}

export const DEFAULT_PROJECT_ID = 'default'
export const DEFAULT_CONVERSATION_ID = 'default'
export const DEFAULT_PROMPT_TEMPLATE_CATEGORY_ID = 'uncategorized'
export const DEFAULT_PROJECT_NAME = '默认项目'
export const DEFAULT_CONVERSATION_TITLE = '默认会话'
export const NEW_CONVERSATION_TITLE = '新聊天'
export const DEFAULT_PROMPT_TEMPLATE_CATEGORY_NAME = '未分类'

export const COMPATIBLE_PROVIDER_TEMPLATE_ID = 'compatible-default'

const DEFAULT_GENERATION_ENDPOINT_PATH = '/v1/images/generations'
const DEFAULT_EDIT_ENDPOINT_PATH = '/v1/images/edits'
const DEFAULT_IMAGE_MODEL = 'gpt-image-2'
const MIGRATED_PROVIDER_TEMPLATE_NAME = 'Migrated API'
const legacyCompatibleProviderTemplateIds = new Set(['openai-standard'])
const retiredProviderTemplateIds = new Set(['hubaobao', 'custom', 'jiekou-highway', 'jiekou-original'])
export const compatibleImageProviderTemplate: ImageProviderTemplate = {
  id: COMPATIBLE_PROVIDER_TEMPLATE_ID,
  name: 'Compatible API',
  description: 'Works with standard Images API or compatible proxies.',
  defaultBaseUrl: 'https://api.openai.com',
  endpointPath: DEFAULT_GENERATION_ENDPOINT_PATH,
  editEndpointPath: DEFAULT_EDIT_ENDPOINT_PATH,
  model: DEFAULT_IMAGE_MODEL,
  sendResponseFormat: false,
  sendOutputFormat: true
}
export const builtInImageProviderTemplates: readonly ImageProviderTemplate[] = [compatibleImageProviderTemplate]
export const protectedProviderTemplateIds = new Set([COMPATIBLE_PROVIDER_TEMPLATE_ID])
const qualityValues = new Set<ImageToolSettings['quality']>(['auto', 'low', 'medium', 'high'])
const outputFormatValues = new Set<ImageToolSettings['outputFormat']>(['png', 'jpeg', 'webp'])
const responseFormatValues = new Set<NonNullable<ImageToolSettings['responseFormat']>>(['url', 'b64_json'])
const sizeModeValues = new Set<ImageToolSettings['sizeMode']>(['auto', 'fixed'])
const appearanceThemeValues = new Set<ImageToolAppearanceTheme>(['dark', 'light'])
const promptTemplateTypeValues = new Set<PromptTemplateType>(['text_to_image', 'image_to_image'])
const imageMimeTypeToExtension = new Map([
  ['image/jpeg', 'jpeg'],
  ['image/jpg', 'jpeg'],
  ['image/png', 'png'],
  ['image/webp', 'webp']
])

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const stringOrDefault = (value: unknown, fallback: string): string => {
  return typeof value === 'string' ? value : fallback
}

const endpointPathOrDefault = (value: unknown, fallback: string): string => {
  const endpointPath = stringOrDefault(value, fallback).trim() || fallback
  return endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`
}

const numberOrDefault = (value: unknown, fallback: number): number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

const positiveIntegerOrDefault = (value: unknown, fallback: number): number => {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback
}

const createStorageId = (prefix: string): string => {
  const globalCrypto = globalThis.crypto

  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    return globalCrypto.randomUUID()
  }

  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

const isoStringOrDefault = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') {
    return fallback
  }

  const timestamp = Date.parse(value)

  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback
}

const timestampToIsoString = (timestamp: unknown, fallback = new Date().toISOString()): string => {
  return typeof timestamp === 'number' && Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback
}

const padDatePart = (value: number): string => {
  return value.toString().padStart(2, '0')
}

const formatFileDate = (timestamp: number): string => {
  const date = new Date(Number.isFinite(timestamp) ? timestamp : Date.now())
  const year = date.getFullYear()
  const month = padDatePart(date.getMonth() + 1)
  const day = padDatePart(date.getDate())
  const hours = padDatePart(date.getHours())
  const minutes = padDatePart(date.getMinutes())
  const seconds = padDatePart(date.getSeconds())

  return `${year}${month}${day}-${hours}${minutes}${seconds}`
}

export const sanitizeFileNamePart = (value: unknown): string => {
  const sanitizedValue = String(value ?? '')
    .split('')
    .map((character) => (character.charCodeAt(0) < 32 ? '-' : character))
    .join('')
    .trim()
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[\s.-]+|[\s.-]+$/g, '')

  return sanitizedValue || 'untitled'
}

export const getImageFileExtension = (outputFormat?: string, mimeType?: string): 'jpeg' | 'png' | 'webp' => {
  const extensionFromMimeType = mimeType ? imageMimeTypeToExtension.get(mimeType.toLowerCase()) : undefined

  if (extensionFromMimeType === 'jpeg' || extensionFromMimeType === 'png' || extensionFromMimeType === 'webp') {
    return extensionFromMimeType
  }

  if (outputFormat === 'jpeg' || outputFormat === 'png' || outputFormat === 'webp') {
    return outputFormat
  }

  return 'png'
}

export const createImageFileName = ({
  createdAt,
  taskId,
  model,
  size,
  outputFormat,
  mimeType
}: {
  createdAt: number
  taskId: string
  model: string
  size: string
  outputFormat?: string
  mimeType?: string
}): string => {
  const timestamp = formatFileDate(createdAt)
  const shortTaskId = sanitizeFileNamePart(taskId).replace(/-/g, '').slice(0, 8) || 'task'
  const safeSize = sanitizeFileNamePart(size)
  const safeModel = sanitizeFileNamePart(model)
  const extension = getImageFileExtension(outputFormat, mimeType)

  return `image-tool-${timestamp}-${shortTaskId}-${safeSize}-${safeModel}.${extension}`
}

export const ensureUniqueFilePath = (
  dir: string,
  fileName: string,
  pathExists: (filePath: string) => boolean = existsSync
): string => {
  const parsedFileName = parse(fileName)
  let candidatePath = join(dir, fileName)
  let suffix = 2

  while (pathExists(candidatePath)) {
    candidatePath = join(dir, `${parsedFileName.name}-${suffix}${parsedFileName.ext}`)
    suffix += 1
  }

  return candidatePath
}

export const createDefaultImageToolSettings = (): ImageToolSettings => ({
  appearanceTheme: 'dark',
  providerTemplateId: compatibleImageProviderTemplate.id,
  baseUrl: compatibleImageProviderTemplate.defaultBaseUrl,
  endpointPath: compatibleImageProviderTemplate.endpointPath,
  editEndpointPath: compatibleImageProviderTemplate.editEndpointPath,
  model: compatibleImageProviderTemplate.model,
  quality: 'auto',
  outputFormat: 'png',
  sendOutputFormat: compatibleImageProviderTemplate.sendOutputFormat,
  sendResponseFormat: compatibleImageProviderTemplate.sendResponseFormat,
  responseFormat: 'b64_json',
  sizeMode: 'fixed',
  sizePreset: '3840x2160',
  saveApiKey: false,
  providerCredentials: {},
  customProviderTemplates: []
})

export const getImageProviderTemplates = (
  customProviderTemplates: readonly ImageProviderTemplate[] = []
): ImageProviderTemplate[] => {
  return [...builtInImageProviderTemplates, ...customProviderTemplates]
}

export const getImageProviderTemplate = (
  templateId: string,
  customProviderTemplates: readonly ImageProviderTemplate[] = []
): ImageProviderTemplate => {
  return (
    getImageProviderTemplates(customProviderTemplates).find((template) => template.id === templateId) ??
    compatibleImageProviderTemplate
  )
}

export const createDefaultProjectGroup = (now = new Date().toISOString()): ProjectGroup => ({
  id: DEFAULT_PROJECT_ID,
  name: DEFAULT_PROJECT_NAME,
  createdAt: now,
  updatedAt: now,
  sortOrder: 0,
  isDefault: true
})

export const createDefaultConversation = (now = new Date().toISOString()): Conversation => ({
  id: DEFAULT_CONVERSATION_ID,
  projectId: DEFAULT_PROJECT_ID,
  title: DEFAULT_CONVERSATION_TITLE,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  messageCount: 0,
  imageCount: 0
})

export const createDefaultPromptTemplateCategory = (now = new Date().toISOString()): PromptTemplateCategory => ({
  id: DEFAULT_PROMPT_TEMPLATE_CATEGORY_ID,
  name: DEFAULT_PROMPT_TEMPLATE_CATEGORY_NAME,
  parentId: null,
  sortOrder: 0,
  createdAt: now,
  updatedAt: now
})

export const createDefaultImageToolData = (): ImageToolData => ({
  version: 1,
  settings: createDefaultImageToolSettings(),
  projects: [],
  conversations: [],
  trashRetentionDays: 30,
  history: [],
  promptTemplateCategories: [createDefaultPromptTemplateCategory()],
  promptTemplates: []
})

const sanitizeProviderTemplateId = (value: unknown, existingIds: Set<string>, fallback = 'template'): string => {
  const rawId = stringOrDefault(value, '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

  const id = rawId || fallback

  if (protectedProviderTemplateIds.has(id) || existingIds.has(id)) {
    return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  return id.startsWith('custom-') ? id : `custom-${id}`
}

const retiredProviderTemplateDefaults: Record<string, ImageProviderTemplate> = {
  hubaobao: {
    id: 'hubaobao',
    name: MIGRATED_PROVIDER_TEMPLATE_NAME,
    defaultBaseUrl: 'https://api.openai.com',
    endpointPath: DEFAULT_GENERATION_ENDPOINT_PATH,
    editEndpointPath: DEFAULT_EDIT_ENDPOINT_PATH,
    model: DEFAULT_IMAGE_MODEL,
    sendResponseFormat: false,
    sendOutputFormat: true
  },
  custom: {
    id: 'custom',
    name: MIGRATED_PROVIDER_TEMPLATE_NAME,
    defaultBaseUrl: '',
    endpointPath: DEFAULT_GENERATION_ENDPOINT_PATH,
    editEndpointPath: DEFAULT_EDIT_ENDPOINT_PATH,
    model: DEFAULT_IMAGE_MODEL,
    sendResponseFormat: false,
    sendOutputFormat: false
  },
  'jiekou-highway': {
    id: 'jiekou-highway',
    name: MIGRATED_PROVIDER_TEMPLATE_NAME,
    defaultBaseUrl: 'https://api.openai.com',
    endpointPath: '/images/generations',
    editEndpointPath: DEFAULT_EDIT_ENDPOINT_PATH,
    model: DEFAULT_IMAGE_MODEL,
    sendResponseFormat: false,
    sendOutputFormat: false
  },
  'jiekou-original': {
    id: 'jiekou-original',
    name: MIGRATED_PROVIDER_TEMPLATE_NAME,
    defaultBaseUrl: '',
    endpointPath: DEFAULT_GENERATION_ENDPOINT_PATH,
    editEndpointPath: DEFAULT_EDIT_ENDPOINT_PATH,
    model: DEFAULT_IMAGE_MODEL,
    sendResponseFormat: false,
    sendOutputFormat: false
  }
}

const getRetiredProviderTemplateDefault = (templateId: string): ImageProviderTemplate => {
  return retiredProviderTemplateDefaults[templateId] ?? retiredProviderTemplateDefaults.custom
}

const normalizeCompatibleProviderTemplateId = (templateId: string): string => {
  return legacyCompatibleProviderTemplateIds.has(templateId) ? COMPATIBLE_PROVIDER_TEMPLATE_ID : templateId
}

const isRetiredProviderTemplateId = (templateId: string): boolean => {
  return retiredProviderTemplateIds.has(templateId)
}

const isProviderTemplateFieldModified = (template: unknown, defaults: ImageProviderTemplate): boolean => {
  if (!isRecord(template)) {
    return false
  }

  const baseUrl = stringOrDefault(template.defaultBaseUrl ?? template.baseUrl, defaults.defaultBaseUrl).trim()
  const endpointPath = endpointPathOrDefault(template.endpointPath, defaults.endpointPath)
  const editEndpointPath = endpointPathOrDefault(template.editEndpointPath, defaults.editEndpointPath)
  const model = stringOrDefault(template.model, defaults.model).trim() || defaults.model
  const sendOutputFormat =
    typeof template.sendOutputFormat === 'boolean' ? template.sendOutputFormat : defaults.sendOutputFormat
  const sendResponseFormat =
    typeof template.sendResponseFormat === 'boolean' ? template.sendResponseFormat : defaults.sendResponseFormat
  const outputFormat = stringOrDefault(template.outputFormat, defaults.outputFormat ?? '')
  const responseFormat = stringOrDefault(template.responseFormat, defaults.responseFormat ?? '')

  return (
    baseUrl !== defaults.defaultBaseUrl ||
    endpointPath !== defaults.endpointPath ||
    editEndpointPath !== defaults.editEndpointPath ||
    model !== defaults.model ||
    sendOutputFormat !== defaults.sendOutputFormat ||
    sendResponseFormat !== defaults.sendResponseFormat ||
    outputFormat !== (defaults.outputFormat ?? '') ||
    responseFormat !== (defaults.responseFormat ?? '')
  )
}

const createUniqueMigratedProviderTemplateId = (templateId: string, existingIds: Set<string>): string => {
  const baseId = sanitizeProviderTemplateId(templateId === 'custom' ? 'legacy-custom' : templateId, new Set())
  let candidateId = baseId
  let suffix = 2

  while (existingIds.has(candidateId) || protectedProviderTemplateIds.has(candidateId)) {
    candidateId = `${baseId}-${suffix}`
    suffix += 1
  }

  existingIds.add(candidateId)
  return candidateId
}

const sanitizeCustomProviderTemplate = (
  template: unknown,
  existingIds: Set<string>
): ImageProviderTemplate | undefined => {
  if (!isRecord(template)) {
    return undefined
  }

  const name = stringOrDefault(template.name, '').trim()
  const defaultBaseUrl = stringOrDefault(template.defaultBaseUrl, '').trim()
  const endpointPath = stringOrDefault(template.endpointPath, '').trim()
  const editEndpointPath = stringOrDefault(template.editEndpointPath, '/v1/images/edits').trim()
  const model = stringOrDefault(template.model, DEFAULT_IMAGE_MODEL).trim() || DEFAULT_IMAGE_MODEL

  if (!name || !endpointPath || !editEndpointPath || !model) {
    return undefined
  }

  const outputFormat = stringOrDefault(template.outputFormat, '')
  const responseFormat = stringOrDefault(template.responseFormat, '')
  const rawId = stringOrDefault(template.id, '')
  const id = sanitizeProviderTemplateId(rawId, existingIds)
  existingIds.add(id)

  return {
    id,
    name: isRetiredProviderTemplateId(rawId) ? MIGRATED_PROVIDER_TEMPLATE_NAME : name,
    ...(typeof template.description === 'string' ? { description: template.description } : {}),
    defaultBaseUrl,
    endpointPath: endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`,
    editEndpointPath: editEndpointPath.startsWith('/') ? editEndpointPath : `/${editEndpointPath}`,
    model,
    sendResponseFormat: typeof template.sendResponseFormat === 'boolean' ? template.sendResponseFormat : false,
    ...(responseFormatValues.has(responseFormat as NonNullable<ImageToolSettings['responseFormat']>)
      ? { responseFormat: responseFormat as NonNullable<ImageToolSettings['responseFormat']> }
      : {}),
    sendOutputFormat: typeof template.sendOutputFormat === 'boolean' ? template.sendOutputFormat : false,
    ...(outputFormatValues.has(outputFormat as ImageToolSettings['outputFormat'])
      ? { outputFormat: outputFormat as ImageToolSettings['outputFormat'] }
      : {})
  }
}

type SanitizedCustomProviderTemplates = {
  templates: ImageProviderTemplate[]
  retiredTemplateIds: Map<string, string>
}

const sanitizeCustomProviderTemplates = (
  templates: unknown,
  providerCredentials: ImageProviderCredentials = {}
): SanitizedCustomProviderTemplates => {
  if (!Array.isArray(templates)) {
    return { templates: [], retiredTemplateIds: new Map() }
  }

  const existingIds = new Set<string>()
  const retiredTemplateIds = new Map<string, string>()
  const sanitizedTemplates = templates.flatMap((template) => {
    const rawId = isRecord(template) ? stringOrDefault(template.id, '').trim() : ''

    if (isRetiredProviderTemplateId(rawId)) {
      const hasCredential = Boolean(providerCredentials[rawId]?.apiKey)
      const hasUserChanges = isProviderTemplateFieldModified(template, getRetiredProviderTemplateDefault(rawId))

      if (!hasCredential && !hasUserChanges) {
        return []
      }
    }

    const sanitizedTemplate = sanitizeCustomProviderTemplate(template, existingIds)
    if (sanitizedTemplate && isRetiredProviderTemplateId(rawId) && !retiredTemplateIds.has(rawId)) {
      retiredTemplateIds.set(rawId, sanitizedTemplate.id)
    }

    return sanitizedTemplate ? [sanitizedTemplate] : []
  })

  return { templates: sanitizedTemplates, retiredTemplateIds }
}

const sanitizeCredentialTemplateId = (value: unknown): string | undefined => {
  const id = stringOrDefault(value, '').trim()

  return /^[a-zA-Z0-9_-]+$/.test(id) ? id : undefined
}

const sanitizeProviderCredentials = (credentials: unknown): ImageProviderCredentials => {
  if (!isRecord(credentials)) {
    return {}
  }

  return Object.entries(credentials).reduce<ImageProviderCredentials>((sanitizedCredentials, [templateId, value]) => {
    const sanitizedTemplateId = sanitizeCredentialTemplateId(templateId)

    if (!sanitizedTemplateId || !isRecord(value)) {
      return sanitizedCredentials
    }

    const apiKey = stringOrDefault(value.apiKey, '').trim()

    if (!apiKey) {
      return sanitizedCredentials
    }

    return {
      ...sanitizedCredentials,
      [sanitizedTemplateId]: { apiKey }
    }
  }, {})
}

const upsertProviderTemplate = (
  templates: ImageProviderTemplate[],
  template: ImageProviderTemplate
): ImageProviderTemplate[] => {
  return [template, ...templates.filter((item) => item.id !== template.id)]
}

const moveProviderCredential = (
  credentials: ImageProviderCredentials,
  fromTemplateId: string,
  toTemplateId: string
): ImageProviderCredentials => {
  const credential = credentials[fromTemplateId]

  if (!credential?.apiKey || fromTemplateId === toTemplateId) {
    return credentials
  }

  const nextCredentials = { ...credentials }

  if (!nextCredentials[toTemplateId]?.apiKey) {
    nextCredentials[toTemplateId] = credential
  }

  delete nextCredentials[fromTemplateId]
  return nextCredentials
}

const createMigratedProviderTemplate = ({
  existingIds,
  id,
  settings,
  templateId
}: {
  existingIds: Set<string>
  id?: string
  settings: Record<string, unknown>
  templateId: string
}): ImageProviderTemplate => {
  const defaults = getRetiredProviderTemplateDefault(templateId)
  const outputFormat = stringOrDefault(settings.outputFormat, '')
  const responseFormat = stringOrDefault(settings.responseFormat, '')

  return {
    id: id ?? createUniqueMigratedProviderTemplateId(templateId, existingIds),
    name: MIGRATED_PROVIDER_TEMPLATE_NAME,
    defaultBaseUrl: stringOrDefault(settings.baseUrl, defaults.defaultBaseUrl).trim(),
    endpointPath: endpointPathOrDefault(settings.endpointPath, defaults.endpointPath),
    editEndpointPath: endpointPathOrDefault(settings.editEndpointPath, defaults.editEndpointPath),
    model: stringOrDefault(settings.model, defaults.model).trim() || defaults.model,
    sendResponseFormat:
      typeof settings.sendResponseFormat === 'boolean' ? settings.sendResponseFormat : defaults.sendResponseFormat,
    ...(responseFormatValues.has(responseFormat as NonNullable<ImageToolSettings['responseFormat']>)
      ? { responseFormat: responseFormat as NonNullable<ImageToolSettings['responseFormat']> }
      : {}),
    sendOutputFormat:
      typeof settings.sendOutputFormat === 'boolean' ? settings.sendOutputFormat : defaults.sendOutputFormat,
    ...(outputFormatValues.has(outputFormat as ImageToolSettings['outputFormat'])
      ? { outputFormat: outputFormat as ImageToolSettings['outputFormat'] }
      : {})
  }
}

const sanitizeSettings = (settings: unknown): ImageToolSettings => {
  const defaults = createDefaultImageToolSettings()

  if (!isRecord(settings)) {
    return defaults
  }

  const quality = stringOrDefault(settings.quality, defaults.quality)
  const outputFormat = stringOrDefault(settings.outputFormat, defaults.outputFormat)
  const responseFormat = stringOrDefault(settings.responseFormat, defaults.responseFormat ?? 'b64_json')
  const sizeMode = stringOrDefault(settings.sizeMode, defaults.sizeMode)
  const appearanceTheme = stringOrDefault(settings.appearanceTheme, defaults.appearanceTheme)
  const rawProviderTemplateId = stringOrDefault(settings.providerTemplateId, defaults.providerTemplateId).trim()
  let providerTemplateId = normalizeCompatibleProviderTemplateId(rawProviderTemplateId || defaults.providerTemplateId)
  let providerCredentials = sanitizeProviderCredentials(settings.providerCredentials)
  const legacyApiKey = stringOrDefault(settings.apiKey, '').trim()
  const sanitizedCustomProviderTemplates = sanitizeCustomProviderTemplates(
    settings.customProviderTemplates,
    providerCredentials
  )
  const customProviderTemplates = sanitizedCustomProviderTemplates.templates
  const existingCustomTemplateIds = new Set(customProviderTemplates.map((template) => template.id))
  const customProviderTemplateIds = new Set(existingCustomTemplateIds)
  let migratedCustomProviderTemplates = customProviderTemplates
  let baseUrl = stringOrDefault(settings.baseUrl, defaults.baseUrl)
  let endpointPath = endpointPathOrDefault(settings.endpointPath, defaults.endpointPath)
  let editEndpointPath = endpointPathOrDefault(settings.editEndpointPath, defaults.editEndpointPath)
  let model = stringOrDefault(settings.model, defaults.model)
  let sendOutputFormat =
    typeof settings.sendOutputFormat === 'boolean' ? settings.sendOutputFormat : defaults.sendOutputFormat
  let sendResponseFormat =
    typeof settings.sendResponseFormat === 'boolean' ? settings.sendResponseFormat : defaults.sendResponseFormat

  providerCredentials = moveProviderCredential(providerCredentials, 'openai-standard', COMPATIBLE_PROVIDER_TEMPLATE_ID)

  if (isRetiredProviderTemplateId(rawProviderTemplateId)) {
    const retiredDefaults = getRetiredProviderTemplateDefault(rawProviderTemplateId)
    const shouldKeepRetiredTemplate =
      Boolean(providerCredentials[rawProviderTemplateId]?.apiKey || legacyApiKey) ||
      isProviderTemplateFieldModified(settings, retiredDefaults)

    if (shouldKeepRetiredTemplate) {
      const existingMigratedTemplateId = sanitizedCustomProviderTemplates.retiredTemplateIds.get(rawProviderTemplateId)
      const migratedTemplate = createMigratedProviderTemplate({
        existingIds: existingCustomTemplateIds,
        id: existingMigratedTemplateId,
        settings,
        templateId: rawProviderTemplateId
      })

      migratedCustomProviderTemplates = upsertProviderTemplate(migratedCustomProviderTemplates, migratedTemplate)
      customProviderTemplateIds.add(migratedTemplate.id)
      providerCredentials = moveProviderCredential(providerCredentials, rawProviderTemplateId, migratedTemplate.id)
      providerTemplateId = migratedTemplate.id
      baseUrl = migratedTemplate.defaultBaseUrl
      endpointPath = migratedTemplate.endpointPath
      editEndpointPath = migratedTemplate.editEndpointPath
      model = migratedTemplate.model
      sendOutputFormat = migratedTemplate.sendOutputFormat
      sendResponseFormat = migratedTemplate.sendResponseFormat
    } else {
      providerTemplateId = COMPATIBLE_PROVIDER_TEMPLATE_ID
      baseUrl = defaults.baseUrl
      endpointPath = defaults.endpointPath
      editEndpointPath = defaults.editEndpointPath
      model = defaults.model
      sendOutputFormat = defaults.sendOutputFormat
      sendResponseFormat = defaults.sendResponseFormat
    }
  }

  for (const retiredTemplateId of retiredProviderTemplateIds) {
    if (!providerCredentials[retiredTemplateId]?.apiKey) {
      continue
    }

    const existingMigratedTemplateId = sanitizedCustomProviderTemplates.retiredTemplateIds.get(retiredTemplateId)
    const migratedTemplate = existingMigratedTemplateId
      ? migratedCustomProviderTemplates.find((template) => template.id === existingMigratedTemplateId)
      : {
          ...getRetiredProviderTemplateDefault(retiredTemplateId),
          id: createUniqueMigratedProviderTemplateId(retiredTemplateId, existingCustomTemplateIds)
        }

    if (!migratedTemplate) {
      continue
    }

    migratedCustomProviderTemplates = upsertProviderTemplate(migratedCustomProviderTemplates, migratedTemplate)
    customProviderTemplateIds.add(migratedTemplate.id)
    providerCredentials = moveProviderCredential(providerCredentials, retiredTemplateId, migratedTemplate.id)
  }

  if (legacyApiKey && !providerCredentials[providerTemplateId]?.apiKey) {
    providerCredentials[providerTemplateId] = { apiKey: legacyApiKey }
  }

  if (
    providerTemplateId !== COMPATIBLE_PROVIDER_TEMPLATE_ID &&
    !customProviderTemplateIds.has(providerTemplateId) &&
    !protectedProviderTemplateIds.has(providerTemplateId)
  ) {
    providerTemplateId = COMPATIBLE_PROVIDER_TEMPLATE_ID
    baseUrl = defaults.baseUrl
    endpointPath = defaults.endpointPath
    editEndpointPath = defaults.editEndpointPath
    model = defaults.model
    sendOutputFormat = defaults.sendOutputFormat
    sendResponseFormat = defaults.sendResponseFormat
  }

  return {
    appearanceTheme: appearanceThemeValues.has(appearanceTheme as ImageToolAppearanceTheme)
      ? (appearanceTheme as ImageToolAppearanceTheme)
      : defaults.appearanceTheme,
    providerTemplateId,
    baseUrl,
    endpointPath,
    editEndpointPath,
    model,
    quality: qualityValues.has(quality as ImageToolSettings['quality'])
      ? (quality as ImageToolSettings['quality'])
      : defaults.quality,
    outputFormat: outputFormatValues.has(outputFormat as ImageToolSettings['outputFormat'])
      ? (outputFormat as ImageToolSettings['outputFormat'])
      : defaults.outputFormat,
    sendOutputFormat,
    sendResponseFormat,
    responseFormat: responseFormatValues.has(responseFormat as NonNullable<ImageToolSettings['responseFormat']>)
      ? (responseFormat as NonNullable<ImageToolSettings['responseFormat']>)
      : defaults.responseFormat,
    sizeMode: sizeModeValues.has(sizeMode as ImageToolSettings['sizeMode'])
      ? (sizeMode as ImageToolSettings['sizeMode'])
      : defaults.sizeMode,
    sizePreset: stringOrDefault(settings.sizePreset, defaults.sizePreset),
    saveApiKey: typeof settings.saveApiKey === 'boolean' ? settings.saveApiKey : defaults.saveApiKey,
    providerCredentials,
    customProviderTemplates: migratedCustomProviderTemplates
  }
}

const sanitizeEntityId = (value: unknown): string | undefined => {
  const id = stringOrDefault(value, '').trim()

  return /^[a-zA-Z0-9_-]+$/.test(id) ? id : undefined
}

const normalizeTitle = (value: unknown, fallback: string): string => {
  return stringOrDefault(value, fallback).trim().replace(/\s+/g, ' ') || fallback
}

const createConversationTitleFromPrompt = (prompt: string): string => {
  const title = prompt.trim().replace(/\s+/g, ' ').slice(0, 30)
  return title || NEW_CONVERSATION_TITLE
}

const sanitizeProjectGroup = (project: unknown, now: string): ProjectGroup | undefined => {
  if (!isRecord(project)) {
    return undefined
  }

  const id = sanitizeEntityId(project.id)
  const name = normalizeTitle(project.name, '')

  if (!id || !name) {
    return undefined
  }

  return {
    id,
    name,
    createdAt: isoStringOrDefault(project.createdAt, now),
    updatedAt: isoStringOrDefault(project.updatedAt, now),
    sortOrder: numberOrDefault(project.sortOrder, 0)
  }
}

const sanitizeProjectGroups = (projects: unknown, now: string): ProjectGroup[] => {
  const projectMap = new Map<string, ProjectGroup>()

  if (Array.isArray(projects)) {
    for (const project of projects) {
      const sanitizedProject = sanitizeProjectGroup(project, now)

      if (sanitizedProject) {
        projectMap.set(sanitizedProject.id, sanitizedProject)
      }
    }
  }

  return Array.from(projectMap.values()).sort((firstProject, secondProject) => {
    return (
      firstProject.sortOrder - secondProject.sortOrder || firstProject.createdAt.localeCompare(secondProject.createdAt)
    )
  })
}

const sanitizeConversation = (
  conversation: unknown,
  now: string,
  projectIds: ReadonlySet<string>
): Conversation | undefined => {
  if (!isRecord(conversation)) {
    return undefined
  }

  const id = sanitizeEntityId(conversation.id)
  const title = normalizeTitle(conversation.title, '')

  if (!id || !title) {
    return undefined
  }

  const rawProjectId = conversation.projectId === null ? null : sanitizeEntityId(conversation.projectId)
  const projectId = rawProjectId === null || (rawProjectId && projectIds.has(rawProjectId)) ? rawProjectId : null
  const deletedAt =
    conversation.deletedAt === null || conversation.deletedAt === undefined
      ? null
      : isoStringOrDefault(conversation.deletedAt, now)

  return {
    id,
    projectId,
    title,
    createdAt: isoStringOrDefault(conversation.createdAt, now),
    updatedAt: isoStringOrDefault(conversation.updatedAt, now),
    deletedAt,
    ...(typeof conversation.lastMessageAt === 'string'
      ? { lastMessageAt: isoStringOrDefault(conversation.lastMessageAt, now) }
      : {}),
    ...(typeof conversation.messageCount === 'number'
      ? { messageCount: Math.max(0, Math.floor(conversation.messageCount)) }
      : {}),
    ...(typeof conversation.imageCount === 'number'
      ? { imageCount: Math.max(0, Math.floor(conversation.imageCount)) }
      : {})
  }
}

const sanitizeConversations = (
  conversations: unknown,
  now: string,
  projectIds: ReadonlySet<string>
): Conversation[] => {
  const conversationMap = new Map<string, Conversation>()

  if (Array.isArray(conversations)) {
    for (const conversation of conversations) {
      const sanitizedConversation = sanitizeConversation(conversation, now, projectIds)

      if (sanitizedConversation) {
        conversationMap.set(sanitizedConversation.id, sanitizedConversation)
      }
    }
  }

  return Array.from(conversationMap.values())
}

const selectActiveConversationId = (
  conversations: readonly Conversation[],
  activeConversationId?: string
): string | undefined => {
  if (
    activeConversationId &&
    conversations.some((conversation) => conversation.id === activeConversationId && !conversation.deletedAt)
  ) {
    return activeConversationId
  }

  return conversations
    .filter((conversation) => !conversation.deletedAt)
    .sort((firstConversation, secondConversation) => {
      return Date.parse(secondConversation.updatedAt) - Date.parse(firstConversation.updatedAt)
    })[0]?.id
}

const sanitizeHistoryItem = (item: unknown, fallbackConversationId: string): ImageHistoryItem | undefined => {
  if (!isRecord(item)) {
    return undefined
  }

  const id = stringOrDefault(item.id, '')
  const taskId = stringOrDefault(item.taskId, '')
  const prompt = stringOrDefault(item.prompt, '')
  const model = stringOrDefault(item.model, '')
  const size = stringOrDefault(item.size, '')

  if (!id || !taskId || !prompt || !model || !size) {
    return undefined
  }

  const error = isRecord(item.error)
    ? {
        ...(typeof item.error.code === 'string' ? { code: item.error.code } : {}),
        message: stringOrDefault(item.error.message, 'Image generation failed.'),
        ...(typeof item.error.status === 'number' ? { status: item.error.status } : {})
      }
    : undefined

  return {
    id,
    conversationId: sanitizeEntityId(item.conversationId) ?? fallbackConversationId,
    taskId,
    ...(item.mode === 'image_edit' || item.mode === 'image_reference' || item.mode === 'image_generation'
      ? { mode: item.mode }
      : {}),
    prompt,
    model,
    size,
    ...(typeof item.quality === 'string' ? { quality: item.quality } : {}),
    ...(typeof item.outputFormat === 'string' ? { outputFormat: item.outputFormat } : {}),
    ...(typeof item.imagePath === 'string' ? { imagePath: item.imagePath } : {}),
    ...(typeof item.imageMimeType === 'string' ? { imageMimeType: item.imageMimeType } : {}),
    ...(typeof item.imageFileName === 'string' ? { imageFileName: item.imageFileName } : {}),
    ...(Array.isArray(item.referenceImages)
      ? {
          referenceImages: item.referenceImages.flatMap((referenceImage) => {
            if (!isRecord(referenceImage)) {
              return []
            }

            const name = stringOrDefault(referenceImage.name, '').trim()
            const mimeType = stringOrDefault(referenceImage.mimeType, '').trim()
            const size = numberOrDefault(referenceImage.size, 0)

            return name && mimeType && size > 0
              ? [
                  {
                    name,
                    mimeType,
                    size
                  }
                ]
              : []
          })
        }
      : {}),
    createdAt: numberOrDefault(item.createdAt, Date.now()),
    updatedAt: numberOrDefault(item.updatedAt, Date.now()),
    ...(error ? { error } : {})
  }
}

const normalizeOptionalText = (value: unknown): string | undefined => {
  const text = stringOrDefault(value, '').trim().replace(/\s+/g, ' ')
  return text || undefined
}

const sanitizeStringList = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined
  }

  const values = Array.from(
    new Set(
      value
        .map((item) => normalizeOptionalText(item))
        .filter((item): item is string => Boolean(item))
        .slice(0, 50)
    )
  )

  return values.length > 0 ? values : undefined
}

const sanitizePromptTemplateVariableKey = (value: unknown): string | undefined => {
  const key = stringOrDefault(value, '').trim().replace(/[{}]/g, '').replace(/\s+/g, '_').slice(0, 80)

  return key || undefined
}

const sanitizePromptTemplateVariables = (variables: unknown): PromptTemplateVariable[] | undefined => {
  if (!Array.isArray(variables)) {
    return undefined
  }

  const seenKeys = new Set<string>()
  const sanitizedVariables = variables.flatMap((variable) => {
    if (!isRecord(variable)) {
      return []
    }

    const key = sanitizePromptTemplateVariableKey(variable.key)

    if (!key || seenKeys.has(key)) {
      return []
    }

    const label = normalizeOptionalText(variable.label) ?? key

    seenKeys.add(key)

    return [
      {
        key,
        label,
        ...(normalizeOptionalText(variable.placeholder)
          ? { placeholder: normalizeOptionalText(variable.placeholder) }
          : {}),
        ...(typeof variable.required === 'boolean' ? { required: variable.required } : {}),
        ...(typeof variable.defaultValue === 'string' ? { defaultValue: variable.defaultValue } : {})
      }
    ]
  })

  return sanitizedVariables.length > 0 ? sanitizedVariables : undefined
}

const sanitizePromptTemplateRecommendedParams = (params: unknown): PromptTemplateRecommendedParams | undefined => {
  if (!isRecord(params)) {
    return undefined
  }

  const size = normalizeOptionalText(params.size)
  const quality = stringOrDefault(params.quality, '')
  const outputFormat = stringOrDefault(params.outputFormat, '')
  const recommendedParams: PromptTemplateRecommendedParams = {
    ...(size ? { size } : {}),
    ...(qualityValues.has(quality as ImageToolSettings['quality'])
      ? { quality: quality as ImageToolSettings['quality'] }
      : {}),
    ...(outputFormatValues.has(outputFormat as ImageToolSettings['outputFormat'])
      ? { outputFormat: outputFormat as ImageToolSettings['outputFormat'] }
      : {})
  }

  return Object.keys(recommendedParams).length > 0 ? recommendedParams : undefined
}

const sanitizePromptPreviewAssetId = (value: unknown): string | undefined => {
  const assetId = stringOrDefault(value, '').trim()

  return /^[a-zA-Z0-9_.-]+$/.test(assetId) && !assetId.includes('..') ? assetId : undefined
}

const sanitizePromptTemplateCategory = (category: unknown, now: string): PromptTemplateCategory | undefined => {
  if (!isRecord(category)) {
    return undefined
  }

  const id = sanitizeEntityId(category.id)
  const name = normalizeTitle(category.name, '')

  if (!id || !name) {
    return undefined
  }

  return {
    id,
    name,
    parentId: category.parentId === null ? null : (sanitizeEntityId(category.parentId) ?? null),
    sortOrder: numberOrDefault(category.sortOrder, 0),
    createdAt: isoStringOrDefault(category.createdAt, now),
    updatedAt: isoStringOrDefault(category.updatedAt, now)
  }
}

const sanitizePromptTemplateCategories = (categories: unknown, now: string): PromptTemplateCategory[] => {
  const categoryMap = new Map<string, PromptTemplateCategory>()

  if (Array.isArray(categories)) {
    for (const category of categories) {
      const sanitizedCategory = sanitizePromptTemplateCategory(category, now)

      if (sanitizedCategory) {
        categoryMap.set(sanitizedCategory.id, sanitizedCategory)
      }
    }
  }

  categoryMap.set(DEFAULT_PROMPT_TEMPLATE_CATEGORY_ID, {
    ...createDefaultPromptTemplateCategory(now),
    ...categoryMap.get(DEFAULT_PROMPT_TEMPLATE_CATEGORY_ID),
    id: DEFAULT_PROMPT_TEMPLATE_CATEGORY_ID,
    parentId: null,
    sortOrder: categoryMap.get(DEFAULT_PROMPT_TEMPLATE_CATEGORY_ID)?.sortOrder ?? 0
  })

  return Array.from(categoryMap.values())
    .map((category) => ({
      ...category,
      parentId:
        category.parentId && category.parentId !== category.id && categoryMap.has(category.parentId)
          ? category.parentId
          : null
    }))
    .sort((firstCategory, secondCategory) => {
      if (firstCategory.id === DEFAULT_PROMPT_TEMPLATE_CATEGORY_ID) {
        return -1
      }

      if (secondCategory.id === DEFAULT_PROMPT_TEMPLATE_CATEGORY_ID) {
        return 1
      }

      return (
        firstCategory.sortOrder - secondCategory.sortOrder ||
        firstCategory.createdAt.localeCompare(secondCategory.createdAt)
      )
    })
}

const sanitizePromptTemplate = (
  template: unknown,
  now: string,
  categoryIds: ReadonlySet<string>
): PromptTemplate | undefined => {
  if (!isRecord(template)) {
    return undefined
  }

  const id = sanitizeEntityId(template.id)
  const title = normalizeTitle(template.title, '')
  const prompt = typeof template.prompt === 'string' ? template.prompt.trim() : ''
  const templateType = stringOrDefault(template.templateType, 'text_to_image')

  if (!id || !title || !prompt || !promptTemplateTypeValues.has(templateType as PromptTemplateType)) {
    return undefined
  }

  const rawCategoryId = template.categoryId === null ? null : sanitizeEntityId(template.categoryId)
  const categoryId =
    rawCategoryId === null || (rawCategoryId && categoryIds.has(rawCategoryId))
      ? rawCategoryId
      : DEFAULT_PROMPT_TEMPLATE_CATEGORY_ID
  const source = template.source === 'imported' ? 'imported' : 'user'

  return {
    id,
    categoryId,
    title,
    ...(typeof template.description === 'string' && template.description.trim()
      ? { description: template.description.trim() }
      : {}),
    templateType: templateType as PromptTemplateType,
    prompt,
    ...(sanitizePromptTemplateVariables(template.variables)
      ? { variables: sanitizePromptTemplateVariables(template.variables) }
      : {}),
    ...(sanitizeStringList(template.tags) ? { tags: sanitizeStringList(template.tags) } : {}),
    ...(sanitizePromptPreviewAssetId(template.previewAssetId)
      ? { previewAssetId: sanitizePromptPreviewAssetId(template.previewAssetId) }
      : {}),
    ...(sanitizePromptTemplateRecommendedParams(template.recommendedParams)
      ? { recommendedParams: sanitizePromptTemplateRecommendedParams(template.recommendedParams) }
      : {}),
    ...(typeof template.isFavorite === 'boolean' ? { isFavorite: template.isFavorite } : {}),
    source,
    createdAt: isoStringOrDefault(template.createdAt, now),
    updatedAt: isoStringOrDefault(template.updatedAt, now)
  }
}

const sanitizePromptTemplates = (
  templates: unknown,
  now: string,
  categoryIds: ReadonlySet<string>
): PromptTemplate[] => {
  if (!Array.isArray(templates)) {
    return []
  }

  const templateMap = new Map<string, PromptTemplate>()

  for (const template of templates) {
    const sanitizedTemplate = sanitizePromptTemplate(template, now, categoryIds)

    if (sanitizedTemplate) {
      templateMap.set(sanitizedTemplate.id, sanitizedTemplate)
    }
  }

  return Array.from(templateMap.values()).sort((firstTemplate, secondTemplate) => {
    return Date.parse(secondTemplate.updatedAt) - Date.parse(firstTemplate.updatedAt)
  })
}

const sanitizePromptTemplateImportRecord = (template: unknown): PromptTemplateImportRecord | undefined => {
  if (!isRecord(template)) {
    return undefined
  }

  const title = normalizeTitle(template.title, '')
  const prompt = typeof template.prompt === 'string' ? template.prompt.trim() : ''
  const templateType = stringOrDefault(template.templateType, 'text_to_image')

  if (!title || !prompt || !promptTemplateTypeValues.has(templateType as PromptTemplateType)) {
    return undefined
  }

  const categoryPath = Array.isArray(template.categoryPath)
    ? sanitizeStringList(template.categoryPath)?.slice(0, 12)
    : undefined
  const previewImage = isRecord(template.previewImage)
    ? {
        mimeType: stringOrDefault(template.previewImage.mimeType, '').trim(),
        dataUrl: stringOrDefault(template.previewImage.dataUrl, '').trim()
      }
    : undefined
  const sanitizedPreviewImage =
    previewImage?.mimeType.startsWith('image/') && previewImage.dataUrl.startsWith('data:image/')
      ? previewImage
      : undefined

  return {
    ...(typeof template.id === 'string' ? { id: template.id } : {}),
    title,
    ...(typeof template.description === 'string' && template.description.trim()
      ? { description: template.description.trim() }
      : {}),
    ...(categoryPath ? { categoryPath } : {}),
    templateType: templateType as PromptTemplateType,
    prompt,
    ...(sanitizePromptTemplateVariables(template.variables)
      ? { variables: sanitizePromptTemplateVariables(template.variables) }
      : {}),
    ...(sanitizeStringList(template.tags) ? { tags: sanitizeStringList(template.tags) } : {}),
    ...(sanitizePromptTemplateRecommendedParams(template.recommendedParams)
      ? { recommendedParams: sanitizePromptTemplateRecommendedParams(template.recommendedParams) }
      : {}),
    ...(typeof template.isFavorite === 'boolean' ? { isFavorite: template.isFavorite } : {}),
    ...(sanitizedPreviewImage ? { previewImage: sanitizedPreviewImage } : {}),
    ...(typeof template.createdAt === 'string' ? { createdAt: template.createdAt } : {}),
    ...(typeof template.updatedAt === 'string' ? { updatedAt: template.updatedAt } : {})
  }
}

const refreshConversationStats = (data: ImageToolData): ImageToolData => {
  const stats = data.history.reduce<
    Record<string, { imageCount: number; lastMessageAt?: string; messageCount: number }>
  >((currentStats, item) => {
    const conversationStats = currentStats[item.conversationId] ?? {
      imageCount: 0,
      messageCount: 0
    }
    const itemDate = timestampToIsoString(item.updatedAt ?? item.createdAt)

    return {
      ...currentStats,
      [item.conversationId]: {
        imageCount: conversationStats.imageCount + (item.imageFileName || item.imageDataUrl || item.imagePath ? 1 : 0),
        messageCount: conversationStats.messageCount + 2,
        lastMessageAt:
          !conversationStats.lastMessageAt || Date.parse(itemDate) > Date.parse(conversationStats.lastMessageAt)
            ? itemDate
            : conversationStats.lastMessageAt
      }
    }
  }, {})

  return {
    ...data,
    conversations: data.conversations.map((conversation) => {
      const conversationStats = stats[conversation.id]
      return {
        ...conversation,
        messageCount: conversationStats?.messageCount ?? 0,
        imageCount: conversationStats?.imageCount ?? 0,
        ...(conversationStats?.lastMessageAt ? { lastMessageAt: conversationStats.lastMessageAt } : {})
      }
    })
  }
}

export const sanitizeImageToolData = (data: unknown): ImageToolData => {
  if (!isRecord(data)) {
    return createDefaultImageToolData()
  }

  const now = new Date().toISOString()
  const projects = sanitizeProjectGroups(data.projects, now)
  const projectIds = new Set(projects.map((project) => project.id))
  let conversations = sanitizeConversations(data.conversations, now, projectIds)
  const promptTemplateCategories = sanitizePromptTemplateCategories(data.promptTemplateCategories, now)
  const promptTemplateCategoryIds = new Set(promptTemplateCategories.map((category) => category.id))
  const promptTemplates = sanitizePromptTemplates(data.promptTemplates, now, promptTemplateCategoryIds)
  const rawHistoryItems = Array.isArray(data.history) ? data.history : []

  if (
    conversations.length === 0 &&
    rawHistoryItems.some((item) => sanitizeHistoryItem(item, DEFAULT_CONVERSATION_ID))
  ) {
    conversations = [
      {
        ...createDefaultConversation(now),
        projectId: null
      }
    ]
  }

  const resolvedActiveConversationId = selectActiveConversationId(
    conversations,
    sanitizeEntityId(data.activeConversationId)
  )
  const fallbackConversationId = resolvedActiveConversationId ?? conversations[0]?.id
  const conversationIds = new Set(conversations.map((conversation) => conversation.id))
  const history = fallbackConversationId
    ? rawHistoryItems.flatMap((item) => {
        const sanitizedItem = sanitizeHistoryItem(item, fallbackConversationId)

        if (!sanitizedItem) {
          return []
        }

        return [
          {
            ...sanitizedItem,
            conversationId: conversationIds.has(sanitizedItem.conversationId)
              ? sanitizedItem.conversationId
              : fallbackConversationId
          }
        ]
      })
    : []

  return refreshConversationStats({
    version: 1,
    settings: sanitizeSettings(data.settings),
    projects,
    conversations,
    activeConversationId: resolvedActiveConversationId,
    trashRetentionDays: positiveIntegerOrDefault(data.trashRetentionDays, 30),
    history,
    promptTemplateCategories,
    promptTemplates
  })
}

export const getActiveConversationId = (data: ImageToolData): string | undefined => {
  const sanitizedData = sanitizeImageToolData(data)
  return (
    sanitizedData.activeConversationId ??
    sanitizedData.conversations.find((conversation) => !conversation.deletedAt)?.id
  )
}

export const addImageHistoryItem = (data: ImageToolData, item: ImageHistoryItem): ImageToolData => {
  const sanitizedData = sanitizeImageToolData(data)
  const conversationId = sanitizedData.conversations.some((conversation) => conversation.id === item.conversationId)
    ? item.conversationId
    : (getActiveConversationId(sanitizedData) ?? item.conversationId)
  const now = timestampToIsoString(item.updatedAt ?? item.createdAt)
  const nextHistoryItem = {
    ...item,
    conversationId
  }

  return refreshConversationStats({
    ...sanitizedData,
    conversations: sanitizedData.conversations.map((conversation) =>
      conversation.id === conversationId
        ? {
            ...conversation,
            title:
              conversation.title === NEW_CONVERSATION_TITLE
                ? createConversationTitleFromPrompt(item.prompt)
                : conversation.title,
            updatedAt: now,
            lastMessageAt: now
          }
        : conversation
    ),
    history: [nextHistoryItem, ...sanitizedData.history.filter((historyItem) => historyItem.id !== item.id)]
  })
}

export const updateImageHistoryItem = (
  data: ImageToolData,
  id: string,
  patch: Partial<ImageHistoryItem>
): ImageToolData =>
  refreshConversationStats({
    ...data,
    history: data.history.map((item) =>
      item.id === id
        ? {
            ...item,
            ...patch,
            id: item.id,
            conversationId: patch.conversationId ?? item.conversationId
          }
        : item
    )
  })

export const removeImageHistoryItem = (data: ImageToolData, id: string): ImageToolData => ({
  ...refreshConversationStats({
    ...data,
    history: data.history.filter((item) => item.id !== id)
  })
})

export const createProjectGroup = (data: ImageToolData, name: string): ImageToolData => {
  const sanitizedData = sanitizeImageToolData(data)
  const now = new Date().toISOString()
  const maxSortOrder = sanitizedData.projects.reduce((maxOrder, project) => Math.max(maxOrder, project.sortOrder), 0)
  const project: ProjectGroup = {
    id: createStorageId('project'),
    name: normalizeTitle(name, DEFAULT_PROJECT_NAME),
    createdAt: now,
    updatedAt: now,
    sortOrder: maxSortOrder + 1
  }

  return {
    ...sanitizedData,
    projects: [...sanitizedData.projects, project]
  }
}

export const renameProjectGroup = (data: ImageToolData, projectId: string, name: string): ImageToolData => {
  const sanitizedData = sanitizeImageToolData(data)
  const title = normalizeTitle(name, DEFAULT_PROJECT_NAME)
  const now = new Date().toISOString()

  return {
    ...sanitizedData,
    projects: sanitizedData.projects.map((project) =>
      project.id === projectId
        ? {
            ...project,
            name: title,
            updatedAt: now
          }
        : project
    )
  }
}

export const removeProjectGroup = (data: ImageToolData, projectId: string): ImageToolData => {
  const sanitizedData = sanitizeImageToolData(data)

  if (!sanitizedData.projects.some((project) => project.id === projectId)) {
    return sanitizedData
  }

  const now = new Date().toISOString()
  const conversations = sanitizedData.conversations.map((conversation) =>
    conversation.projectId === projectId
      ? {
          ...conversation,
          deletedAt: conversation.deletedAt ?? now,
          updatedAt: now
        }
      : conversation
  )

  return refreshConversationStats({
    ...sanitizedData,
    projects: sanitizedData.projects.filter((project) => project.id !== projectId),
    conversations,
    activeConversationId: selectActiveConversationId(conversations, sanitizedData.activeConversationId)
  })
}

export const createConversation = (
  data: ImageToolData,
  options: {
    projectId?: string | null
    title?: string
  } = {}
): ImageToolData => {
  const sanitizedData = sanitizeImageToolData(data)
  const now = new Date().toISOString()
  const projectId =
    options.projectId === null
      ? null
      : sanitizedData.projects.some((project) => project.id === options.projectId)
        ? (options.projectId ?? null)
        : null
  const conversation: Conversation = {
    id: createStorageId('conversation'),
    projectId,
    title: normalizeTitle(options.title, NEW_CONVERSATION_TITLE),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    messageCount: 0,
    imageCount: 0
  }

  return {
    ...sanitizedData,
    conversations: [conversation, ...sanitizedData.conversations],
    activeConversationId: conversation.id
  }
}

export const renameConversation = (data: ImageToolData, conversationId: string, title: string): ImageToolData => {
  const sanitizedData = sanitizeImageToolData(data)
  const nextTitle = normalizeTitle(title, NEW_CONVERSATION_TITLE)
  const now = new Date().toISOString()

  return {
    ...sanitizedData,
    conversations: sanitizedData.conversations.map((conversation) =>
      conversation.id === conversationId
        ? {
            ...conversation,
            title: nextTitle,
            updatedAt: now
          }
        : conversation
    )
  }
}

export const moveConversationToProject = (
  data: ImageToolData,
  conversationId: string,
  projectId: string | null
): ImageToolData => {
  const sanitizedData = sanitizeImageToolData(data)
  const nextProjectId =
    projectId === null ? null : sanitizedData.projects.some((project) => project.id === projectId) ? projectId : null
  const now = new Date().toISOString()

  return {
    ...sanitizedData,
    conversations: sanitizedData.conversations.map((conversation) =>
      conversation.id === conversationId
        ? {
            ...conversation,
            projectId: nextProjectId,
            updatedAt: now
          }
        : conversation
    )
  }
}

export const setActiveConversation = (data: ImageToolData, conversationId: string): ImageToolData => {
  const sanitizedData = sanitizeImageToolData(data)

  if (
    !sanitizedData.conversations.some((conversation) => conversation.id === conversationId && !conversation.deletedAt)
  ) {
    return sanitizedData
  }

  return {
    ...sanitizedData,
    activeConversationId: conversationId
  }
}

export const moveConversationToTrash = (data: ImageToolData, conversationId: string): ImageToolData => {
  const sanitizedData = sanitizeImageToolData(data)
  const now = new Date().toISOString()
  const conversations = sanitizedData.conversations.map((conversation) =>
    conversation.id === conversationId
      ? {
          ...conversation,
          deletedAt: now,
          updatedAt: now
        }
      : conversation
  )
  const activeConversationId = selectActiveConversationId(
    conversations,
    sanitizedData.activeConversationId === conversationId ? undefined : sanitizedData.activeConversationId
  )

  return refreshConversationStats({
    ...sanitizedData,
    conversations,
    activeConversationId
  })
}

export const restoreConversation = (data: ImageToolData, conversationId: string): ImageToolData => {
  const sanitizedData = sanitizeImageToolData(data)
  const now = new Date().toISOString()
  const hasConversation = sanitizedData.conversations.some((conversation) => conversation.id === conversationId)

  if (!hasConversation) {
    return sanitizedData
  }

  return refreshConversationStats({
    ...sanitizedData,
    conversations: sanitizedData.conversations.map((conversation) =>
      conversation.id === conversationId
        ? {
            ...conversation,
            deletedAt: null,
            updatedAt: now
          }
        : conversation
    ),
    activeConversationId: conversationId
  })
}

export const permanentlyDeleteConversation = (data: ImageToolData, conversationId: string): ImageToolData => {
  const sanitizedData = sanitizeImageToolData(data)
  const conversations = sanitizedData.conversations.filter((conversation) => conversation.id !== conversationId)
  const activeConversationId = selectActiveConversationId(
    conversations,
    sanitizedData.activeConversationId === conversationId ? undefined : sanitizedData.activeConversationId
  )

  return refreshConversationStats({
    ...sanitizedData,
    conversations,
    activeConversationId,
    history: sanitizedData.history.filter((item) => item.conversationId !== conversationId)
  })
}

export const upsertPromptTemplateCategory = (
  data: ImageToolData,
  category: Partial<PromptTemplateCategory> & Pick<PromptTemplateCategory, 'name'>
): ImageToolData => {
  const sanitizedData = sanitizeImageToolData(data)
  const now = new Date().toISOString()
  const existingCategory = sanitizedData.promptTemplateCategories.find((item) => item.id === category.id)
  const maxSortOrder = sanitizedData.promptTemplateCategories.reduce(
    (maxOrder, item) => Math.max(maxOrder, item.sortOrder),
    0
  )
  const parentId =
    category.parentId && sanitizedData.promptTemplateCategories.some((item) => item.id === category.parentId)
      ? category.parentId
      : null
  const nextCategory = sanitizePromptTemplateCategory(
    {
      ...existingCategory,
      ...category,
      id: category.id && sanitizeEntityId(category.id) ? category.id : createStorageId('prompt-category'),
      parentId,
      sortOrder: existingCategory?.sortOrder ?? category.sortOrder ?? maxSortOrder + 1,
      createdAt: existingCategory?.createdAt ?? category.createdAt ?? now,
      updatedAt: now
    },
    now
  )

  if (!nextCategory) {
    return sanitizedData
  }

  return sanitizeImageToolData({
    ...sanitizedData,
    promptTemplateCategories: [
      nextCategory,
      ...sanitizedData.promptTemplateCategories.filter((item) => item.id !== nextCategory.id)
    ]
  })
}

export const removePromptTemplateCategory = (data: ImageToolData, categoryId: string): ImageToolData => {
  const sanitizedData = sanitizeImageToolData(data)
  const sanitizedCategoryId = sanitizeEntityId(categoryId)

  if (!sanitizedCategoryId || sanitizedCategoryId === DEFAULT_PROMPT_TEMPLATE_CATEGORY_ID) {
    return sanitizedData
  }

  const categoryIdsToRemove = new Set<string>([sanitizedCategoryId])
  let didFindChild = true

  while (didFindChild) {
    didFindChild = false

    for (const category of sanitizedData.promptTemplateCategories) {
      if (category.parentId && categoryIdsToRemove.has(category.parentId) && !categoryIdsToRemove.has(category.id)) {
        categoryIdsToRemove.add(category.id)
        didFindChild = true
      }
    }
  }

  return sanitizeImageToolData({
    ...sanitizedData,
    promptTemplateCategories: sanitizedData.promptTemplateCategories.filter(
      (category) => !categoryIdsToRemove.has(category.id)
    ),
    promptTemplates: sanitizedData.promptTemplates.map((template) =>
      template.categoryId && categoryIdsToRemove.has(template.categoryId)
        ? {
            ...template,
            categoryId: DEFAULT_PROMPT_TEMPLATE_CATEGORY_ID,
            updatedAt: new Date().toISOString()
          }
        : template
    )
  })
}

export const upsertPromptTemplate = (
  data: ImageToolData,
  template: Partial<PromptTemplate> & Pick<PromptTemplate, 'title' | 'templateType' | 'prompt'>
): ImageToolData => {
  const sanitizedData = sanitizeImageToolData(data)
  const now = new Date().toISOString()
  const existingTemplate = sanitizedData.promptTemplates.find((item) => item.id === template.id)
  const categoryIds = new Set(sanitizedData.promptTemplateCategories.map((category) => category.id))
  const requestedCategoryId = template.categoryId ?? existingTemplate?.categoryId ?? DEFAULT_PROMPT_TEMPLATE_CATEGORY_ID
  const nextTemplate = sanitizePromptTemplate(
    {
      ...existingTemplate,
      ...template,
      id: template.id && sanitizeEntityId(template.id) ? template.id : createStorageId('prompt-template'),
      categoryId:
        requestedCategoryId === null || (requestedCategoryId && categoryIds.has(requestedCategoryId))
          ? requestedCategoryId
          : DEFAULT_PROMPT_TEMPLATE_CATEGORY_ID,
      source: template.source ?? existingTemplate?.source ?? 'user',
      createdAt: existingTemplate?.createdAt ?? template.createdAt ?? now,
      updatedAt: now
    },
    now,
    categoryIds
  )

  if (!nextTemplate) {
    return sanitizedData
  }

  return sanitizeImageToolData({
    ...sanitizedData,
    promptTemplates: [nextTemplate, ...sanitizedData.promptTemplates.filter((item) => item.id !== nextTemplate.id)]
  })
}

export const removePromptTemplate = (data: ImageToolData, templateId: string): ImageToolData => {
  const sanitizedData = sanitizeImageToolData(data)
  const sanitizedTemplateId = sanitizeEntityId(templateId)

  if (!sanitizedTemplateId) {
    return sanitizedData
  }

  return {
    ...sanitizedData,
    promptTemplates: sanitizedData.promptTemplates.filter((template) => template.id !== sanitizedTemplateId)
  }
}

export const renderPromptTemplatePrompt = (
  template: Pick<PromptTemplate, 'prompt' | 'variables'>,
  values: Record<string, string>
): string => {
  const variableDefaults = (template.variables ?? []).reduce<Record<string, string>>((defaults, variable) => {
    if (typeof variable.defaultValue === 'string') {
      defaults[variable.key] = variable.defaultValue
    }

    return defaults
  }, {})
  const resolvedValues = {
    ...variableDefaults,
    ...values
  }

  return template.prompt.replace(/\{([^{}]+)\}/g, (match, key: string) => {
    const value = resolvedValues[key]
    return typeof value === 'string' ? value : match
  })
}

export const parsePromptTemplateImportDocument = (document: unknown): PromptTemplateImportDocument => {
  if (!isRecord(document)) {
    throw new Error('Template file must be a JSON object.')
  }

  if (document.schemaVersion !== 1) {
    throw new Error('Unsupported template schema version.')
  }

  if (document.kind === 'image-prompt-template') {
    const template = sanitizePromptTemplateImportRecord(document.template)

    if (!template) {
      throw new Error('Template file does not contain a valid template.')
    }

    return {
      kind: 'image-prompt-template',
      templates: [template]
    }
  }

  if (document.kind === 'image-prompt-pack') {
    if (!Array.isArray(document.templates)) {
      throw new Error('Template pack does not contain a templates array.')
    }

    const templates = document.templates.flatMap((template) => {
      const sanitizedTemplate = sanitizePromptTemplateImportRecord(template)
      return sanitizedTemplate ? [sanitizedTemplate] : []
    })

    if (templates.length === 0) {
      throw new Error('Template pack does not contain any valid templates.')
    }

    return {
      kind: 'image-prompt-pack',
      name: normalizeTitle(document.name, 'Prompt template pack'),
      ...(typeof document.description === 'string' && document.description.trim()
        ? { description: document.description.trim() }
        : {}),
      templates
    }
  }

  throw new Error('Unsupported template file kind.')
}

export const createImagePromptTemplateExport = (template: PromptTemplateImportRecord): ImagePromptTemplateFile => ({
  schemaVersion: 1,
  kind: 'image-prompt-template',
  template
})

export const createImagePromptPackExport = ({
  description,
  name,
  templates
}: {
  name: string
  description?: string
  templates: PromptTemplateImportRecord[]
}): ImagePromptPackFile => ({
  schemaVersion: 1,
  kind: 'image-prompt-pack',
  name: normalizeTitle(name, 'Prompt template pack'),
  ...(description ? { description } : {}),
  templates
})

export const setImageProviderCredential = (
  data: ImageToolData,
  templateId: string,
  credential: ImageProviderCredential
): ImageToolData => {
  const sanitizedTemplateId = sanitizeCredentialTemplateId(templateId)

  if (!sanitizedTemplateId) {
    return data
  }

  const apiKey = stringOrDefault(credential.apiKey, '').trim()
  const remainingCredentials = { ...data.settings.providerCredentials }
  delete remainingCredentials[sanitizedTemplateId]

  return {
    ...data,
    settings: {
      ...data.settings,
      providerCredentials: apiKey
        ? {
            ...remainingCredentials,
            [sanitizedTemplateId]: { apiKey }
          }
        : remainingCredentials
    }
  }
}

export const upsertCustomProviderTemplate = (data: ImageToolData, template: ImageProviderTemplate): ImageToolData => {
  const sanitizedTemplate = sanitizeCustomProviderTemplate(
    {
      ...template,
      id: protectedProviderTemplateIds.has(template.id) ? undefined : template.id
    },
    new Set(data.settings.customProviderTemplates.filter((item) => item.id !== template.id).map((item) => item.id))
  )

  if (!sanitizedTemplate) {
    return data
  }

  return {
    ...data,
    settings: {
      ...data.settings,
      customProviderTemplates: [
        sanitizedTemplate,
        ...data.settings.customProviderTemplates.filter(
          (item) => item.id !== template.id && item.id !== sanitizedTemplate.id
        )
      ]
    }
  }
}

export const removeCustomProviderTemplate = (data: ImageToolData, templateId: string): ImageToolData => {
  if (
    protectedProviderTemplateIds.has(templateId) ||
    legacyCompatibleProviderTemplateIds.has(templateId) ||
    isRetiredProviderTemplateId(templateId)
  ) {
    return data
  }

  if (!data.settings.customProviderTemplates.some((template) => template.id === templateId)) {
    return data
  }

  const customProviderTemplates = data.settings.customProviderTemplates.filter((template) => template.id !== templateId)
  const providerCredentials = { ...data.settings.providerCredentials }
  delete providerCredentials[templateId]

  return {
    ...data,
    settings:
      data.settings.providerTemplateId === templateId
        ? {
            ...data.settings,
            providerTemplateId: compatibleImageProviderTemplate.id,
            baseUrl: compatibleImageProviderTemplate.defaultBaseUrl,
            endpointPath: compatibleImageProviderTemplate.endpointPath,
            editEndpointPath: compatibleImageProviderTemplate.editEndpointPath,
            model: compatibleImageProviderTemplate.model,
            sendOutputFormat: compatibleImageProviderTemplate.sendOutputFormat,
            sendResponseFormat: compatibleImageProviderTemplate.sendResponseFormat,
            providerCredentials,
            customProviderTemplates
          }
        : {
            ...data.settings,
            providerCredentials,
            customProviderTemplates
          }
  }
}
