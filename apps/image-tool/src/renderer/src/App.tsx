import {
  type ImageSizeMode,
  type ImageSizePreset,
  type ImageSizeValidationError,
  resolveImageSize
} from '@hoodmagic/model-core'
import {
  type ChangeEvent,
  type ClipboardEvent,
  type CSSProperties,
  type DragEvent,
  type FormEvent,
  type MutableRefObject,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import type {
  ConversationMessage,
  ConversationParams,
  ImageProviderTemplate,
  ImageToolConversation,
  ImageToolDebugDetails,
  ImageToolEditImage2Request,
  ImageToolEditMaskColorMode,
  ImageToolEditMaskSemantic,
  ImageToolEditSubmitMetadata,
  ImageToolEditSubmitMode,
  ImageToolGenerateImage2Request,
  ImageToolGenerateImage2Result,
  ImageToolHistoryItem,
  ImageToolImage2OutputFormat,
  ImageToolImage2Quality,
  ImageToolImage2ResponseFormat,
  ImageToolImageTask,
  ImageToolImageTaskEventCallback,
  ImageToolPersistedSettings,
  ImageToolProjectGroup,
  ImageToolPromptTemplate,
  ImageToolPromptTemplateCategory,
  ImageToolPromptTemplateCategoryInput,
  ImageToolPromptTemplateExportResult,
  ImageToolPromptTemplateImportResult,
  ImageToolPromptTemplateInput,
  ImageToolPromptTemplateType,
  ImageToolReferenceImage,
  ImageToolSaveImageResultAsPromptTemplateInput,
  ImageToolSessionState,
  ImageToolTaskRecord,
  ImageToolTaskRecordFilters,
  ImageToolTaskUsageSnapshot,
  ImageToolTestConnectionRequest,
  ImageToolTestConnectionResult,
  ImageToolUsagePriceSettings
} from '../../shared/image2'
import {
  getImageProviderTemplate,
  getImageProviderTemplates,
  protectedImageProviderTemplateIds
} from '../../shared/image2'
import appLogo from './assets/app-logo.png'

type Language = 'zh' | 'en'
type AppearanceTheme = ImageToolPersistedSettings['appearanceTheme']

const appearanceThemeOptions = ['dark', 'light'] as const

type ImageToolApi = {
  generateImage2: (request: ImageToolGenerateImage2Request) => Promise<ImageToolGenerateImage2Result>
  testImage2Connection: (request: ImageToolTestConnectionRequest) => Promise<ImageToolTestConnectionResult>
  createImage2Task: (request: ImageToolGenerateImage2Request) => Promise<ImageToolImageTask>
  createImageEditTask: (request: ImageToolEditImage2Request) => Promise<ImageToolImageTask>
  getImageTask: (taskId: string) => Promise<ImageToolImageTask | undefined>
  listImageTasks: () => Promise<ImageToolImageTask[]>
  listTaskUsage: (filters?: ImageToolTaskRecordFilters) => Promise<ImageToolTaskUsageSnapshot>
  saveUsagePriceSettings: (settings: ImageToolUsagePriceSettings) => Promise<ImageToolPersistedSettings>
  clearTaskUsage: () => Promise<ImageToolTaskUsageSnapshot>
  exportTaskUsageCsv: (filters?: ImageToolTaskRecordFilters) => Promise<ImageToolPromptTemplateExportResult>
  onImageTaskEvent: (callback: ImageToolImageTaskEventCallback) => () => void
  getSessionState: () => Promise<ImageToolSessionState>
  createConversation: (projectId?: string | null) => Promise<ImageToolSessionState>
  setActiveConversation: (conversationId: string) => Promise<ImageToolSessionState>
  renameConversation: (conversationId: string, title: string) => Promise<ImageToolSessionState>
  moveConversationToProject: (conversationId: string, projectId: string | null) => Promise<ImageToolSessionState>
  deleteConversation: (conversationId: string) => Promise<ImageToolSessionState>
  restoreConversation: (conversationId: string) => Promise<ImageToolSessionState>
  permanentlyDeleteConversation: (conversationId: string) => Promise<ImageToolSessionState>
  createProject: (name: string) => Promise<ImageToolSessionState>
  renameProject: (projectId: string, name: string) => Promise<ImageToolSessionState>
  deleteProject: (projectId: string) => Promise<ImageToolSessionState>
  getSettings: () => Promise<ImageToolPersistedSettings>
  saveSettings: (settings: ImageToolPersistedSettings) => Promise<ImageToolPersistedSettings>
  listHistory: (conversationId?: string) => Promise<ImageToolHistoryItem[]>
  deleteHistoryItem: (id: string) => Promise<void>
  readHistoryImage: (id: string) => Promise<string | undefined>
  listPromptTemplates: () => Promise<ImageToolPromptTemplate[]>
  savePromptTemplate: (template: ImageToolPromptTemplateInput) => Promise<ImageToolPromptTemplate>
  deletePromptTemplate: (templateId: string) => Promise<void>
  deletePromptTemplates: (templateIds: string[]) => Promise<number>
  movePromptTemplatesToCategory: (templateIds: string[], categoryId: string | null) => Promise<number>
  listPromptTemplateCategories: () => Promise<ImageToolPromptTemplateCategory[]>
  savePromptTemplateCategory: (
    category: ImageToolPromptTemplateCategoryInput
  ) => Promise<ImageToolPromptTemplateCategory>
  deletePromptTemplateCategory: (categoryId: string) => Promise<void>
  importPromptTemplateFile: (filePath: string) => Promise<ImageToolPromptTemplateImportResult>
  importPromptTemplateFileContent: (
    fileName: string,
    rawDocument: string
  ) => Promise<ImageToolPromptTemplateImportResult>
  getFilePath: (file: File) => string
  exportPromptTemplate: (templateId: string) => Promise<ImageToolPromptTemplateExportResult>
  exportPromptTemplates: (templateIds: string[]) => Promise<ImageToolPromptTemplateExportResult>
  exportPromptTemplateCategory: (categoryId: string) => Promise<ImageToolPromptTemplateExportResult>
  exportAllPromptTemplates: () => Promise<ImageToolPromptTemplateExportResult>
  scanPromptTemplateImports: () => Promise<ImageToolPromptTemplateImportResult>
  openPromptTemplateFolder: () => Promise<string>
  saveImageResultAsPromptTemplate: (
    input: ImageToolSaveImageResultAsPromptTemplateInput
  ) => Promise<ImageToolPromptTemplate>
}

const getImageToolApi = (): ImageToolApi | undefined => {
  return (window as Window & { imageTool?: ImageToolApi }).imageTool
}

const hasImageToolBridge = (api: ImageToolApi | undefined): api is ImageToolApi => {
  return Boolean(
    api &&
      typeof api.generateImage2 === 'function' &&
      typeof api.testImage2Connection === 'function' &&
      typeof api.createImage2Task === 'function' &&
      typeof api.createImageEditTask === 'function' &&
      typeof api.getImageTask === 'function' &&
      typeof api.listImageTasks === 'function' &&
      typeof api.listTaskUsage === 'function' &&
      typeof api.saveUsagePriceSettings === 'function' &&
      typeof api.clearTaskUsage === 'function' &&
      typeof api.exportTaskUsageCsv === 'function' &&
      typeof api.onImageTaskEvent === 'function' &&
      typeof api.getSessionState === 'function' &&
      typeof api.createConversation === 'function' &&
      typeof api.setActiveConversation === 'function' &&
      typeof api.renameConversation === 'function' &&
      typeof api.moveConversationToProject === 'function' &&
      typeof api.deleteConversation === 'function' &&
      typeof api.restoreConversation === 'function' &&
      typeof api.permanentlyDeleteConversation === 'function' &&
      typeof api.createProject === 'function' &&
      typeof api.renameProject === 'function' &&
      typeof api.deleteProject === 'function' &&
      typeof api.getSettings === 'function' &&
      typeof api.saveSettings === 'function' &&
      typeof api.listHistory === 'function' &&
      typeof api.deleteHistoryItem === 'function' &&
      typeof api.readHistoryImage === 'function' &&
      typeof api.listPromptTemplates === 'function' &&
      typeof api.savePromptTemplate === 'function' &&
      typeof api.deletePromptTemplate === 'function' &&
      typeof api.listPromptTemplateCategories === 'function' &&
      typeof api.savePromptTemplateCategory === 'function' &&
      typeof api.deletePromptTemplateCategory === 'function' &&
      typeof api.importPromptTemplateFile === 'function' &&
      typeof api.importPromptTemplateFileContent === 'function' &&
      typeof api.getFilePath === 'function' &&
      typeof api.exportPromptTemplate === 'function' &&
      typeof api.exportPromptTemplateCategory === 'function' &&
      typeof api.exportAllPromptTemplates === 'function' &&
      typeof api.scanPromptTemplateImports === 'function' &&
      typeof api.openPromptTemplateFolder === 'function' &&
      typeof api.saveImageResultAsPromptTemplate === 'function'
  )
}

type BridgeDiagnostics = {
  isElectron: boolean
  hasBridge: boolean
  keys: string[]
  userAgent: string
}

type PreviewSelfTestResult = {
  dataUrlLoad: 'pending' | 'success' | 'failed'
  blobUrlLoad: 'pending' | 'success' | 'failed'
  blobUrlPrefix?: string
  errorMessage?: string
  cspHint: string
}

type ImageElementDiagnostics = {
  loaded: boolean
  naturalWidth: number
  naturalHeight: number
  currentSrcPrefix: string
}

type ApiStatus = 'unavailable' | 'not-configured' | 'configured' | 'available' | 'error'

type PreviewSize = {
  width?: number
  height?: number
}

type ImagePreviewOrientation = 'landscape' | 'portrait' | 'square' | 'long'

type ImagePreviewLayout = {
  aspectRatioValue: string
  maxHeight: number
  maxWidth: number
  orientation: ImagePreviewOrientation
  width: number
}

type ImagePreviewStyle = CSSProperties & {
  '--preview-aspect-ratio': string
  '--preview-max-height': string
  '--preview-max-width': string
  '--preview-width': string
}

type ImageViewerImageStyle = CSSProperties & {
  cursor?: string
}

type ComposerPopoverKey = 'size' | 'quality' | 'format'

type ReferenceImageDraft = ImageToolReferenceImage

type ComposerMode = 'image_generation' | 'image_reference' | 'image_edit'

type EditingSourceImage = {
  messageId?: string
  historyId?: string
  fileName?: string
  mimeType?: ImageMimeType
  dataUrl: string
  width?: number
  height?: number
  naturalWidth?: number
  naturalHeight?: number
}

type MaskEditTool = 'brush' | 'eraser'

type MaskStrokePoint = {
  x: number
  y: number
}

type MaskEditExport = {
  dataUrl: string
  mimeType: 'image/png'
  blobSize: number
  width: number
  height: number
  hasTransparentPixels: boolean
  hasOpaquePixels: boolean
  transparentAlpha: 0
  opaqueAlpha: 255
}

type PreparedEditAssets = {
  sourceReferenceImage: ReferenceImageDraft
  maskReferenceImage: ReferenceImageDraft
  requestSize: string
  metadata: ImageToolEditSubmitMetadata
}

type MaskEditController = {
  clear: () => void
  exportMask: () => Promise<MaskEditExport>
}

type ComposerSizeOption = {
  label: Record<Language, string>
  value: ImageSizePreset
}

type ComposerPopoverState =
  | {
      key: ComposerPopoverKey
    }
  | undefined

type ComposerValidationResult =
  | {
      ok: true
      params: ConversationParams
      request: ImageToolGenerateImage2Request | ImageToolEditImage2Request
    }
  | {
      ok: false
      message: ConversationMessage
    }

type LocalImageQueueJob = {
  id: string
  conversationId?: string
  userMessageId: string
  assistantMessageId: string
  mode: ComposerMode
  params: ConversationParams
  request: ImageToolGenerateImage2Request | ImageToolEditImage2Request
  referenceImages?: ReferenceImageDraft[]
  retryCount: number
  status: 'queued' | 'running'
}

type ApiSettingsDraft = {
  providerTemplateId: string
  baseUrl: string
  endpointPath: string
  editEndpointPath: string
  apiKey: string
  model: string
  outputFormat: ImageToolImage2OutputFormat
  sendOutputFormat: boolean
  sendResponseFormat: boolean
  responseFormat: ImageToolImage2ResponseFormat
  providerCredentials: ImageToolPersistedSettings['providerCredentials']
  customProviderTemplates: ImageProviderTemplate[]
}

type TemplateEditorDraft = {
  id?: string
  name: string
  description: string
  defaultBaseUrl: string
  endpointPath: string
  editEndpointPath: string
  model: string
  sendOutputFormat: boolean
  outputFormat: ImageToolImage2OutputFormat
  sendResponseFormat: boolean
  responseFormat: ImageToolImage2ResponseFormat
}

type PromptTemplateTypeFilter = 'all' | ImageToolPromptTemplateType

type PromptTemplateApplyMode = 'replace' | 'append'

type PromptTemplateVariableDraft = {
  key: string
  label: string
  placeholder: string
  required: boolean
  defaultValue: string
}

type PromptTemplateEditorDraft = {
  id?: string
  title: string
  categoryId: string | null
  templateType: ImageToolPromptTemplateType
  description: string
  prompt: string
  variables: PromptTemplateVariableDraft[]
  tags: string
  recommendedSize: string
  recommendedQuality: ImageToolImage2Quality | ''
  recommendedOutputFormat: ImageToolImage2OutputFormat | ''
  previewDataUrl?: string
  removePreview?: boolean
  sourceHistoryId?: string
  sourceImageDataUrl?: string
}

type PromptTemplateVariableDialogState = {
  template: ImageToolPromptTemplate
  values: Record<string, string>
  applyMode: PromptTemplateApplyMode
  error?: string
}

type PromptTemplateCategoryDialogState =
  | {
      mode: 'create'
      name: string
      error?: string
    }
  | {
      mode: 'rename'
      category: ImageToolPromptTemplateCategory
      name: string
      error?: string
    }

type ConfirmationDialogState = {
  cancelLabel: string
  confirmLabel: string
  message: string
  title: string
  tone?: 'danger' | 'primary'
}

type TextInputDialogState = {
  cancelLabel: string
  confirmLabel: string
  error?: string
  label: string
  requiredMessage: string
  title: string
  value: string
}

type UsageProviderFilter = 'all' | 'deleted' | string
type UsageStatusFilter = 'all' | ImageToolTaskRecord['status']
type UsageTypeFilter = 'all' | ImageToolTaskRecord['taskType']
type UsageTimeRangeFilter = 'all' | 'today' | '7d' | '30d'
type PromptTemplateCardScale = 'compact' | 'comfortable' | 'large'

type UsageFilters = {
  providerTemplateId: UsageProviderFilter
  status: UsageStatusFilter
  taskType: UsageTypeFilter
  timeRange: UsageTimeRangeFilter
}

const CUSTOM_LOGO_STORAGE_KEY = 'image-tool:custom-logo-data-url'
const COLLAPSED_PROJECT_IDS_STORAGE_KEY = 'image-tool:collapsed-project-ids'
const PROMPT_TEMPLATE_CARD_SCALE_STORAGE_KEY = 'image-tool:prompt-template-card-scale'
const UNGROUPED_PROJECT_KEY = '__ungrouped__'
const LOGO_ACCEPTED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
const LOGO_ACCEPTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg'])

const readStoredValue = (key: string): string | undefined => {
  try {
    return window.localStorage.getItem(key) ?? undefined
  } catch {
    return undefined
  }
}

const writeStoredValue = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Renderer-only preferences are best effort; core image generation does not depend on them.
  }
}

const removeStoredValue = (key: string): void => {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Ignore unavailable localStorage.
  }
}

const readStoredStringArray = (key: string): string[] => {
  const storedValue = readStoredValue(key)

  if (!storedValue) {
    return []
  }

  try {
    const parsedValue = JSON.parse(storedValue)
    return Array.isArray(parsedValue) ? parsedValue.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

const writeStoredStringArray = (key: string, value: readonly string[]): void => {
  writeStoredValue(key, JSON.stringify(value))
}

const isPromptTemplateCardScale = (value: string | undefined): value is PromptTemplateCardScale => {
  return value === 'compact' || value === 'comfortable' || value === 'large'
}

const readStoredPromptTemplateCardScale = (): PromptTemplateCardScale => {
  const storedValue = readStoredValue(PROMPT_TEMPLATE_CARD_SCALE_STORAGE_KEY)
  return isPromptTemplateCardScale(storedValue) ? storedValue : 'comfortable'
}

const isSupportedLogoFile = (file: File): boolean => {
  const fileName = file.name.toLowerCase()
  const extensionStart = fileName.lastIndexOf('.')
  const extension = extensionStart >= 0 ? fileName.slice(extensionStart) : ''

  return LOGO_ACCEPTED_MIME_TYPES.has(file.type) || LOGO_ACCEPTED_EXTENSIONS.has(extension)
}

const getBridgeDiagnostics = (): BridgeDiagnostics => {
  const api = getImageToolApi()
  const userAgent = navigator.userAgent

  return {
    isElectron: userAgent.includes('Electron'),
    hasBridge: hasImageToolBridge(api),
    keys: api ? Object.keys(api).sort() : [],
    userAgent
  }
}

const enCopy = {
  appEyebrow: 'i2 生图工具',
  appTitle: 'i2 生图工具',
  settings: 'Settings',
  newChat: 'New chat',
  defaultProject: 'Default project',
  ungroupedProject: 'Ungrouped',
  newProject: 'New project',
  newProjectName: 'New project',
  projectNameRequired: 'Enter a project name',
  rename: 'Rename',
  moveToProject: 'Move to project',
  delete: 'Delete',
  trash: 'Trash',
  restore: 'Restore',
  deletePermanently: 'Delete permanently',
  chatMovedToTrash: 'This chat has been moved to Trash',
  confirmPermanentDeleteChat: 'Permanently delete this chat? This cannot be undone.',
  noChats: 'No chats',
  projectNamePrompt: 'Project name',
  conversationTitlePrompt: 'Chat title',
  confirmDeleteConversation: 'Move this chat to Trash?',
  confirmDeleteProject: 'Deleting this project will move all chats in it to Trash. Continue?',
  noProjectsYet: 'No projects yet',
  noProjectsHint: 'Create a project or start a new chat',
  selectOrCreateChat: 'Select or create a chat',
  moreActions: 'More actions',
  trashEmpty: 'Trash is empty.',
  conversationLabel: 'Conversation',
  projectsLabel: 'Projects',
  projectConversationCount: '{count} chats',
  collapseProject: 'Collapse project',
  expandProject: 'Expand project',
  changeLogo: 'Change logo',
  restoreDefaultLogo: 'Restore default logo',
  logoUpdated: 'Logo updated.',
  logoRestored: 'Default logo restored.',
  logoUnsupported: 'Use a png, jpg, webp, or svg logo.',
  logoReadFailed: 'Could not read this logo image.',
  currentSettingsLabel: 'Current generation settings',
  emptyState: 'Start by describing the image you want to create.',
  emptyStateHint: 'More detailed prompts help create better images.',
  inputRequired: 'This field is required.',
  generating: 'Generating...',
  requestedSize: 'requested size',
  generationError: 'generation_error',
  imageGenerationFailed: 'Image generation failed.',
  missingBridge: 'i2 生图工具 preload API is unavailable.',
  bridgeReady: 'bridge ready',
  bridgeMissing: 'bridge missing',
  ready: 'ready',
  missing: 'missing',
  pending: 'pending',
  success: 'success',
  failed: 'failed',
  unknown: 'unknown',
  none: 'none',
  diagnosticsTitle: 'Bridge diagnostics',
  electronRuntime: 'Electron window',
  browserRuntimeHint:
    'This is not an Electron window. Start with pnpm --filter image-tool dev and use the Electron window it opens, not the Vite URL in a browser.',
  userAgent: 'userAgent',
  hasBridge: 'window.imageTool',
  bridgeKeys: 'window.imageTool keys',
  debugDetails: 'Debug details',
  taskCreated: 'Task created',
  taskQueued: 'Queued',
  taskRunning: 'Generating',
  taskEditing: 'Editing',
  taskSucceeded: 'Done',
  taskFailed: 'Failed',
  promptRequired: 'Prompt is required.',
  baseUrlRequired: 'Base URL is required.',
  apiKeyRequired: 'API key is required.',
  apiConfigRequired: 'The current provider template has no API key. Fill it in from Settings in the top right.',
  modelRequired: 'Model is required.',
  sizeRequired: 'Resolved image size is required.',
  invalidSize: 'invalid size',
  providerSettings: 'Provider settings',
  providerTemplate: 'Provider Template',
  templateCompatibleName: 'Compatible API',
  templateCompatibleDescription: 'Works with standard Images API or compatible proxies.',
  templateDescription: 'Template details',
  addTemplate: 'New Template',
  editTemplate: 'Edit Template',
  deleteTemplate: 'Delete Template',
  saveTemplate: 'Save Template',
  saveAsTemplate: 'Save as Template',
  newInterfaceTemplateName: 'New API template',
  promptLibrary: 'Prompt Library',
  promptLibraryPanelLabel: 'Prompt template library',
  templateLibrary: 'Templates',
  allCategories: 'All',
  uncategorized: 'Uncategorized',
  newCategory: 'New category',
  renameCategory: 'Rename category',
  deleteCategory: 'Delete category',
  categoryNamePrompt: 'Category name',
  categoryRenamePrompt: 'New category name',
  confirmDeletePromptCategory: 'Delete this category? Its templates will move to Uncategorized.',
  newPromptTemplate: 'New template',
  editPromptTemplate: 'Edit template',
  deletePromptTemplate: 'Delete template',
  confirmDeletePromptTemplate: 'Delete this prompt template?',
  useTemplate: 'Use',
  copyPrompt: 'Copy',
  exportTemplate: 'Export',
  exportCategory: 'Export category',
  exportAll: 'Export all',
  importPromptTemplateFile: 'Import',
  scanImport: 'Scan imports',
  openTemplateFolder: 'Open template folder',
  searchTemplates: 'Search templates',
  templateCardSize: 'Card size',
  templateCardCompact: 'Compact',
  templateCardComfortable: 'Standard',
  templateCardLarge: 'Large',
  allTemplateTypes: 'All types',
  textToImage: 'Text to image',
  imageToImage: 'Image to image',
  effectImage: 'Preview',
  noTemplates: 'No templates',
  noPreview: 'No preview',
  selectTemplate: 'Select template',
  selectAllVisibleTemplates: 'Select visible',
  clearVisibleTemplateSelection: 'Unselect visible',
  clearTemplateSelection: 'Clear selection',
  selectedTemplates: '{count} selected',
  moveSelectedTemplates: 'Move',
  exportSelectedTemplates: 'Export selected',
  deleteSelectedTemplates: 'Delete selected',
  moveToCategory: 'Move to category',
  confirmDeleteSelectedPromptTemplates: 'Delete {count} selected prompt templates?',
  selectedTemplatesMoved: 'Moved {count} templates.',
  selectedTemplatesDeleted: 'Deleted {count} templates.',
  title: 'Title',
  description: 'Description',
  category: 'Category',
  templateType: 'Type',
  promptTemplatePrompt: 'Prompt',
  variables: 'Variables',
  addVariable: 'Add variable',
  removeVariable: 'Remove variable',
  variableKey: 'Key',
  variableLabel: 'Label',
  variablePlaceholder: 'Placeholder',
  variableRequired: 'Required',
  variableDefault: 'Default',
  tags: 'Tags',
  recommendedParams: 'Recommended parameters',
  recommendedSize: 'Recommended size',
  recommendedQuality: 'Recommended quality',
  recommendedFormat: 'Recommended format',
  previewUpload: 'Upload preview',
  removePreview: 'Remove preview',
  replaceCurrentPrompt: 'Replace current prompt',
  appendToCurrentPrompt: 'Append to current prompt',
  templateVariables: 'Template variables',
  fillVariables: 'Apply template',
  requiredVariableMissing: 'Fill all required variables.',
  imageToImageTemplateNotice:
    'This template works best with a reference image. Upload a reference image before generating.',
  templateCopied: 'Prompt copied.',
  templateSaved: 'Template saved.',
  templateDeleted: 'Template deleted.',
  templateExported: 'Template exported: {fileName}',
  templateImportSuccess: 'Imported {imported} templates. Updated {updated}. Skipped {skipped}.',
  templateImportFailed: 'Template import failed: {reason}',
  folderOpened: 'Template folder opened.',
  importFileNeedsPath: 'This file picker did not provide a file path. Copy the file to imports and scan it.',
  categorySaved: 'Category saved.',
  categoryDeleted: 'Category deleted.',
  saveCategory: 'Save category',
  templateName: 'Template name',
  templateNameRequired: 'Template name is required.',
  confirmDeleteTemplate: 'Delete this user template?',
  builtInTemplateLocked: 'Built-in templates cannot be edited or deleted.',
  requestPreview: 'Request Preview',
  requestPreviewTemplate: 'Template',
  requestPreviewGenerationEndpoint: 'Generation Endpoint',
  requestPreviewEditEndpoint: 'Edit Endpoint',
  requestPreviewSendOutputFormat: 'Send output_format',
  requestPreviewSendResponseFormat: 'Send response_format',
  yes: 'yes',
  no: 'no',
  endpoint: 'Endpoint',
  endpointPath: 'Endpoint Path',
  editEndpointPath: 'Edit Endpoint Path',
  advancedSettings: 'Advanced settings',
  apiUnavailable: 'API unavailable',
  apiNotConfigured: 'API not configured',
  apiConfigured: 'API configured',
  apiAvailable: 'API available',
  apiError: 'API error',
  sendOutputFormat: 'Send output_format',
  sendResponseFormat: 'Send response_format',
  responseFormat: 'response_format',
  compatibilityHint:
    'If the platform reports Unknown parameter: response_format, turn off sendResponseFormat. If it reports Unknown parameter: output_format, turn off sendOutputFormat.',
  baseUrl: 'Base URL',
  apiKey: 'API key',
  showApiKey: 'Show API key',
  hideApiKey: 'Hide API key',
  promptLabel: 'Prompt',
  promptPlaceholder: 'Describe the image you want to create',
  expand: 'Expand',
  collapse: 'Collapse',
  promptPlaceholderEdit: 'Describe how you want to edit this image',
  model: 'Model',
  size: 'Size',
  quality: 'Quality',
  format: 'Format',
  generate: 'Generate',
  composerMode: 'Image generation',
  composerModeGeneration: 'Image generation',
  composerModeReference: 'Reference generation',
  composerModeEdit: 'Image edit',
  composerReferenceImages: 'Reference images',
  addReferenceImage: 'Add reference image',
  removeReferenceImage: 'Remove reference image',
  referenceImageCount: '{count} images',
  referenceImageLimit: 'Up to 15 reference images',
  referenceImageLimitEdit: 'Edit mode supports up to 15 reference images',
  referenceImageRequired: 'Add at least 1 reference image',
  referenceImageTooLarge: 'Reference images must be 50MB or smaller in total',
  referenceImageUnsupported: 'Only image files are supported',
  referenceImageTooMany: 'You can add up to 15 reference images',
  referenceImagePending: 'Reference images',
  referenceImageNotSaved: 'The reference images for this task were not saved. Upload them again.',
  textGuidance: 'Text',
  subjectReference: 'Subject reference',
  sizeAuto: 'Auto',
  sizeSquare: '1:1',
  sizeLandscape: '16:9',
  sizePortrait: '9:16',
  size4kLandscape: '4K landscape 3840x2160',
  size4kPortrait: '4K portrait 2160x3840',
  generationParameters: 'Generation parameters',
  imageAlt: 'Generated image',
  imageDataMissing: 'Image data is missing.',
  imagePreviewFailed: 'Image preview failed to load.',
  invalidImagePayload: 'The returned payload is not a valid image.',
  historyImageInvalid: 'The history image could not be read or is not a valid image.',
  imageDebug: 'Image diagnostics',
  outputFormat: 'outputFormat',
  previewImage: 'View image',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  fitScreen: 'Fit',
  actualSize: '100%',
  saveImage: 'Save image',
  editImage: 'Edit image',
  editSubmitMode: 'Edit submit size',
  editSubmitOriginal: 'Original size',
  editSubmitCompatible: 'Compatible',
  editSubmitCompatibleHint:
    'Compatible: submits a smaller edit pair for better upstream compatibility. Original image and 4K generation are not affected.',
  editSubmitOriginalHint:
    'Original size: submits the original image size. Some upstreams may not support 4K mask edits.',
  editSubmitOriginalFailureHint: 'This upstream may not support original-size mask edits. Try Compatible mode.',
  editWorkspaceTitle: 'Edit image',
  editWorkspaceSubtitle: 'Paint the area to change, then describe the edit.',
  submitEdit: 'Submit edit',
  submittingEdit: 'Submitting...',
  editingCurrentImage: 'Editing current image locally',
  cancelEditing: 'Cancel editing',
  confirmCloseEditor: 'Close the editor and discard the current mask?',
  editingSourceUnavailable: 'Cannot read this image. Regenerate it or choose another image.',
  editModeNeedsSource: 'Click Edit image on an image result first.',
  promptPlaceholderMaskEdit: 'Describe how you want to change the painted area',
  editWorkspaceHelp: 'Use the brush to mark editable areas. Hold Space or drag outside the image to pan.',
  brushTool: 'Brush',
  eraserTool: 'Eraser',
  brushSize: 'Brush {size}px',
  clearMask: 'Clear mask',
  maskEditHint: 'Use Edit image on a result card, then paint the area to change.',
  maskEditActive: 'Local edit active',
  maskRequired: 'Paint the area you want to change first.',
  editPromptRequired: 'Enter an edit description.',
  maskTooLarge: 'The mask image is over 4MB. Reduce the image size or painted area.',
  maskSizeMismatch: 'Mask size must match the source image size.',
  maskPngRequired: 'Mask must be exported as a PNG image.',
  maskAlphaInvalid: 'Mask alpha validation failed. Paint again and retry.',
  sourceImageSizeMissing: 'Cannot read the source image dimensions.',
  sourceImageNormalizeFailed: 'Could not normalize the source image before editing.',
  normalizedSourceImageTooLarge: 'The normalized source PNG is over 50MB. Use a smaller image for editing.',
  maskExportFailed: 'Could not export the mask. Paint again and retry.',
  sourceImageSize: 'Source',
  maskImageSize: 'Mask',
  saveSettings: 'Save settings',
  cancel: 'Cancel',
  close: 'Close',
  testConnection: 'Test Connection',
  testingConnection: 'Testing...',
  connectionTestResult: 'Connection test result',
  connectionEndpoint: 'endpoint',
  connectionModel: 'model',
  connectionSize: 'size',
  connectionHasUrl: 'has url',
  connectionHasB64Json: 'has b64Json',
  connectionCode: 'code',
  connectionHttpStatus: 'http status',
  connectionUpstreamCode: 'upstreamCode',
  connectionUpstreamType: 'upstreamType',
  connectionMessage: 'message',
  connectionRequestSummary: 'requestSummary',
  settingsSaved: 'Settings saved',
  tasksUsage: 'Tasks / Usage Cost',
  usageTitle: 'Tasks / Usage Cost',
  usageStatsTotalTasks: 'Total tasks',
  usageStatsSucceededTasks: 'Succeeded',
  usageStatsFailedTasks: 'Failed',
  usageStatsRunningTasks: 'Running',
  usageStatsSuccessfulImages: 'Images',
  usageStatsTotalCost: 'Total cost',
  usagePriceSettings: 'Price settings',
  usageDefaultUnitPrice: 'Default unit price',
  usageCurrentProviderUnitPrice: 'Current API unit price',
  usageUnitLabel: 'CNY / image',
  usageSavePrices: 'Save prices',
  usagePricesSaved: 'Prices saved. New tasks will use the new price.',
  usageInvalidPrice: 'Price must be a number greater than or equal to 0.',
  usageFilters: 'Filters',
  usageAllApis: 'All APIs',
  usageDeletedApis: 'Deleted APIs',
  usageAllStatuses: 'All statuses',
  usageAllTypes: 'All types',
  usageAllTime: 'All time',
  usageToday: 'Today',
  usageLast7Days: 'Last 7 days',
  usageLast30Days: 'Last 30 days',
  usageStatusQueued: 'Queued',
  usageStatusRunning: 'Running',
  usageStatusSucceeded: 'Succeeded',
  usageStatusFailed: 'Failed',
  usageStatusCanceled: 'Canceled',
  usageTypeTextToImage: 'Text to image',
  usageTypeImageToImage: 'Image to image',
  usageTypeImageEdit: 'Image edit',
  usageTableTime: 'Time',
  usageTableApi: 'API',
  usageTableType: 'Type',
  usageTableStatus: 'Status',
  usageTableModel: 'Model',
  usageTableSize: 'Size',
  usageTableImages: 'Images',
  usageTableUnitPrice: 'Unit price',
  usageTableCost: 'Cost',
  usageTableConversation: 'Chat/Project',
  usageTableError: 'Error',
  usageEmpty: 'No task records yet.',
  usageExportCsv: 'Export CSV',
  usageCsvExported: 'CSV exported: {fileName}',
  usageClear: 'Clear records',
  usageConfirmClear: 'Clear task usage records only? Chats, images, templates, and API settings will stay.',
  usageEstimatedCostHint: 'Estimated only',
  deleteHistory: 'Delete history',
  regenerate: 'Regenerate',
  language: 'Language',
  theme: 'Theme',
  darkTheme: 'Dark',
  lightTheme: 'Light',
  zh: 'Chinese',
  en: 'English',
  sizeErrors: {
    invalid_size_format: 'Image size must use the WIDTHxHEIGHT format.',
    invalid_size_dimension: 'Image width and height must be positive integers.',
    invalid_size_multiple: 'Image width and height must both be multiples of 16.',
    invalid_size_max_side: 'Image width and height cannot exceed 3840 on either side.',
    invalid_size_min_pixels: 'Image size must contain at least 655360 pixels.',
    invalid_size_max_pixels: 'Image size cannot exceed 8294400 pixels.',
    invalid_size_aspect_ratio: 'Image aspect ratio cannot exceed 3:1.',
    invalid_size_mode: 'Image size mode must be auto or fixed.',
    missing_fixed_size: 'Fixed image size mode requires an explicit non-auto size.',
    unsupported_fixed_size: 'Fixed image size must be one of the supported presets.'
  }
} as const

type CopyText = {
  [Key in keyof typeof enCopy]: Key extends 'sizeErrors'
    ? { [ErrorKey in keyof (typeof enCopy)['sizeErrors']]: string }
    : string
}

const zhCopy: CopyText = {
  appEyebrow: 'i2 生图工具',
  appTitle: 'i2 生图工具',
  settings: '设置',
  newChat: '新建聊天',
  defaultProject: '默认项目',
  ungroupedProject: '未分组',
  newProject: '新建项目',
  newProjectName: '新项目',
  projectNameRequired: '请输入项目名称',
  rename: '重命名',
  moveToProject: '移动到项目',
  delete: '删除',
  trash: '回收站',
  restore: '恢复',
  deletePermanently: '彻底删除',
  chatMovedToTrash: '该会话已移至回收站',
  confirmPermanentDeleteChat: '是否彻底删除该会话？此操作不可恢复。',
  noChats: '无会话',
  projectNamePrompt: '项目名称',
  conversationTitlePrompt: '会话标题',
  confirmDeleteConversation: '将该会话移至回收站？',
  confirmDeleteProject: '删除项目会将该项目下的所有聊天移至回收站，是否继续？',
  noProjectsYet: '暂无项目',
  noProjectsHint: '创建项目或新建聊天开始创作',
  selectOrCreateChat: '请选择或新建聊天',
  moreActions: '更多操作',
  trashEmpty: '回收站为空。',
  conversationLabel: '会话',
  projectsLabel: '项目',
  projectConversationCount: '{count} 个会话',
  collapseProject: '收起项目',
  expandProject: '展开项目',
  changeLogo: '更换图标',
  restoreDefaultLogo: '恢复默认图标',
  logoUpdated: '图标已更新。',
  logoRestored: '已恢复默认图标。',
  logoUnsupported: '请使用 png、jpg、webp 或 svg 图标。',
  logoReadFailed: '无法读取这个图标文件。',
  currentSettingsLabel: '当前生成设置',
  emptyState: '先描述你想创建的图片。',
  emptyStateHint: '尽可能详细的描述，有助于创作出更好的图片。',
  inputRequired: '请填写此项。',
  generating: '生成中...',
  requestedSize: '请求尺寸',
  generationError: '生成错误',
  imageGenerationFailed: '图片生成失败。',
  missingBridge: 'i2 生图工具 preload API 不可用。',
  bridgeReady: '桥接已就绪',
  bridgeMissing: '桥接缺失',
  ready: '就绪',
  missing: '缺失',
  pending: '等待中',
  success: '成功',
  failed: '失败',
  unknown: '未知',
  none: '无',
  diagnosticsTitle: '桥接诊断',
  electronRuntime: 'Electron 窗口',
  browserRuntimeHint:
    '这不是 Electron 窗口。请使用 pnpm --filter image-tool dev 启动，并使用打开的 Electron 窗口，而不是浏览器里的 Vite 地址。',
  userAgent: 'userAgent',
  hasBridge: 'window.imageTool',
  bridgeKeys: 'window.imageTool keys',
  debugDetails: '调试详情',
  taskCreated: '任务已创建',
  taskQueued: '排队中',
  taskRunning: '生成中',
  taskEditing: '编辑中',
  taskSucceeded: '完成',
  taskFailed: '失败',
  promptRequired: '请输入图片描述。',
  baseUrlRequired: 'Base URL 必填。',
  apiKeyRequired: 'API Key 必填。',
  apiConfigRequired: '当前接口模板未配置 API Key，请在右上角设置中填写。',
  modelRequired: '模型必填。',
  sizeRequired: '解析后的图片尺寸必填。',
  invalidSize: '无效尺寸',
  providerSettings: 'API 设置',
  providerTemplate: '接口模板',
  templateCompatibleName: '官方兼容接口',
  templateCompatibleDescription: '适用于标准 Images API 或兼容代理。',
  templateDescription: '模板详情',
  addTemplate: '新建模板',
  editTemplate: '编辑模板',
  deleteTemplate: '删除模板',
  saveTemplate: '保存模板',
  saveAsTemplate: '另存为模板',
  newInterfaceTemplateName: '新接口模板',
  promptLibrary: '提示词库',
  promptLibraryPanelLabel: '提示词模板库',
  templateLibrary: '模板',
  allCategories: '全部',
  uncategorized: '未分类',
  newCategory: '新建分类',
  renameCategory: '重命名分类',
  deleteCategory: '删除分类',
  categoryNamePrompt: '分类名称',
  categoryRenamePrompt: '新的分类名称',
  confirmDeletePromptCategory: '确定删除这个分类吗？其中的模板会移动到未分类。',
  newPromptTemplate: '新建模板',
  editPromptTemplate: '编辑模板',
  deletePromptTemplate: '删除模板',
  confirmDeletePromptTemplate: '确定删除这个提示词模板吗？',
  useTemplate: '使用',
  copyPrompt: '复制',
  exportTemplate: '导出',
  exportCategory: '导出分类',
  exportAll: '导出全部',
  importPromptTemplateFile: '导入',
  scanImport: '扫描导入',
  openTemplateFolder: '打开模板文件夹',
  searchTemplates: '搜索模板',
  templateCardSize: '卡片大小',
  templateCardCompact: '紧凑',
  templateCardComfortable: '标准',
  templateCardLarge: '宽松',
  allTemplateTypes: '全部类型',
  textToImage: '文生图',
  imageToImage: '图生图',
  effectImage: '效果图',
  noTemplates: '暂无模板',
  noPreview: '暂无效果图',
  selectTemplate: '选择模板',
  selectAllVisibleTemplates: '全选当前',
  clearVisibleTemplateSelection: '取消当前选择',
  clearTemplateSelection: '清空选择',
  selectedTemplates: '已选 {count} 个',
  moveSelectedTemplates: '移动',
  exportSelectedTemplates: '导出已选',
  deleteSelectedTemplates: '删除已选',
  moveToCategory: '移动到分类',
  confirmDeleteSelectedPromptTemplates: '确定删除选中的 {count} 个提示词模板吗？',
  selectedTemplatesMoved: '已移动 {count} 个模板。',
  selectedTemplatesDeleted: '已删除 {count} 个模板。',
  title: '标题',
  description: '描述',
  category: '分类',
  templateType: '类型',
  promptTemplatePrompt: '提示词',
  variables: '变量',
  addVariable: '添加变量',
  removeVariable: '删除变量',
  variableKey: '变量名',
  variableLabel: '显示名称',
  variablePlaceholder: '占位提示',
  variableRequired: '必填',
  variableDefault: '默认值',
  tags: '标签',
  recommendedParams: '推荐参数',
  recommendedSize: '推荐尺寸',
  recommendedQuality: '推荐质量',
  recommendedFormat: '推荐格式',
  previewUpload: '上传效果图',
  removePreview: '移除效果图',
  replaceCurrentPrompt: '替换当前提示词',
  appendToCurrentPrompt: '追加到当前提示词',
  templateVariables: '模板变量',
  fillVariables: '应用模板',
  requiredVariableMissing: '请填写所有必填变量。',
  imageToImageTemplateNotice: '该模板适合搭配参考图使用，请上传参考图后生成。',
  templateCopied: '已复制提示词。',
  templateSaved: '模板已保存。',
  templateDeleted: '模板已删除。',
  templateExported: '模板已导出：{fileName}',
  templateImportSuccess: '模板导入成功：导入 {imported} 个，更新 {updated} 个，跳过 {skipped} 个。',
  templateImportFailed: '模板导入失败：{reason}',
  folderOpened: '模板文件夹已打开。',
  importFileNeedsPath: '当前文件选择器没有提供文件路径，请复制到 imports 文件夹后扫描导入。',
  categorySaved: '分类已保存。',
  categoryDeleted: '分类已删除。',
  saveCategory: '保存分类',
  templateName: '模板名称',
  templateNameRequired: '请输入模板名称。',
  confirmDeleteTemplate: '确定删除这个用户模板吗？',
  builtInTemplateLocked: '内置模板不能编辑或删除。',
  requestPreview: '请求预览',
  requestPreviewTemplate: '模板',
  requestPreviewGenerationEndpoint: '生成 Endpoint',
  requestPreviewEditEndpoint: '编辑 Endpoint',
  requestPreviewSendOutputFormat: '发送 output_format',
  requestPreviewSendResponseFormat: '发送 response_format',
  yes: '是',
  no: '否',
  endpoint: 'Endpoint',
  endpointPath: '生成 Endpoint Path',
  editEndpointPath: '编辑 Endpoint Path',
  advancedSettings: '高级设置',
  apiUnavailable: 'API 不可用',
  apiNotConfigured: 'API 未配置',
  apiConfigured: 'API 已配置',
  apiAvailable: 'API 可用',
  apiError: 'API 异常',
  sendOutputFormat: '发送 output_format',
  sendResponseFormat: '发送 response_format',
  responseFormat: 'response_format',
  compatibilityHint:
    '如果平台提示 Unknown parameter: response_format，请关闭 sendResponseFormat；如果提示 Unknown parameter: output_format，请关闭 sendOutputFormat。',
  baseUrl: 'Base URL',
  apiKey: 'API Key',
  showApiKey: '显示 API Key',
  hideApiKey: '隐藏 API Key',
  promptLabel: '提示词',
  promptPlaceholder: '描述你想创建的图片',
  expand: '展开',
  collapse: '收起',
  promptPlaceholderEdit: '描述你想如何修改这张图片',
  model: '模型',
  size: '尺寸',
  quality: '质量',
  format: '格式',
  generate: '生成',
  composerMode: '图片生成',
  composerModeGeneration: '图片生成',
  composerModeReference: '参考图生成',
  composerModeEdit: '图片编辑',
  composerReferenceImages: '参考图',
  addReferenceImage: '添加参考图',
  removeReferenceImage: '移除参考图',
  referenceImageCount: '{count} 张',
  referenceImageLimit: '最多 15 张参考图',
  referenceImageLimitEdit: '编辑模式最多支持 15 张参考图',
  referenceImageRequired: '请至少添加 1 张参考图',
  referenceImageTooLarge: '参考图总大小不能超过 50MB',
  referenceImageUnsupported: '仅支持图片文件',
  referenceImageTooMany: '最多支持 15 张参考图',
  referenceImagePending: '参考图',
  referenceImageNotSaved: '该任务的参考图未保存，请重新上传参考图。',
  textGuidance: '文字',
  subjectReference: '主体参考',
  sizeAuto: '自动',
  sizeSquare: '1:1',
  sizeLandscape: '16:9',
  sizePortrait: '9:16',
  size4kLandscape: '4K 横图 3840x2160',
  size4kPortrait: '4K 竖图 2160x3840',
  generationParameters: '生成参数',
  imageAlt: '生成图片',
  imageDataMissing: '图片数据缺失。',
  imagePreviewFailed: '图片预览加载失败。',
  invalidImagePayload: '返回内容不是有效图片。',
  historyImageInvalid: '无法读取历史图片，或历史图片不是有效图片。',
  imageDebug: '图片诊断',
  outputFormat: 'outputFormat',
  previewImage: '查看图片',
  zoomIn: '放大',
  zoomOut: '缩小',
  fitScreen: '适应屏幕',
  actualSize: '100%',
  saveImage: '保存图片',
  editImage: '编辑图片',
  editSubmitMode: '编辑提交尺寸',
  editSubmitOriginal: '原始尺寸',
  editSubmitCompatible: '兼容模式',
  editSubmitCompatibleHint: '兼容模式：以较小尺寸提交编辑，提高上游成功率；不影响原图和文生图 4K。',
  editSubmitOriginalHint: '原始尺寸：使用原图尺寸提交，部分上游可能不支持 4K mask 编辑。',
  editSubmitOriginalFailureHint: '当前上游可能不支持原始尺寸编辑，请切换兼容模式重试。',
  editWorkspaceTitle: '编辑图片',
  editWorkspaceSubtitle: '涂抹需要修改的区域，然后描述修改要求。',
  submitEdit: '提交编辑',
  submittingEdit: '提交中...',
  editingCurrentImage: '正在局部编辑当前图片',
  cancelEditing: '取消编辑',
  confirmCloseEditor: '关闭编辑器并放弃当前涂抹吗？',
  editingSourceUnavailable: '无法读取这张图片，请重新生成或选择其他图片。',
  editModeNeedsSource: '请先在某张图片结果上点击编辑图片。',
  promptPlaceholderMaskEdit: '描述你想如何修改涂抹区域',
  editWorkspaceHelp: '用画笔标记要编辑的区域。按住 Space 或拖拽图片外区域可平移。',
  brushTool: '画笔',
  eraserTool: '橡皮擦',
  brushSize: '画笔 {size}px',
  clearMask: '清空涂抹',
  maskEditHint: '请先在图片结果卡片上点击编辑图片，然后涂抹需要修改的区域。',
  maskEditActive: '局部编辑中',
  maskRequired: '请先涂抹需要修改的区域。',
  editPromptRequired: '请输入编辑描述。',
  maskTooLarge: '遮罩图片超过 4MB，请减少图片尺寸或涂抹范围。',
  maskSizeMismatch: '遮罩尺寸必须与源图尺寸一致。',
  maskPngRequired: '遮罩必须导出为 PNG 图片。',
  maskAlphaInvalid: '遮罩透明度校验失败，请重新涂抹后再试。',
  sourceImageSizeMissing: '无法读取源图真实尺寸。',
  sourceImageNormalizeFailed: '提交编辑前无法规范化源图。',
  normalizedSourceImageTooLarge: '规范化后的源图 PNG 超过 50MB，请使用较小尺寸图片编辑。',
  maskExportFailed: '无法导出遮罩，请重新涂抹后再试。',
  sourceImageSize: '源图',
  maskImageSize: '遮罩',
  saveSettings: '保存设置',
  cancel: '取消',
  close: '关闭',
  testConnection: '测试连接',
  testingConnection: '测试中...',
  connectionTestResult: '连接测试结果',
  connectionEndpoint: 'endpoint',
  connectionModel: '模型',
  connectionSize: '尺寸',
  connectionHasUrl: '包含 url',
  connectionHasB64Json: '包含 b64Json',
  connectionCode: 'code',
  connectionHttpStatus: 'HTTP 状态',
  connectionUpstreamCode: '上游 code',
  connectionUpstreamType: '上游类型',
  connectionMessage: '消息',
  connectionRequestSummary: '请求摘要',
  settingsSaved: '设置已保存',
  tasksUsage: '任务列表 / 消费统计',
  usageTitle: '任务列表 / 消费统计',
  usageStatsTotalTasks: '总任务数',
  usageStatsSucceededTasks: '成功任务',
  usageStatsFailedTasks: '失败任务',
  usageStatsRunningTasks: '运行中',
  usageStatsSuccessfulImages: '成功图片',
  usageStatsTotalCost: '总消费',
  usagePriceSettings: '价格设置',
  usageDefaultUnitPrice: '默认单张价格',
  usageCurrentProviderUnitPrice: '当前 API 模板单价',
  usageUnitLabel: '元/张',
  usageSavePrices: '保存价格',
  usagePricesSaved: '价格已保存，新任务将使用新价格。',
  usageInvalidPrice: '单价必须是大于等于 0 的数字。',
  usageFilters: '筛选',
  usageAllApis: '全部 API',
  usageDeletedApis: '已删除模板',
  usageAllStatuses: '全部状态',
  usageAllTypes: '全部类型',
  usageAllTime: '全部时间',
  usageToday: '今天',
  usageLast7Days: '最近 7 天',
  usageLast30Days: '最近 30 天',
  usageStatusQueued: '排队中',
  usageStatusRunning: '生成中',
  usageStatusSucceeded: '成功',
  usageStatusFailed: '失败',
  usageStatusCanceled: '已取消',
  usageTypeTextToImage: '文生图',
  usageTypeImageToImage: '图生图',
  usageTypeImageEdit: '图片编辑',
  usageTableTime: '时间',
  usageTableApi: 'API 模板',
  usageTableType: '类型',
  usageTableStatus: '状态',
  usageTableModel: '模型',
  usageTableSize: '尺寸',
  usageTableImages: '图片数',
  usageTableUnitPrice: '单价',
  usageTableCost: '费用',
  usageTableConversation: '会话/项目',
  usageTableError: '错误摘要',
  usageEmpty: '暂无任务记录',
  usageExportCsv: '导出 CSV',
  usageCsvExported: 'CSV 已导出：{fileName}',
  usageClear: '清空记录',
  usageConfirmClear: '只清空任务统计记录？会话、图片历史、提示词模板和 API 设置不会删除。',
  usageEstimatedCostHint: '预计费用',
  deleteHistory: '删除记录',
  regenerate: '重新生成',
  language: '语言',
  theme: '主题',
  darkTheme: '深色',
  lightTheme: '浅色',
  zh: '中文',
  en: 'English',
  sizeErrors: {
    invalid_size_format: '图片尺寸必须使用 WIDTHxHEIGHT 格式。',
    invalid_size_dimension: '图片宽高必须是正整数。',
    invalid_size_multiple: '图片宽高都必须是 16 的倍数。',
    invalid_size_max_side: '图片宽高任一边不能超过 3840。',
    invalid_size_min_pixels: '图片总像素不能少于 655360。',
    invalid_size_max_pixels: '图片总像素不能超过 8294400。',
    invalid_size_aspect_ratio: '图片长宽比不能超过 3:1。',
    invalid_size_mode: '图片尺寸模式必须是自动或固定。',
    missing_fixed_size: '固定尺寸模式需要指定非 auto 尺寸。',
    unsupported_fixed_size: '固定尺寸必须是支持的预设。'
  }
} as const

const copy = {
  zh: zhCopy,
  en: enCopy
} as const

const composerSizeOptions: readonly ComposerSizeOption[] = [
  { label: { zh: '自动', en: 'Auto' }, value: 'auto' },
  { label: { zh: '1:1 1024x1024', en: '1:1 1024x1024' }, value: '1024x1024' },
  { label: { zh: '16:9 1536x1024', en: '16:9 1536x1024' }, value: '1536x1024' },
  { label: { zh: '9:16 1024x1536', en: '9:16 1024x1536' }, value: '1024x1536' },
  { label: { zh: '1:1 2048x2048', en: '1:1 2048x2048' }, value: '2048x2048' },
  { label: { zh: '16:9 2048x1152', en: '16:9 2048x1152' }, value: '2048x1152' },
  { label: { zh: '9:16 1152x2048', en: '9:16 1152x2048' }, value: '1152x2048' },
  { label: { zh: '4K 横图 3840x2160', en: '4K landscape 3840x2160' }, value: '3840x2160' },
  { label: { zh: '4K 竖图 2160x3840', en: '4K portrait 2160x3840' }, value: '2160x3840' }
]

const composerQualityOptions: readonly ImageToolImage2Quality[] = ['low', 'medium', 'high', 'auto']

const outputFormatOptions: readonly ImageToolImage2OutputFormat[] = ['png', 'jpeg', 'webp']
const responseFormatOptions: readonly ImageToolImage2ResponseFormat[] = ['url', 'b64_json']

const MAX_MASK_IMAGE_BYTES = 4 * 1024 * 1024
const MAX_REFERENCE_IMAGES = 15
const MAX_REFERENCE_IMAGE_TOTAL_BYTES = 50 * 1024 * 1024
const MAX_NORMALIZED_SOURCE_IMAGE_BYTES = 50 * 1024 * 1024
const MAX_COMPOSER_PROMPT_HEIGHT = 160
const COMPOSER_MODEL_PRESET = 'gpt-image-2'
const IMAGE_TASK_MAX_CONCURRENCY = 1
const IMAGE_TASK_CONCURRENCY_RETRY_LIMIT = 2
const IMAGE_TASK_CONCURRENCY_RETRY_DELAY_MS = 5000
const MASK_BRUSH_SIZE_MIN = 8
const MASK_BRUSH_SIZE_MAX = 96
const EDIT_COMPATIBLE_MAX_SIDE = 1536
const EDIT_COMPATIBLE_SQUARE_SIZE = 1024
const IMAGE_SIZE_GRID = 16
const COLLAPSIBLE_TEXT_MAX_LINES = 5
const TEMPLATE_CARD_TAG_LIMIT = 3

const createReferenceImageId = (): string => {
  const crypto = globalThis.crypto

  if (crypto && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `reference_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

const isComposerQuality = (value: string): value is ImageToolImage2Quality => {
  return composerQualityOptions.includes(value as ImageToolImage2Quality)
}

const isComposerOutputFormat = (value: string): value is ImageToolImage2OutputFormat => {
  return outputFormatOptions.includes(value as ImageToolImage2OutputFormat)
}

const templateRecommendedQualityOptions = [
  'auto',
  'low',
  'medium',
  'high'
] as const satisfies readonly ImageToolImage2Quality[]
const templateRecommendedFormatOptions = [
  'png',
  'jpeg',
  'webp'
] as const satisfies readonly ImageToolImage2OutputFormat[]

const getSizeErrorMessage = (error: ImageSizeValidationError, language: Language): string => {
  return copy[language].sizeErrors[error.code as keyof (typeof copy)[Language]['sizeErrors']] ?? error.message
}

const validateComposerSize = (size: string, language: Language): ImageSizeValidationError | undefined => {
  if (size === 'auto') {
    return undefined
  }

  const resolvedSize = resolveImageSize({
    fixedSize: size,
    mode: 'fixed'
  })

  if (resolvedSize.ok) {
    return undefined
  }

  return {
    code: resolvedSize.error.code,
    message: getSizeErrorMessage(resolvedSize.error, language)
  }
}

const getComposerSizeOption = (
  mode: ImageSizeMode,
  fixedSizeValue: ImageSizePreset,
  language: Language,
  text: (typeof copy)[Language]
): string => {
  if (mode === 'auto') {
    return text.sizeAuto
  }

  return composerSizeOptions.find((option) => option.value === fixedSizeValue)?.label[language] ?? fixedSizeValue
}

const getComposerModeLabel = (mode: ComposerMode, text: (typeof copy)[Language]): string => {
  if (mode === 'image_edit') {
    return text.composerModeEdit
  }

  if (mode === 'image_reference') {
    return text.composerModeReference
  }

  return text.composerModeGeneration
}

const getProviderTemplateLabel = (
  template: ImageProviderTemplate,
  text: (typeof copy)[Language]
): Pick<ImageProviderTemplate, 'name' | 'description' | 'notes'> => {
  if (protectedImageProviderTemplateIds.has(template.id)) {
    return {
      name: text.templateCompatibleName,
      description: text.templateCompatibleDescription,
      notes: template.notes
    }
  }

  return {
    name: template.name,
    description: template.description,
    notes: template.notes
  }
}

const MAX_LANDSCAPE_PREVIEW_WIDTH = 420
const MAX_LANDSCAPE_PREVIEW_HEIGHT = 240
const MAX_PORTRAIT_PREVIEW_WIDTH = 220
const MAX_PORTRAIT_PREVIEW_HEIGHT = 340
const MAX_LONG_PREVIEW_WIDTH = 260
const MAX_LONG_PREVIEW_HEIGHT = 320
const MAX_SQUARE_PREVIEW_SIZE = 320
const FALLBACK_PREVIEW_SIZE = {
  width: 1024,
  height: 768
} as const

const createMessageId = (): string => {
  const crypto = globalThis.crypto

  if (crypto && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `message_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

const getConversationTimestamp = (conversation: ImageToolConversation): number => {
  return Date.parse(conversation.lastMessageAt ?? conversation.updatedAt ?? conversation.createdAt)
}

const sortConversationsByUpdatedAt = (conversations: readonly ImageToolConversation[]): ImageToolConversation[] => {
  return [...conversations].sort((firstConversation, secondConversation) => {
    return getConversationTimestamp(secondConversation) - getConversationTimestamp(firstConversation)
  })
}

const formatConversationTime = (value: string | undefined, language: Language): string => {
  if (!value) {
    return ''
  }

  const timestamp = Date.parse(value)

  if (!Number.isFinite(timestamp)) {
    return ''
  }

  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp))
}

const formatFullDateTime = (value: string | undefined, language: Language): string => {
  if (!value) {
    return ''
  }

  const timestamp = Date.parse(value)

  if (!Number.isFinite(timestamp)) {
    return ''
  }

  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp))
}

const formatCurrencyCny = (value: number): string => `¥${Number.isFinite(value) ? value.toFixed(2) : '0.00'}`

const formatUnitPrice = (value: number): string =>
  `¥${Number.isFinite(value) ? value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '') : '0'}`

const normalizeUnitPriceInput = (value: string): number | undefined => {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return undefined
  }

  const unitPrice = Number(trimmedValue)

  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    return undefined
  }

  return Math.round(unitPrice * 10000) / 10000
}

const getUsageDateRange = (
  timeRange: UsageTimeRangeFilter
): Pick<ImageToolTaskRecordFilters, 'createdAtFrom' | 'createdAtTo'> => {
  if (timeRange === 'all') {
    return {}
  }

  const now = new Date()
  const start = new Date(now)

  if (timeRange === 'today') {
    start.setHours(0, 0, 0, 0)
  } else {
    const days = timeRange === '7d' ? 7 : 30
    start.setDate(start.getDate() - days + 1)
    start.setHours(0, 0, 0, 0)
  }

  return {
    createdAtFrom: start.toISOString(),
    createdAtTo: now.toISOString()
  }
}

const createUsageRecordFilters = (
  filters: UsageFilters,
  templates: readonly ImageProviderTemplate[]
): ImageToolTaskRecordFilters => {
  const dateRange = getUsageDateRange(filters.timeRange)
  const providerTemplateIds = templates.map((template) => template.id)

  return {
    ...dateRange,
    ...(filters.providerTemplateId === 'deleted'
      ? {
          deletedProviderTemplatesOnly: true,
          existingProviderTemplateIds: providerTemplateIds
        }
      : filters.providerTemplateId === 'all'
        ? {}
        : { providerTemplateId: filters.providerTemplateId }),
    ...(filters.status === 'all' ? {} : { status: filters.status }),
    ...(filters.taskType === 'all' ? {} : { taskType: filters.taskType })
  }
}

const getUsageTaskTypeLabel = (taskType: ImageToolTaskRecord['taskType'], text: (typeof copy)[Language]): string => {
  if (taskType === 'image_edit') {
    return text.usageTypeImageEdit
  }

  if (taskType === 'image_to_image') {
    return text.usageTypeImageToImage
  }

  return text.usageTypeTextToImage
}

const getUsageStatusLabel = (status: ImageToolTaskRecord['status'], text: (typeof copy)[Language]): string => {
  if (status === 'queued') {
    return text.usageStatusQueued
  }

  if (status === 'running') {
    return text.usageStatusRunning
  }

  if (status === 'succeeded') {
    return text.usageStatusSucceeded
  }

  if (status === 'failed') {
    return text.usageStatusFailed
  }

  return text.usageStatusCanceled
}

const getConversationDisplayTitle = (conversation: ImageToolConversation, text: (typeof copy)[Language]): string => {
  return conversation.title === '新聊天' ? text.newChat : conversation.title
}

const formatProjectConversationCount = (count: number, text: (typeof copy)[Language]): string => {
  return text.projectConversationCount.replace('{count}', String(count))
}

const createUniqueProjectName = (projects: readonly ImageToolProjectGroup[], baseName: string): string => {
  const projectNames = new Set(projects.map((project) => project.name))

  if (!projectNames.has(baseName)) {
    return baseName
  }

  let suffix = 2

  while (projectNames.has(`${baseName} ${suffix}`)) {
    suffix += 1
  }

  return `${baseName} ${suffix}`
}

type ImageMimeType = 'image/png' | 'image/jpeg' | 'image/webp'

type DetectedImageType = 'jpeg' | 'png' | 'webp' | 'unknown'

type ImageSignature = {
  detectedType: DetectedImageType
  hexPrefix?: string
  valid: boolean
}

type ImagePreviewError =
  | 'invalid_image_payload'
  | 'invalid_history_image_payload'
  | 'missing_image_payload'
  | 'invalid_preview_source'
  | 'blob_url_failed'

type ImagePreviewSourceType = 'data-url' | 'b64' | 'url' | 'missing'

type ImagePreviewSource = {
  source?: string
  sourceType: ImagePreviewSourceType
  urlHost?: string
  requestedMimeType: ImageMimeType
  mimeType: ImageMimeType
  detectedType: DetectedImageType
  hexPrefix?: string
  srcPrefix: string
  srcLength: number
  previewError?: ImagePreviewError
  mismatch: boolean
}

type PreviewObjectUrlResult =
  | {
      ok: true
      src: string
      srcType: 'blob-url' | 'remote-url'
      revoke?: () => void
      mimeType?: string
      blobSize?: number
    }
  | {
      ok: false
      error: string
      mimeType?: string
      blobSize?: number
    }

const transparentPngDataUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='

const getImageMimeType = (outputFormat?: string): ImageMimeType => {
  if (outputFormat === 'jpeg' || outputFormat === 'jpg') {
    return 'image/jpeg'
  }

  if (outputFormat === 'webp') {
    return 'image/webp'
  }

  return 'image/png'
}

const isSupportedImageMimeType = (mimeType: string): mimeType is ImageMimeType => {
  return mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp'
}

const getMimeTypeFromDetectedType = (detectedType: DetectedImageType, fallback: ImageMimeType): ImageMimeType => {
  if (detectedType === 'jpeg') {
    return 'image/jpeg'
  }

  if (detectedType === 'png') {
    return 'image/png'
  }

  if (detectedType === 'webp') {
    return 'image/webp'
  }

  return fallback
}

const getExpectedTypeFromOutputFormat = (outputFormat?: string): DetectedImageType => {
  if (outputFormat === 'jpeg' || outputFormat === 'jpg') {
    return 'jpeg'
  }

  if (outputFormat === 'webp') {
    return 'webp'
  }

  if (outputFormat === 'png') {
    return 'png'
  }

  return 'unknown'
}

const isDataImageBase64Url = (value: string): boolean => {
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(value.trim())
}

const getBase64Payload = (dataUrlOrBase64: string): string | undefined => {
  const trimmedValue = dataUrlOrBase64.trim()

  if (isDataImageBase64Url(trimmedValue)) {
    const payloadStart = trimmedValue.indexOf(',')

    return payloadStart >= 0 ? trimmedValue.slice(payloadStart + 1) : undefined
  }

  return trimmedValue
}

const getMimeTypeFromDataUrl = (dataUrl: string): ImageMimeType | undefined => {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,/i.exec(dataUrl.trim())
  const mimeType = match?.[1]?.toLowerCase()

  return mimeType && isSupportedImageMimeType(mimeType) ? mimeType : undefined
}

const getHexPrefixFromText = (value: string): string => {
  return Array.from(value.slice(0, 12))
    .map((character) => character.charCodeAt(0).toString(16).padStart(2, '0'))
    .join(' ')
}

const getBase64ImageSignature = (dataUrlOrBase64: string | undefined): ImageSignature => {
  if (!dataUrlOrBase64 || dataUrlOrBase64.trim().length === 0) {
    return {
      detectedType: 'unknown',
      valid: false
    }
  }

  const payload = getBase64Payload(dataUrlOrBase64)

  if (!payload) {
    return {
      detectedType: 'unknown',
      hexPrefix: getHexPrefixFromText(dataUrlOrBase64),
      valid: false
    }
  }

  const payloadPrefix = payload.slice(0, 64).replace(/\s/g, '')

  if (!/^[A-Za-z0-9+/_=-]+$/.test(payloadPrefix)) {
    return {
      detectedType: 'unknown',
      hexPrefix: getHexPrefixFromText(payload),
      valid: false
    }
  }

  try {
    const normalizedPayload = payloadPrefix.replace(/-/g, '+').replace(/_/g, '/')
    const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '=')
    const decodedPrefix = atob(paddedPayload)
    const bytes = Array.from(decodedPrefix.slice(0, 16), (character) => character.charCodeAt(0))
    const hexPrefix = bytes
      .slice(0, 12)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join(' ')
    const detectedType: DetectedImageType =
      bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        ? 'jpeg'
        : bytes[0] === 0x89 &&
            bytes[1] === 0x50 &&
            bytes[2] === 0x4e &&
            bytes[3] === 0x47 &&
            bytes[4] === 0x0d &&
            bytes[5] === 0x0a &&
            bytes[6] === 0x1a &&
            bytes[7] === 0x0a
          ? 'png'
          : bytes[0] === 0x52 &&
              bytes[1] === 0x49 &&
              bytes[2] === 0x46 &&
              bytes[3] === 0x46 &&
              bytes[8] === 0x57 &&
              bytes[9] === 0x45 &&
              bytes[10] === 0x42 &&
              bytes[11] === 0x50
            ? 'webp'
            : 'unknown'

    return {
      detectedType,
      hexPrefix,
      valid: detectedType !== 'unknown'
    }
  } catch {
    return {
      detectedType: 'unknown',
      hexPrefix: getHexPrefixFromText(payload),
      valid: false
    }
  }
}

const isHttpUrl = (value: string | undefined): value is string => {
  return Boolean(value && /^https?:\/\//i.test(value.trim()))
}

const getUrlHost = (value: string | undefined): string | undefined => {
  if (!isHttpUrl(value)) {
    return undefined
  }

  try {
    return new URL(value).host
  } catch {
    return undefined
  }
}

const normalizeBase64Payload = (value: string): string => {
  const payload = getBase64Payload(value)?.replace(/\s/g, '') ?? ''
  const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/')

  return normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '=')
}

const base64PayloadToBlob = (
  payload: string,
  mimeType: ImageMimeType
): { ok: true; blob: Blob; mimeType: ImageMimeType; blobSize: number } | { ok: false; error: string } => {
  try {
    const normalizedPayload = normalizeBase64Payload(payload)
    const decodedValue = atob(normalizedPayload)
    const bytes = new Uint8Array(decodedValue.length)

    for (let index = 0; index < decodedValue.length; index += 1) {
      bytes[index] = decodedValue.charCodeAt(index)
    }

    const blob = new Blob([bytes], { type: mimeType })

    return {
      ok: true,
      blob,
      mimeType,
      blobSize: blob.size
    }
  } catch {
    return {
      ok: false,
      error: 'invalid_preview_source'
    }
  }
}

const dataUrlToBlob = (
  dataUrl: string
): { ok: true; blob: Blob; mimeType: ImageMimeType; blobSize: number } | { ok: false; error: string } => {
  const trimmedValue = dataUrl.trim()
  const mimeType = getMimeTypeFromDataUrl(trimmedValue)
  const payload = getBase64Payload(trimmedValue)

  if (!mimeType || !payload) {
    return {
      ok: false,
      error: 'invalid_preview_source'
    }
  }

  return base64PayloadToBlob(payload, mimeType)
}

const createPreviewObjectUrl = ({
  mimeType,
  source,
  sourceType
}: {
  mimeType?: ImageMimeType
  source?: string
  sourceType: ImagePreviewSourceType
}): PreviewObjectUrlResult => {
  if (!source || sourceType === 'missing') {
    return {
      ok: false,
      error: 'missing_image_payload'
    }
  }

  if (sourceType === 'url') {
    if (!isHttpUrl(source)) {
      return {
        ok: false,
        error: 'invalid_preview_source'
      }
    }

    return {
      ok: true,
      src: source.trim(),
      srcType: 'remote-url',
      mimeType
    }
  }

  const blobResult =
    sourceType === 'data-url'
      ? dataUrlToBlob(source)
      : base64PayloadToBlob(source, mimeType && isSupportedImageMimeType(mimeType) ? mimeType : 'image/png')

  if (!blobResult.ok) {
    return blobResult
  }

  try {
    const objectUrl = URL.createObjectURL(blobResult.blob)

    return {
      ok: true,
      src: objectUrl,
      srcType: 'blob-url',
      revoke: () => URL.revokeObjectURL(objectUrl),
      mimeType: blobResult.mimeType,
      blobSize: blobResult.blobSize
    }
  } catch {
    return {
      ok: false,
      error: 'blob_url_failed',
      mimeType: blobResult.mimeType,
      blobSize: blobResult.blobSize
    }
  }
}

const testImageLoad = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('image_load_error'))
    image.src = src

    if (typeof image.decode === 'function') {
      void image
        .decode()
        .then(resolve)
        .catch(() => undefined)
    }
  })
}

const runPreviewSelfTest = async (): Promise<PreviewSelfTestResult> => {
  let dataUrlLoad: PreviewSelfTestResult['dataUrlLoad'] = 'pending'
  let blobUrlLoad: PreviewSelfTestResult['blobUrlLoad'] = 'pending'
  let blobUrlPrefix: string | undefined
  let errorMessage: string | undefined
  let createdObjectUrl: PreviewObjectUrlResult | undefined

  try {
    await testImageLoad(transparentPngDataUrl)
    dataUrlLoad = 'success'
  } catch (error) {
    dataUrlLoad = 'failed'
    errorMessage = error instanceof Error ? error.message : 'data_url_load_failed'
  }

  try {
    createdObjectUrl = createPreviewObjectUrl({
      source: transparentPngDataUrl,
      sourceType: 'data-url',
      mimeType: 'image/png'
    })

    if (!createdObjectUrl.ok) {
      throw new Error(createdObjectUrl.error)
    }

    blobUrlPrefix = createdObjectUrl.src.slice(0, 64)
    await testImageLoad(createdObjectUrl.src)
    blobUrlLoad = 'success'
  } catch (error) {
    blobUrlLoad = 'failed'
    errorMessage = error instanceof Error ? error.message : (errorMessage ?? 'blob_url_load_failed')
  } finally {
    if (createdObjectUrl?.ok) {
      createdObjectUrl.revoke?.()
    }
  }

  const cspHint =
    dataUrlLoad === 'success' && blobUrlLoad === 'failed'
      ? 'blob: may be blocked by CSP img-src'
      : dataUrlLoad === 'failed' && blobUrlLoad === 'failed'
        ? 'data: and blob: may be blocked by CSP img-src'
        : 'img-src allows self-test image sources'

  return {
    dataUrlLoad,
    blobUrlLoad,
    blobUrlPrefix,
    errorMessage,
    cspHint
  }
}

const createImagePreviewFromBase64 = (
  value: string,
  outputFormat: string | undefined,
  previewError: ImagePreviewSource['previewError']
): ImagePreviewSource => {
  const requestedMimeType = getImageMimeType(outputFormat)
  const signature = getBase64ImageSignature(value)
  const expectedType = getExpectedTypeFromOutputFormat(outputFormat)
  const payload = getBase64Payload(value)?.replace(/\s/g, '')
  const mimeType = getMimeTypeFromDetectedType(signature.detectedType, requestedMimeType)
  const mismatch = signature.valid && expectedType !== 'unknown' && expectedType !== signature.detectedType
  const dataUrlMimeType = getMimeTypeFromDataUrl(value)
  const sourceType: ImagePreviewSourceType =
    signature.valid && payload ? (dataUrlMimeType ? 'data-url' : 'b64') : 'missing'
  const source = sourceType === 'data-url' ? `data:${mimeType};base64,${payload}` : payload

  return {
    source: sourceType === 'missing' ? undefined : source,
    sourceType,
    requestedMimeType,
    mimeType,
    detectedType: signature.detectedType,
    hexPrefix: signature.hexPrefix,
    srcPrefix:
      sourceType === 'data-url' ? (source?.split(',')[0] ?? 'data:image') : sourceType === 'b64' ? 'base64' : 'missing',
    srcLength: source?.length ?? 0,
    previewError: sourceType === 'missing' ? previewError : undefined,
    mismatch
  }
}

const createMissingImagePreview = (outputFormat: string | undefined): ImagePreviewSource => {
  const requestedMimeType = getImageMimeType(outputFormat)

  return {
    sourceType: 'missing',
    requestedMimeType,
    mimeType: requestedMimeType,
    detectedType: 'unknown',
    srcPrefix: 'missing',
    srcLength: 0,
    previewError: 'missing_image_payload',
    mismatch: false
  }
}

const getImagePreviewSource = (
  image: { b64Json?: string; url?: string; previewDataUrl?: string } | undefined,
  outputFormat: string | undefined,
  imageDataUrl?: string
): ImagePreviewSource => {
  const requestedMimeType = getImageMimeType(outputFormat)

  if (image?.previewDataUrl) {
    return createImagePreviewFromBase64(image.previewDataUrl, outputFormat, 'invalid_image_payload')
  }

  if (image?.b64Json) {
    if (isHttpUrl(image.b64Json)) {
      const src = image.b64Json.trim()

      return {
        source: src,
        sourceType: 'url',
        urlHost: getUrlHost(src),
        requestedMimeType,
        mimeType: requestedMimeType,
        detectedType: 'unknown',
        srcPrefix: src.slice(0, 64),
        srcLength: src.length,
        mismatch: false
      }
    }

    return createImagePreviewFromBase64(image.b64Json, outputFormat, 'invalid_image_payload')
  }

  if (imageDataUrl) {
    return createImagePreviewFromBase64(imageDataUrl, outputFormat, 'invalid_history_image_payload')
  }

  if (isHttpUrl(image?.url)) {
    const src = image.url.trim()

    return {
      source: src,
      sourceType: 'url',
      urlHost: getUrlHost(src),
      requestedMimeType,
      mimeType: requestedMimeType,
      detectedType: 'unknown',
      srcPrefix: src.slice(0, 64),
      srcLength: src.length,
      mismatch: false
    }
  }

  if (image?.url && isDataImageBase64Url(image.url)) {
    return createImagePreviewFromBase64(image.url, outputFormat, 'invalid_image_payload')
  }

  return createMissingImagePreview(outputFormat)
}

const getImageDownloadHref = (previewSource: ImagePreviewSource): string | undefined => {
  if (!previewSource.source) {
    return undefined
  }

  if (previewSource.sourceType === 'url' || previewSource.sourceType === 'data-url') {
    return previewSource.source
  }

  if (previewSource.sourceType === 'b64') {
    return `data:${previewSource.mimeType};base64,${previewSource.source}`
  }

  return undefined
}

const getImageEditingDataUrl = (previewSource: ImagePreviewSource): string | undefined => {
  if (!previewSource.source) {
    return undefined
  }

  if (previewSource.sourceType === 'data-url') {
    return previewSource.source
  }

  if (previewSource.sourceType === 'b64') {
    return `data:${previewSource.mimeType};base64,${previewSource.source}`
  }

  return undefined
}

const getImagePreviewMimeType = (previewSource: ImagePreviewSource): ImageMimeType => {
  return getMimeTypeFromDetectedType(previewSource.detectedType, previewSource.mimeType)
}

const formatImageMetadata = (params: ConversationParams, text: (typeof copy)[Language]): string => {
  const modeLabel = params.mode ? getComposerModeLabel(params.mode, text) : undefined
  const displaySize = params.size === 'auto' ? params.size : params.size.replace(/x/i, '×')

  return [modeLabel, params.model, displaySize, params.quality, params.outputFormat].filter(Boolean).join(' · ')
}

const getImageEditingFileName = (
  message: ConversationMessage,
  params: ConversationParams | undefined,
  mimeType: ImageMimeType
): string => {
  if (message.imageFileName) {
    return message.imageFileName
  }

  if (params) {
    return buildDownloadName(
      {
        ...params,
        outputFormat: mimeType === 'image/jpeg' ? 'jpeg' : mimeType === 'image/webp' ? 'webp' : 'png'
      },
      message.createdAt,
      message.taskId ?? message.historyId
    )
  }

  return `image-tool-source-${message.historyId ?? message.id}.${mimeType.split('/')[1]}`
}

const createReferenceImageFromEditingSource = (source: EditingSourceImage): ReferenceImageDraft => {
  const blobResult = dataUrlToBlob(source.dataUrl)
  const mimeType = source.mimeType ?? getMimeTypeFromDataUrl(source.dataUrl) ?? 'image/png'

  return {
    id: source.historyId ? `edit-source-${source.historyId}` : createReferenceImageId(),
    name: source.fileName ?? 'source-image.png',
    dataUrl: source.dataUrl,
    mimeType,
    fileType: mimeType,
    size: blobResult.ok ? blobResult.blobSize : (getBase64Payload(source.dataUrl)?.length ?? source.dataUrl.length),
    ...((source.naturalWidth ?? source.width) ? { width: source.naturalWidth ?? source.width } : {}),
    ...((source.naturalHeight ?? source.height) ? { height: source.naturalHeight ?? source.height } : {})
  }
}

const createMaskReferenceImage = (mask: MaskEditExport): ReferenceImageDraft => ({
  id: `mask_${Date.now().toString(36)}`,
  name: 'mask.png',
  dataUrl: mask.dataUrl,
  mimeType: mask.mimeType,
  fileType: mask.mimeType,
  size: mask.blobSize,
  width: mask.width,
  height: mask.height
})

const roundToImageGrid = (value: number): number => {
  return Math.max(IMAGE_SIZE_GRID, Math.round(value / IMAGE_SIZE_GRID) * IMAGE_SIZE_GRID)
}

const getCompatibleEditTargetSize = (width: number, height: number): Required<PreviewSize> => {
  const aspectRatio = width / height

  if (Math.abs(aspectRatio - 1) <= 0.04) {
    return {
      width: EDIT_COMPATIBLE_SQUARE_SIZE,
      height: EDIT_COMPATIBLE_SQUARE_SIZE
    }
  }

  if (width > height) {
    const targetWidth = Math.min(width, EDIT_COMPATIBLE_MAX_SIDE)
    return {
      width: roundToImageGrid(targetWidth),
      height: roundToImageGrid(targetWidth / aspectRatio)
    }
  }

  const targetHeight = Math.min(height, EDIT_COMPATIBLE_MAX_SIDE)
  return {
    width: roundToImageGrid(targetHeight * aspectRatio),
    height: roundToImageGrid(targetHeight)
  }
}

const createPngReferenceImageFromCanvas = async ({
  canvas,
  fallbackName,
  idPrefix
}: {
  canvas: HTMLCanvasElement
  fallbackName: string
  idPrefix: string
}): Promise<ReferenceImageDraft> => {
  const blob = await canvasToPngBlob(canvas)

  return {
    id: `${idPrefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: fallbackName,
    dataUrl: await blobToDataUrl(blob),
    mimeType: 'image/png',
    fileType: 'image/png',
    size: blob.size,
    width: canvas.width,
    height: canvas.height
  }
}

const createSubmittedSourceReferenceImage = async (
  source: EditingSourceImage,
  targetSize: Required<PreviewSize>
): Promise<ReferenceImageDraft> => {
  const imageElement = await loadImageElement(source.dataUrl)
  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = targetSize.width
  sourceCanvas.height = targetSize.height
  const sourceContext = sourceCanvas.getContext('2d')

  if (!sourceContext) {
    throw new Error('source_image_normalize_failed')
  }

  sourceContext.drawImage(imageElement, 0, 0, targetSize.width, targetSize.height)
  const sourceReferenceImage = await createPngReferenceImageFromCanvas({
    canvas: sourceCanvas,
    fallbackName: 'normalized-source.png',
    idPrefix: source.historyId ? `normalized-edit-source-${source.historyId}` : createReferenceImageId()
  })

  if (sourceReferenceImage.size > MAX_NORMALIZED_SOURCE_IMAGE_BYTES) {
    throw new Error('normalized_source_image_too_large')
  }

  return sourceReferenceImage
}

const createSubmittedMaskReferenceImage = async ({
  mask,
  maskColorMode,
  maskSemantic,
  targetSize
}: {
  mask: MaskEditExport
  maskColorMode: ImageToolEditMaskColorMode
  maskSemantic: ImageToolEditMaskSemantic
  targetSize: Required<PreviewSize>
}): Promise<ReferenceImageDraft> => {
  if (
    mask.width === targetSize.width &&
    mask.height === targetSize.height &&
    maskSemantic === 'transparent-edit' &&
    maskColorMode === 'white'
  ) {
    return createMaskReferenceImage(mask)
  }

  const maskElement = await loadImageElement(mask.dataUrl)
  const scaledCanvas = document.createElement('canvas')
  scaledCanvas.width = targetSize.width
  scaledCanvas.height = targetSize.height
  const scaledContext = scaledCanvas.getContext('2d')

  if (!scaledContext) {
    throw new Error('mask_export_failed')
  }

  scaledContext.imageSmoothingEnabled = true
  scaledContext.drawImage(maskElement, 0, 0, targetSize.width, targetSize.height)

  const imageData = scaledContext.getImageData(0, 0, targetSize.width, targetSize.height)
  const pixels = imageData.data

  for (let index = 0; index < pixels.length; index += 4) {
    const isPainted = pixels[index + 3] < 128
    const alpha = maskSemantic === 'transparent-edit' ? (isPainted ? 0 : 255) : isPainted ? 255 : 0
    const rgb = maskColorMode === 'black' || (maskColorMode === 'transparent-black' && isPainted) ? 0 : 255

    pixels[index] = rgb
    pixels[index + 1] = rgb
    pixels[index + 2] = rgb
    pixels[index + 3] = alpha
  }

  scaledContext.putImageData(imageData, 0, 0)

  return createPngReferenceImageFromCanvas({
    canvas: scaledCanvas,
    fallbackName: 'mask.png',
    idPrefix: 'mask'
  })
}

const loadImageElement = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('image_load_error'))
    image.src = src
  })
}

const normalizeEditingSourceImage = async (source: EditingSourceImage): Promise<EditingSourceImage> => {
  const imageElement = await loadImageElement(source.dataUrl)

  return {
    ...source,
    naturalWidth: imageElement.naturalWidth,
    naturalHeight: imageElement.naturalHeight,
    width: imageElement.naturalWidth,
    height: imageElement.naturalHeight
  }
}

const canvasToPngBlob = (canvas: HTMLCanvasElement): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
        return
      }

      reject(new Error('mask_export_failed'))
    }, 'image/png')
  })
}

const blobToDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onerror = () => reject(reader.error ?? new Error('blob_read_failed'))
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.readAsDataURL(blob)
  })
}

const createReferenceImageFromFile = async (file: File): Promise<ReferenceImageDraft> => {
  const dataUrl = await blobToDataUrl(file)
  const mimeType = isSupportedImageMimeType(file.type) ? file.type : (getMimeTypeFromDataUrl(dataUrl) ?? 'image/png')

  let dimensions: PreviewSize = {}

  try {
    const imageElement = await loadImageElement(dataUrl)
    dimensions = {
      width: imageElement.naturalWidth,
      height: imageElement.naturalHeight
    }
  } catch {
    dimensions = {}
  }

  return {
    id: createReferenceImageId(),
    name: file.name || `reference-${Date.now().toString(36)}.${mimeType.split('/')[1]}`,
    dataUrl,
    mimeType,
    fileType: mimeType,
    size: file.size,
    ...(dimensions.width ? { width: dimensions.width } : {}),
    ...(dimensions.height ? { height: dimensions.height } : {})
  }
}

const createNormalizedSourceReferenceImage = async (source: EditingSourceImage): Promise<ReferenceImageDraft> => {
  const sourceWidth = Math.round(source.naturalWidth ?? source.width ?? 0)
  const sourceHeight = Math.round(source.naturalHeight ?? source.height ?? 0)

  if (!sourceWidth || !sourceHeight) {
    throw new Error('source_image_size_missing')
  }

  const imageElement = await loadImageElement(source.dataUrl)
  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = sourceWidth
  sourceCanvas.height = sourceHeight
  const sourceContext = sourceCanvas.getContext('2d')

  if (!sourceContext) {
    throw new Error('source_image_normalize_failed')
  }

  sourceContext.drawImage(imageElement, 0, 0, sourceWidth, sourceHeight)
  const blob = await canvasToPngBlob(sourceCanvas)

  if (blob.size > MAX_NORMALIZED_SOURCE_IMAGE_BYTES) {
    throw new Error('normalized_source_image_too_large')
  }

  return {
    id: source.historyId ? `normalized-edit-source-${source.historyId}` : createReferenceImageId(),
    name: 'normalized-source.png',
    dataUrl: await blobToDataUrl(blob),
    mimeType: 'image/png',
    fileType: 'image/png',
    size: blob.size,
    width: sourceWidth,
    height: sourceHeight
  }
}

const prepareEditAssets = async ({
  editSubmitMode,
  mask,
  source
}: {
  editSubmitMode: ImageToolEditSubmitMode
  mask: MaskEditExport
  source: EditingSourceImage
}): Promise<PreparedEditAssets> => {
  const originalImageWidth = Math.round(source.naturalWidth ?? source.width ?? 0)
  const originalImageHeight = Math.round(source.naturalHeight ?? source.height ?? 0)

  if (!originalImageWidth || !originalImageHeight) {
    throw new Error('source_image_size_missing')
  }

  const submittedSize =
    editSubmitMode === 'compatible'
      ? getCompatibleEditTargetSize(originalImageWidth, originalImageHeight)
      : {
          width: originalImageWidth,
          height: originalImageHeight
        }
  const maskSemantic: ImageToolEditMaskSemantic = 'transparent-edit'
  const maskColorMode: ImageToolEditMaskColorMode = 'white'
  const sourceReferenceImage =
    editSubmitMode === 'compatible'
      ? await createSubmittedSourceReferenceImage(source, submittedSize)
      : await createNormalizedSourceReferenceImage(source)
  const maskReferenceImage = await createSubmittedMaskReferenceImage({
    mask,
    maskColorMode,
    maskSemantic,
    targetSize: submittedSize
  })

  return {
    sourceReferenceImage,
    maskReferenceImage,
    requestSize: editSubmitMode === 'compatible' ? 'auto' : `${submittedSize.width}x${submittedSize.height}`,
    metadata: {
      editSubmitMode,
      maskSemantic,
      maskColorMode,
      originalImageWidth,
      originalImageHeight,
      submittedImageWidth: sourceReferenceImage.width,
      submittedImageHeight: sourceReferenceImage.height,
      submittedMaskWidth: maskReferenceImage.width,
      submittedMaskHeight: maskReferenceImage.height
    }
  }
}

const parseRequestedSize = (size: string | undefined): PreviewSize | undefined => {
  if (!size || size === 'auto') {
    return undefined
  }

  const match = /^(\d+)x(\d+)$/i.exec(size.trim())

  if (!match) {
    return undefined
  }

  const width = Number(match[1])
  const height = Number(match[2])

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined
  }

  return { width, height }
}

const getPreviewDimensions = ({
  naturalHeight,
  naturalWidth,
  requestedSize
}: {
  naturalHeight?: number
  naturalWidth?: number
  requestedSize?: string
}): Required<PreviewSize> => {
  if (naturalWidth && naturalHeight && naturalWidth > 0 && naturalHeight > 0) {
    return {
      width: naturalWidth,
      height: naturalHeight
    }
  }

  const requestedDimensions = parseRequestedSize(requestedSize)

  if (requestedDimensions?.width && requestedDimensions.height) {
    return {
      width: requestedDimensions.width,
      height: requestedDimensions.height
    }
  }

  return { ...FALLBACK_PREVIEW_SIZE }
}

const getPreviewOrientation = (aspectRatio: number): ImagePreviewOrientation => {
  if (Math.abs(aspectRatio - 1) <= 0.04) {
    return 'square'
  }

  if (aspectRatio < 0.48) {
    return 'long'
  }

  return aspectRatio > 1 ? 'landscape' : 'portrait'
}

const getImagePreviewLayout = ({
  naturalHeight,
  naturalWidth,
  requestedSize
}: {
  naturalHeight?: number
  naturalWidth?: number
  requestedSize?: string
}): ImagePreviewLayout => {
  const dimensions = getPreviewDimensions({
    naturalHeight,
    naturalWidth,
    requestedSize
  })
  const aspectRatio = dimensions.width / dimensions.height
  const orientation = getPreviewOrientation(aspectRatio)

  if (orientation === 'long') {
    return {
      aspectRatioValue: `${dimensions.width} / ${dimensions.height}`,
      maxHeight: MAX_LONG_PREVIEW_HEIGHT,
      maxWidth: MAX_LONG_PREVIEW_WIDTH,
      orientation,
      width: Math.min(MAX_LONG_PREVIEW_WIDTH, dimensions.width)
    }
  }

  if (orientation === 'portrait') {
    const height = Math.min(MAX_PORTRAIT_PREVIEW_HEIGHT, dimensions.height)
    const width = Math.min(MAX_PORTRAIT_PREVIEW_WIDTH, dimensions.width, Math.max(1, Math.round(height * aspectRatio)))

    return {
      aspectRatioValue: `${dimensions.width} / ${dimensions.height}`,
      maxHeight: MAX_PORTRAIT_PREVIEW_HEIGHT,
      maxWidth: MAX_PORTRAIT_PREVIEW_WIDTH,
      orientation,
      width
    }
  }

  if (orientation === 'square') {
    const width = Math.min(MAX_SQUARE_PREVIEW_SIZE, dimensions.width)

    return {
      aspectRatioValue: `${dimensions.width} / ${dimensions.height}`,
      maxHeight: MAX_SQUARE_PREVIEW_SIZE,
      maxWidth: MAX_SQUARE_PREVIEW_SIZE,
      orientation,
      width
    }
  }

  return {
    aspectRatioValue: `${dimensions.width} / ${dimensions.height}`,
    maxHeight: MAX_LANDSCAPE_PREVIEW_HEIGHT,
    maxWidth: MAX_LANDSCAPE_PREVIEW_WIDTH,
    orientation,
    width: Math.min(
      MAX_LANDSCAPE_PREVIEW_WIDTH,
      dimensions.width,
      Math.max(1, Math.round(MAX_LANDSCAPE_PREVIEW_HEIGHT * aspectRatio))
    )
  }
}

const getApiStatus = ({
  apiKey,
  baseUrl,
  hasBridge,
  model,
  messages
}: {
  apiKey: string
  baseUrl: string
  hasBridge: boolean
  model: string
  messages: ConversationMessage[]
}): ApiStatus => {
  if (!hasBridge) {
    return 'unavailable'
  }

  if (!baseUrl.trim() || !model.trim() || !apiKey.trim()) {
    return 'not-configured'
  }

  const latestGenerationResult = [...messages]
    .reverse()
    .find((message) => message.kind === 'image_result' || message.kind === 'error')

  if (latestGenerationResult?.kind === 'image_result') {
    return 'available'
  }

  if (latestGenerationResult?.kind === 'error') {
    return 'error'
  }

  return 'configured'
}

const getApiStatusLabel = (status: ApiStatus, text: (typeof copy)[Language]): string => {
  if (status === 'available') {
    return text.apiAvailable
  }

  if (status === 'configured') {
    return text.apiConfigured
  }

  if (status === 'not-configured') {
    return text.apiNotConfigured
  }

  if (status === 'error') {
    return text.apiError
  }

  return text.apiUnavailable
}

const toErrorMessage = (code: string | undefined, message: string, relatedMessageId?: string): ConversationMessage => {
  return {
    id: createMessageId(),
    role: 'assistant',
    kind: 'error',
    createdAt: Date.now(),
    error: {
      code,
      message
    },
    relatedMessageId
  }
}

const toValidationErrorMessage = (
  error: ImageSizeValidationError | { code?: string; message: string },
  language: Language
): ConversationMessage => {
  const code = error.code ?? 'validation_error'
  const translatedSizeError =
    code in copy[language].sizeErrors
      ? copy[language].sizeErrors[code as keyof (typeof copy)[Language]['sizeErrors']]
      : undefined

  return toErrorMessage(code, translatedSizeError ?? error.message)
}

const sanitizeDownloadNamePart = (value: string | undefined): string => {
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

const normalizeEndpointPath = (endpointPath: string): string => {
  const normalizedPath = endpointPath.trim() || '/v1/images/generations'
  return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`
}

const normalizeEditEndpointPath = (endpointPath: string): string => {
  const normalizedPath = endpointPath.trim() || '/v1/images/edits'
  return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`
}

const createRequestEndpoint = (baseUrl: string, endpointPath: string): string => {
  const trimmedBaseUrl = baseUrl.trim().replace(/\/+$/, '')
  const normalizedEndpointPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`
  return trimmedBaseUrl ? `${trimmedBaseUrl}${normalizedEndpointPath}` : normalizedEndpointPath
}

const getProviderCredentialApiKey = (
  providerCredentials: ImageToolPersistedSettings['providerCredentials'],
  providerTemplateId: string
): string => providerCredentials[providerTemplateId]?.apiKey ?? ''

const setProviderCredentialApiKey = (
  providerCredentials: ImageToolPersistedSettings['providerCredentials'],
  providerTemplateId: string,
  apiKey: string
): ImageToolPersistedSettings['providerCredentials'] => {
  const trimmedApiKey = apiKey.trim()
  const nextProviderCredentials = { ...providerCredentials }

  if (trimmedApiKey) {
    nextProviderCredentials[providerTemplateId] = { apiKey: trimmedApiKey }
  } else {
    delete nextProviderCredentials[providerTemplateId]
  }

  return nextProviderCredentials
}

const createApiSettingsDraft = ({
  apiKey,
  baseUrl,
  customProviderTemplates,
  editEndpointPath,
  endpointPath,
  model,
  outputFormat,
  providerCredentials,
  providerTemplateId,
  responseFormat,
  sendOutputFormat,
  sendResponseFormat
}: ApiSettingsDraft): ApiSettingsDraft => ({
  providerTemplateId,
  baseUrl,
  endpointPath,
  editEndpointPath,
  apiKey,
  model,
  outputFormat,
  sendOutputFormat,
  sendResponseFormat,
  responseFormat,
  providerCredentials,
  customProviderTemplates
})

const createTemplateEditorDraftForNewTemplate = (
  draft: ApiSettingsDraft,
  defaultName: string
): TemplateEditorDraft => ({
  name: defaultName,
  description: '',
  defaultBaseUrl: '',
  endpointPath: '/v1/images/generations',
  editEndpointPath: '/v1/images/edits',
  model: 'gpt-image-2',
  sendOutputFormat: draft.sendOutputFormat,
  outputFormat: draft.outputFormat,
  sendResponseFormat: draft.sendResponseFormat,
  responseFormat: draft.responseFormat
})

const createTemplateEditorDraftFromTemplate = (template: ImageProviderTemplate): TemplateEditorDraft => ({
  id: template.id,
  name: template.name,
  description: template.description ?? '',
  defaultBaseUrl: template.defaultBaseUrl,
  endpointPath: normalizeEndpointPath(template.endpointPath),
  editEndpointPath: normalizeEditEndpointPath(template.editEndpointPath),
  model: template.model,
  sendOutputFormat: template.sendOutputFormat,
  outputFormat: template.outputFormat ?? 'png',
  sendResponseFormat: template.sendResponseFormat,
  responseFormat: template.responseFormat ?? 'b64_json'
})

const createCustomTemplateId = (): string => {
  const randomId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `custom-${randomId}`
}

const templateEditorDraftToTemplate = (draft: TemplateEditorDraft): ImageProviderTemplate | undefined => {
  const name = draft.name.trim()
  const defaultBaseUrl = draft.defaultBaseUrl.trim()
  const endpointPath = normalizeEndpointPath(draft.endpointPath)
  const editEndpointPath = normalizeEditEndpointPath(draft.editEndpointPath)
  const model = draft.model.trim() || 'gpt-image-2'

  if (!name || !endpointPath || !editEndpointPath || !model) {
    return undefined
  }

  return {
    id: draft.id && !protectedImageProviderTemplateIds.has(draft.id) ? draft.id : createCustomTemplateId(),
    name,
    ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
    defaultBaseUrl,
    endpointPath,
    editEndpointPath,
    model,
    sendOutputFormat: draft.sendOutputFormat,
    outputFormat: draft.outputFormat,
    sendResponseFormat: draft.sendResponseFormat,
    responseFormat: draft.responseFormat
  }
}

const PROMPT_TEMPLATE_UNCATEGORIZED_ID = 'uncategorized'

const createPromptTemplateEditorDraft = (
  categoryId: string | null | undefined,
  template?: ImageToolPromptTemplate
): PromptTemplateEditorDraft => ({
  id: template?.id,
  title: template?.title ?? '',
  categoryId: template?.categoryId ?? categoryId ?? PROMPT_TEMPLATE_UNCATEGORIZED_ID,
  templateType: template?.templateType ?? 'text_to_image',
  description: template?.description ?? '',
  prompt: template?.prompt ?? '',
  variables:
    template?.variables?.map((variable) => ({
      key: variable.key,
      label: variable.label,
      placeholder: variable.placeholder ?? '',
      required: Boolean(variable.required),
      defaultValue: variable.defaultValue ?? ''
    })) ?? [],
  tags: template?.tags?.join(', ') ?? '',
  recommendedSize: template?.recommendedParams?.size ?? '',
  recommendedQuality: template?.recommendedParams?.quality ?? '',
  recommendedOutputFormat: template?.recommendedParams?.outputFormat ?? '',
  previewDataUrl: template?.previewDataUrl
})

const promptTemplateEditorDraftToInput = (draft: PromptTemplateEditorDraft): ImageToolPromptTemplateInput => {
  const variables = draft.variables
    .map((variable) => ({
      key: variable.key.trim(),
      label: variable.label.trim() || variable.key.trim(),
      ...(variable.placeholder.trim() ? { placeholder: variable.placeholder.trim() } : {}),
      ...(variable.required ? { required: true } : {}),
      ...(variable.defaultValue ? { defaultValue: variable.defaultValue } : {})
    }))
    .filter((variable) => variable.key && variable.label)
  const tags = draft.tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
  const recommendedParams = {
    ...(draft.recommendedSize.trim() ? { size: draft.recommendedSize.trim() } : {}),
    ...(draft.recommendedQuality ? { quality: draft.recommendedQuality } : {}),
    ...(draft.recommendedOutputFormat ? { outputFormat: draft.recommendedOutputFormat } : {})
  }

  return {
    ...(draft.id ? { id: draft.id } : {}),
    title: draft.title.trim(),
    categoryId: draft.categoryId ?? PROMPT_TEMPLATE_UNCATEGORIZED_ID,
    templateType: draft.templateType,
    description: draft.description.trim(),
    prompt: draft.prompt.trim(),
    ...(variables.length > 0 ? { variables } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(Object.keys(recommendedParams).length > 0 ? { recommendedParams } : {}),
    ...(draft.previewDataUrl ? { previewImageDataUrl: draft.previewDataUrl } : {}),
    ...(draft.removePreview ? { removePreview: true } : {})
  }
}

const applyPromptTemplateValues = (template: ImageToolPromptTemplate, values: Record<string, string>): string => {
  const defaultValues = (template.variables ?? []).reduce<Record<string, string>>((result, variable) => {
    if (variable.defaultValue) {
      result[variable.key] = variable.defaultValue
    }

    return result
  }, {})
  const resolvedValues = {
    ...defaultValues,
    ...values
  }

  return template.prompt.replace(/\{([^{}]+)\}/g, (match, key: string) => {
    const value = resolvedValues[key]
    return typeof value === 'string' ? value : match
  })
}

const getPromptTemplateTypeLabel = (
  templateType: ImageToolPromptTemplateType,
  text: (typeof copy)[Language]
): string => (templateType === 'image_to_image' ? text.imageToImage : text.textToImage)

const formatPromptTemplateImportResult = (
  result: ImageToolPromptTemplateImportResult,
  text: (typeof copy)[Language]
): string => {
  if (result.errors.length > 0 && result.imported === 0) {
    return text.templateImportFailed.replace('{reason}', result.errors[0]?.reason ?? text.failed)
  }

  return text.templateImportSuccess
    .replace('{imported}', String(result.imported))
    .replace('{updated}', String(result.updated ?? 0))
    .replace('{skipped}', String(result.skipped))
}

const buildDownloadName = (params: ConversationParams, createdAt: number, taskId?: string): string => {
  const date = new Date(createdAt)
  const timestamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(
    date.getDate()
  ).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(
    2,
    '0'
  )}${String(date.getSeconds()).padStart(2, '0')}`
  const shortTaskId = sanitizeDownloadNamePart(taskId).replace(/-/g, '').slice(0, 8) || 'download'

  return `image-tool-${timestamp}-${shortTaskId}-${sanitizeDownloadNamePart(params.size)}-${sanitizeDownloadNamePart(
    params.model
  )}.${params.outputFormat}`
}

const getTaskStatusText = (message: ConversationMessage, text: (typeof copy)[Language]): string => {
  const status = message.status

  if (status === 'queued') {
    return text.taskQueued
  }

  if (status === 'running') {
    return message.params?.mode === 'image_edit' ? text.taskEditing : text.taskRunning
  }

  if (status === 'succeeded') {
    return text.taskSucceeded
  }

  if (status === 'failed') {
    return text.taskFailed
  }

  return text.generating
}

const isConcurrencyLimitErrorMessage = (message: string | undefined): boolean => {
  return Boolean(message && /concurrency limit exceeded/i.test(message))
}

const UPSTREAM_MASK_SIZE_MISMATCH_PATTERN = /invalid mask image format|mask size does not match image size/i

const getNumberDebugValue = (summary: Record<string, unknown>, key: string): number | undefined => {
  const value = summary[key]

  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

const createSafeEditDebugDetails = ({
  error,
  requestSummary
}: {
  error?: ImageToolImageTask['error']
  requestSummary?: Record<string, unknown>
}): ImageToolDebugDetails | undefined => {
  const summary = requestSummary ?? error?.requestSummary
  const details: ImageToolDebugDetails = {}

  if (error?.message) {
    details.upstreamMessage = error.message
  }

  if (typeof error?.status === 'number') {
    details.status = error.status
  }

  if (error?.upstreamType) {
    details.upstreamType = error.upstreamType
  }

  if (error?.upstreamCode) {
    details.upstreamCode = error.upstreamCode
  }

  if (!summary) {
    return Object.keys(details).length ? details : undefined
  }

  const endpoint = error?.endpoint ?? (typeof summary.finalEndpoint === 'string' ? summary.finalEndpoint : undefined)
  const mode = summary.mode
  const editSubmitMode = summary.editSubmitMode
  const maskHasOnlyAlpha0And255 = summary.maskHasOnlyAlpha0And255
  const multipartFields = summary.multipartFields
  const referenceImageNames = summary.referenceImageNames

  if (endpoint) {
    details.endpoint = endpoint
  }

  if (mode === 'generation' || mode === 'reference' || mode === 'edit') {
    details.mode = mode
  }

  if (editSubmitMode === 'original' || editSubmitMode === 'compatible') {
    details.editSubmitMode = editSubmitMode
  }

  details.referenceImageCount = getNumberDebugValue(summary, 'referenceImageCount')
  details.referenceImageTotalBytes = getNumberDebugValue(summary, 'referenceImageTotalBytes')
  details.originalImageWidth = getNumberDebugValue(summary, 'originalImageWidth')
  details.originalImageHeight = getNumberDebugValue(summary, 'originalImageHeight')
  details.submittedImageWidth = getNumberDebugValue(summary, 'submittedImageWidth')
  details.submittedImageHeight = getNumberDebugValue(summary, 'submittedImageHeight')
  details.submittedMaskWidth = getNumberDebugValue(summary, 'submittedMaskWidth')
  details.submittedMaskHeight = getNumberDebugValue(summary, 'submittedMaskHeight')
  details.maskBytes = getNumberDebugValue(summary, 'maskBytes')

  if (typeof maskHasOnlyAlpha0And255 === 'boolean') {
    details.maskHasOnlyAlpha0And255 = maskHasOnlyAlpha0And255
  }

  if (Array.isArray(multipartFields)) {
    details.multipartFields = multipartFields.filter((field): field is string => typeof field === 'string')
  }

  if (Array.isArray(referenceImageNames)) {
    details.referenceImageNames = referenceImageNames.filter((name): name is string => typeof name === 'string')
  }

  return Object.values(details).some((value) => value !== undefined) ? details : undefined
}

const isOriginalSizeMaskMismatchError = (task: ImageToolImageTask): boolean => {
  const requestSummary = task.error?.requestSummary

  return (
    task.type === 'image_edit' &&
    requestSummary?.editSubmitMode === 'original' &&
    UPSTREAM_MASK_SIZE_MISMATCH_PATTERN.test(task.error?.message ?? '')
  )
}

const getImageEditFailureError = (
  task: ImageToolImageTask,
  text: (typeof copy)[Language]
): NonNullable<ConversationMessage['error']> => {
  return {
    code: task.error?.code,
    message: isOriginalSizeMaskMismatchError(task)
      ? text.editSubmitOriginalFailureHint
      : (task.error?.message ?? text.imageGenerationFailed),
    debugDetails: createSafeEditDebugDetails({
      error: task.error
    })
  }
}

const editDebugDetailKeys: readonly (keyof ImageToolDebugDetails)[] = [
  'mode',
  'upstreamMessage',
  'status',
  'upstreamType',
  'upstreamCode',
  'endpoint',
  'editSubmitMode',
  'originalImageWidth',
  'originalImageHeight',
  'submittedImageWidth',
  'submittedImageHeight',
  'submittedMaskWidth',
  'submittedMaskHeight',
  'maskBytes',
  'maskHasOnlyAlpha0And255',
  'referenceImageCount',
  'referenceImageNames',
  'referenceImageTotalBytes',
  'multipartFields'
]

const formatDebugDetailValue = (value: ImageToolDebugDetails[keyof ImageToolDebugDetails]): string => {
  if (Array.isArray(value)) {
    return value.join(', ')
  }

  return String(value)
}

function EditDebugDetails({
  details,
  text
}: {
  details?: ImageToolDebugDetails
  text: (typeof copy)[Language]
}): React.JSX.Element | null {
  if (!details) {
    return null
  }

  const entries = editDebugDetailKeys
    .map((key) => [key, details[key]] as const)
    .filter(([, value]) => value !== undefined && (!Array.isArray(value) || value.length > 0))

  if (!entries.length) {
    return null
  }

  return (
    <details className="debug-details edit-debug-details">
      <summary>{text.debugDetails}</summary>
      <dl className="image-debug" aria-label={text.debugDetails}>
        {entries.map(([key, value]) => {
          const formattedValue = formatDebugDetailValue(value)

          return (
            <div
              className={key === 'upstreamMessage' || key === 'multipartFields' ? 'image-debug-wide' : undefined}
              key={key}
            >
              <dt>{key}</dt>
              <dd title={formattedValue}>{formattedValue}</dd>
            </div>
          )
        })}
      </dl>
    </details>
  )
}

const taskToResultMessage = (
  message: ConversationMessage,
  task: ImageToolImageTask,
  text: (typeof copy)[Language]
): ConversationMessage => {
  if (task.status === 'succeeded' && task.result) {
    return {
      ...message,
      kind: 'image_result',
      status: 'succeeded',
      historyId: task.result.historyId ?? message.historyId,
      imageDataUrl: task.result.previewDataUrl ?? message.imageDataUrl,
      imageFileName: task.result.imageFileName ?? message.imageFileName,
      result: {
        ok: true,
        images: task.result.images,
        request: task.result.request,
        historyId: task.result.historyId,
        previewDataUrl: task.result.previewDataUrl,
        imageMimeType: task.result.imageMimeType,
        imageFileName: task.result.imageFileName,
        requestSummary: task.result.requestSummary
      }
    }
  }

  if (task.status === 'failed') {
    return {
      ...message,
      kind: 'error',
      status: 'failed',
      error:
        task.type === 'image_edit'
          ? getImageEditFailureError(task, text)
          : {
              code: task.error?.code,
              message: task.error?.message ?? text.imageGenerationFailed
            }
    }
  }

  return {
    ...message,
    status: task.status
  }
}

const getConversationModeFromTask = (task: ImageToolImageTask): ComposerMode => {
  if (task.type !== 'image_edit') {
    return 'image_generation'
  }

  return 'editMode' in task.request && task.request.editMode === 'reference' ? 'image_reference' : 'image_edit'
}

const createPendingMessagesFromTask = (task: ImageToolImageTask): ConversationMessage[] => {
  const params: ConversationParams = {
    mode: getConversationModeFromTask(task),
    model: task.request.model,
    size: task.request.size,
    quality: task.request.quality ?? 'auto',
    outputFormat: task.request.outputFormat ?? 'png',
    n: task.request.n ?? 1
  }
  const promptMessage: ConversationMessage = {
    id: `${task.id}:prompt`,
    conversationId: task.request.conversationId,
    role: 'user',
    kind: 'prompt',
    createdAt: task.createdAt,
    prompt: task.request.prompt,
    params,
    taskId: task.id
  }
  const generatingMessage: ConversationMessage = {
    id: `${task.id}:generating`,
    conversationId: task.request.conversationId,
    role: 'assistant',
    kind: 'generating',
    createdAt: task.updatedAt,
    prompt: task.request.prompt,
    params,
    taskId: task.id,
    status: task.status,
    relatedMessageId: promptMessage.id
  }

  return [promptMessage, generatingMessage]
}

const ensureMessagesForTask = (messages: ConversationMessage[], task: ImageToolImageTask): ConversationMessage[] => {
  if (messages.some((message) => message.taskId === task.id)) {
    return messages.map((message) =>
      message.taskId === task.id && message.kind === 'generating'
        ? {
            ...message,
            conversationId: task.request.conversationId ?? message.conversationId,
            status: task.status
          }
        : message
    )
  }

  let didBindPendingMessage = false
  const messagesWithBoundTask = messages.map((message) => {
    if (
      didBindPendingMessage ||
      message.kind !== 'generating' ||
      message.taskId ||
      message.prompt !== task.request.prompt
    ) {
      return message
    }

    didBindPendingMessage = true
    return {
      ...message,
      conversationId: task.request.conversationId ?? message.conversationId,
      taskId: task.id,
      status: task.status
    }
  })

  return didBindPendingMessage
    ? messagesWithBoundTask
    : [...messagesWithBoundTask, ...createPendingMessagesFromTask(task)]
}

const createMessagesFromHistory = (history: ImageToolHistoryItem[]): ConversationMessage[] => {
  return history.flatMap((item) => {
    const historyQuality = item.quality
    const historyOutputFormat = item.outputFormat
    const params: ConversationParams = {
      mode: item.mode,
      model: item.model,
      size: item.size,
      quality: historyQuality && isComposerQuality(historyQuality) ? historyQuality : 'auto',
      outputFormat: historyOutputFormat && isComposerOutputFormat(historyOutputFormat) ? historyOutputFormat : 'png'
    }
    const userMessage: ConversationMessage = {
      id: `${item.id}:prompt`,
      conversationId: item.conversationId,
      role: 'user',
      kind: 'prompt',
      createdAt: item.createdAt,
      prompt: item.prompt,
      params,
      historyId: item.id,
      taskId: item.taskId
    }
    const assistantMessage: ConversationMessage = item.error
      ? {
          id: `${item.id}:error`,
          conversationId: item.conversationId,
          role: 'assistant',
          kind: 'error',
          createdAt: item.updatedAt,
          prompt: item.prompt,
          params,
          error: item.error,
          historyId: item.id,
          taskId: item.taskId,
          imageFileName: item.imageFileName,
          relatedMessageId: userMessage.id,
          status: 'failed'
        }
      : {
          id: `${item.id}:result`,
          conversationId: item.conversationId,
          role: 'assistant',
          kind: 'image_result',
          createdAt: item.updatedAt,
          prompt: item.prompt,
          params,
          historyId: item.id,
          taskId: item.taskId,
          imageDataUrl: item.imageDataUrl,
          imageFileName: item.imageFileName,
          relatedMessageId: userMessage.id,
          status: 'succeeded',
          result: {
            ok: true,
            images: [
              {
                previewDataUrl: item.imageDataUrl
              }
            ],
            request: {
              model: item.model,
              size: item.size,
              quality: item.quality,
              outputFormat: item.outputFormat
            },
            historyId: item.id,
            previewDataUrl: item.imageDataUrl,
            imageMimeType: item.imageMimeType,
            imageFileName: item.imageFileName
          }
        }

    return [userMessage, assistantMessage]
  })
}

export function App(): React.JSX.Element {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [messagesByConversationId, setMessagesByConversationId] = useState<Record<string, ConversationMessage[]>>({})
  const [projects, setProjects] = useState<ImageToolProjectGroup[]>([])
  const [conversations, setConversations] = useState<ImageToolConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string>()
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>()
  const [renamingProjectId, setRenamingProjectId] = useState<string>()
  const [projectRenameDraft, setProjectRenameDraft] = useState('')
  const [collapsedProjectIds, setCollapsedProjectIds] = useState<Set<string>>(
    () => new Set(readStoredStringArray(COLLAPSED_PROJECT_IDS_STORAGE_KEY))
  )
  const [isTrashOpen, setIsTrashOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [providerTemplateId, setProviderTemplateId] = useState('compatible-default')
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com')
  const [endpointPath, setEndpointPath] = useState('/v1/images/generations')
  const [editEndpointPath, setEditEndpointPath] = useState('/v1/images/edits')
  const [model, setModel] = useState('gpt-image-2')
  const [sizeMode, setSizeMode] = useState<ImageSizeMode>('fixed')
  const [fixedSize, setFixedSize] = useState<ImageSizePreset>('3840x2160')
  const [quality, setQuality] = useState<ImageToolImage2Quality>('auto')
  const [outputFormat, setOutputFormat] = useState<ImageToolImage2OutputFormat>('png')
  const [sendOutputFormat, setSendOutputFormat] = useState(true)
  const [sendResponseFormat, setSendResponseFormat] = useState(false)
  const [responseFormat, setResponseFormat] = useState<ImageToolImage2ResponseFormat>('b64_json')
  const [customProviderTemplates, setCustomProviderTemplates] = useState<ImageProviderTemplate[]>([])
  const [providerCredentials, setProviderCredentials] = useState<ImageToolPersistedSettings['providerCredentials']>({})
  const [saveApiKey, setSaveApiKey] = useState(false)
  const [defaultUnitPrice, setDefaultUnitPrice] = useState(0.06)
  const [currency, setCurrency] = useState<ImageToolUsagePriceSettings['currency']>('CNY')
  const [providerUnitPrices, setProviderUnitPrices] = useState<Record<string, number>>({})
  const [appearanceTheme, setAppearanceTheme] = useState<AppearanceTheme>('dark')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [usageOpen, setUsageOpen] = useState(false)
  const [usageSnapshot, setUsageSnapshot] = useState<ImageToolTaskUsageSnapshot>({
    records: [],
    stats: {
      totalTasks: 0,
      succeededTasks: 0,
      failedTasks: 0,
      runningTasks: 0,
      successfulImages: 0,
      totalCost: 0,
      currency: 'CNY'
    }
  })
  const [usageFilters, setUsageFilters] = useState<UsageFilters>({
    providerTemplateId: 'all',
    status: 'all',
    taskType: 'all',
    timeRange: 'all'
  })
  const [usageDefaultPriceDraft, setUsageDefaultPriceDraft] = useState('0.06')
  const [usageProviderPriceDraft, setUsageProviderPriceDraft] = useState('0.06')
  const [usageStatus, setUsageStatus] = useState<string>()
  const [settingsDraft, setSettingsDraft] = useState<ApiSettingsDraft>(() => ({
    providerTemplateId: 'compatible-default',
    baseUrl: 'https://api.openai.com',
    endpointPath: '/v1/images/generations',
    editEndpointPath: '/v1/images/edits',
    apiKey: '',
    model: 'gpt-image-2',
    outputFormat: 'png',
    sendOutputFormat: true,
    sendResponseFormat: false,
    responseFormat: 'b64_json',
    providerCredentials: {},
    customProviderTemplates: []
  }))
  const [templateEditorDraft, setTemplateEditorDraft] = useState<TemplateEditorDraft>()
  const [templateEditorStatus, setTemplateEditorStatus] = useState<string>()
  const [promptTemplates, setPromptTemplates] = useState<ImageToolPromptTemplate[]>([])
  const [promptTemplateCategories, setPromptTemplateCategories] = useState<ImageToolPromptTemplateCategory[]>([])
  const [isPromptLibraryOpen, setIsPromptLibraryOpen] = useState(false)
  const [promptLibraryStatus, setPromptLibraryStatus] = useState<string>()
  const [selectedPromptTemplateCategoryId, setSelectedPromptTemplateCategoryId] = useState<string>('all')
  const [promptTemplateSearch, setPromptTemplateSearch] = useState('')
  const [promptTemplateTypeFilter, setPromptTemplateTypeFilter] = useState<PromptTemplateTypeFilter>('all')
  const [promptTemplateCardScale, setPromptTemplateCardScale] = useState<PromptTemplateCardScale>(
    readStoredPromptTemplateCardScale
  )
  const [selectedPromptTemplateIds, setSelectedPromptTemplateIds] = useState<Set<string>>(() => new Set())
  const [promptTemplateEditorDraft, setPromptTemplateEditorDraft] = useState<PromptTemplateEditorDraft>()
  const [promptTemplateCategoryDialog, setPromptTemplateCategoryDialog] = useState<PromptTemplateCategoryDialogState>()
  const [promptTemplateVariableDialog, setPromptTemplateVariableDialog] = useState<PromptTemplateVariableDialogState>()
  const [appliedPromptTemplateType, setAppliedPromptTemplateType] = useState<ImageToolPromptTemplateType>()
  const [promptTemplateReferenceNotice, setPromptTemplateReferenceNotice] = useState<string>()
  const [settingsStatus, setSettingsStatus] = useState<string>()
  const [composerPopover, setComposerPopover] = useState<ComposerPopoverState>()
  const [referenceImages, setReferenceImages] = useState<ReferenceImageDraft[]>([])
  const [referenceUploadError, setReferenceUploadError] = useState<string>()
  const [isReferenceDropActive, setIsReferenceDropActive] = useState(false)
  const [editingSource, setEditingSource] = useState<EditingSourceImage>()
  const [imageEditError, setImageEditError] = useState<ConversationMessage['error']>()
  const [isSubmittingImageEdit, setIsSubmittingImageEdit] = useState(false)
  const [lightboxMessage, setLightboxMessage] = useState<ConversationMessage>()
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [connectionTestResult, setConnectionTestResult] = useState<ImageToolTestConnectionResult>()
  const [language, setLanguage] = useState<Language>('zh')
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false)
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false)
  const [customLogoDataUrl, setCustomLogoDataUrl] = useState(() => readStoredValue(CUSTOM_LOGO_STORAGE_KEY))
  const [isBridgeReady, setIsBridgeReady] = useState(false)
  const [confirmationDialog, setConfirmationDialog] = useState<ConfirmationDialogState>()
  const [textInputDialog, setTextInputDialog] = useState<TextInputDialogState>()
  const [toastMessage, setToastMessage] = useState<string>()
  const [previewSelfTest, setPreviewSelfTest] = useState<PreviewSelfTestResult>({
    dataUrlLoad: 'pending',
    blobUrlLoad: 'pending',
    cspHint: 'preview self-test has not completed'
  })
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const conversationScrollRef = useRef<HTMLElement | null>(null)
  const languageMenuRef = useRef<HTMLDivElement | null>(null)
  const themeMenuRef = useRef<HTMLDivElement | null>(null)
  const logoFileInputRef = useRef<HTMLInputElement | null>(null)
  const promptInputRef = useRef<HTMLTextAreaElement | null>(null)
  const referenceImageInputRef = useRef<HTMLInputElement | null>(null)
  const promptTemplateImportInputRef = useRef<HTMLInputElement | null>(null)
  const activeConversationIdRef = useRef<string | undefined>(undefined)
  const messagesRef = useRef<ConversationMessage[]>([])
  const messagesByConversationIdRef = useRef<Record<string, ConversationMessage[]>>({})
  const taskConversationIdRef = useRef<Record<string, string>>({})
  const queuedImageJobsRef = useRef<LocalImageQueueJob[]>([])
  const runningImageJobsRef = useRef<Map<string, LocalImageQueueJob>>(new Map())
  const taskIdToLocalJobIdRef = useRef<Record<string, string>>({})
  const confirmationResolverRef = useRef<((confirmed: boolean) => void) | undefined>(undefined)
  const textInputResolverRef = useRef<((value: string | undefined) => void) | undefined>(undefined)
  const toastTimeoutRef = useRef<number | undefined>(undefined)
  const referenceDragDepthRef = useRef(0)
  const lastRenderedConversationIdRef = useRef<string | undefined>(undefined)
  const lastConversationSwitchAtRef = useRef(0)
  const isNearConversationEndRef = useRef(true)
  const pendingScrollBehaviorRef = useRef<ScrollBehavior | undefined>(undefined)

  const resolvedSize = useMemo(() => resolveImageSize({ mode: sizeMode, fixedSize }), [fixedSize, sizeMode])
  const currentCopy = copy[language]
  const requestConfirmation = useCallback(
    ({
      confirmLabel = currentCopy.delete,
      message,
      title,
      tone = 'danger'
    }: {
      confirmLabel?: string
      message: string
      title: string
      tone?: ConfirmationDialogState['tone']
    }): Promise<boolean> => {
      return new Promise((resolve) => {
        confirmationResolverRef.current = resolve
        setConfirmationDialog({
          cancelLabel: currentCopy.cancel,
          confirmLabel,
          message,
          title,
          tone
        })
      })
    },
    [currentCopy.cancel, currentCopy.delete]
  )
  const resolveConfirmationDialog = useCallback((confirmed: boolean) => {
    const resolver = confirmationResolverRef.current
    confirmationResolverRef.current = undefined
    setConfirmationDialog(undefined)
    resolver?.(confirmed)
  }, [])
  const requestTextInput = useCallback(
    ({
      confirmLabel = currentCopy.rename,
      initialValue,
      label,
      requiredMessage = currentCopy.inputRequired,
      title
    }: {
      confirmLabel?: string
      initialValue: string
      label: string
      requiredMessage?: string
      title: string
    }): Promise<string | undefined> => {
      return new Promise((resolve) => {
        textInputResolverRef.current = resolve
        setTextInputDialog({
          cancelLabel: currentCopy.cancel,
          confirmLabel,
          label,
          requiredMessage,
          title,
          value: initialValue
        })
      })
    },
    [currentCopy.cancel, currentCopy.inputRequired, currentCopy.rename]
  )
  const resolveTextInputDialog = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      const trimmedValue = value.trim()

      if (!trimmedValue) {
        setTextInputDialog((currentDialog) =>
          currentDialog ? { ...currentDialog, error: currentDialog.requiredMessage } : currentDialog
        )
        return
      }

      value = trimmedValue
    }

    const resolver = textInputResolverRef.current
    textInputResolverRef.current = undefined
    setTextInputDialog(undefined)
    resolver?.(value)
  }, [])
  const showToast = useCallback((message: string) => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current)
    }

    setToastMessage(message)
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(undefined)
      toastTimeoutRef.current = undefined
    }, 3200)
  }, [])
  const availableTemplates = useMemo(
    () => getImageProviderTemplates(settingsDraft.customProviderTemplates),
    [settingsDraft.customProviderTemplates]
  )
  const draftTemplate = useMemo(
    () => getImageProviderTemplate(settingsDraft.providerTemplateId, settingsDraft.customProviderTemplates),
    [settingsDraft.customProviderTemplates, settingsDraft.providerTemplateId]
  )
  const currentApiKey = useMemo(
    () => getProviderCredentialApiKey(providerCredentials, providerTemplateId),
    [providerCredentials, providerTemplateId]
  )
  const currentProviderTemplate = useMemo(
    () => getImageProviderTemplate(providerTemplateId, customProviderTemplates),
    [customProviderTemplates, providerTemplateId]
  )
  const currentProviderTemplateLabel = useMemo(
    () => getProviderTemplateLabel(currentProviderTemplate, currentCopy).name,
    [currentCopy, currentProviderTemplate]
  )
  const usageTemplates = useMemo(() => getImageProviderTemplates(customProviderTemplates), [customProviderTemplates])
  const usageRecordFilters = useMemo(
    () => createUsageRecordFilters(usageFilters, usageTemplates),
    [usageFilters, usageTemplates]
  )
  const draftRequestEndpoint = useMemo(
    () => createRequestEndpoint(settingsDraft.baseUrl, settingsDraft.endpointPath),
    [settingsDraft.baseUrl, settingsDraft.endpointPath]
  )
  const draftEditRequestEndpoint = useMemo(
    () => createRequestEndpoint(settingsDraft.baseUrl, settingsDraft.editEndpointPath),
    [settingsDraft.baseUrl, settingsDraft.editEndpointPath]
  )
  const currentSizeLabel = resolvedSize.ok ? resolvedSize.value.size : currentCopy.invalidSize
  const composerSizeLabel = getComposerSizeOption(sizeMode, fixedSize, language, currentCopy)
  const apiStatus = useMemo(
    () => getApiStatus({ apiKey: currentApiKey, baseUrl, hasBridge: isBridgeReady, messages, model }),
    [baseUrl, currentApiKey, isBridgeReady, messages, model]
  )
  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId),
    [activeConversationId, conversations]
  )
  const activeProjectId = activeConversation ? activeConversation.projectId : undefined
  const targetProjectId = selectedProjectId !== undefined ? selectedProjectId : (activeProjectId ?? null)
  const hasActiveConversation = Boolean(activeConversationId && activeConversation && !activeConversation.deletedAt)
  const visibleConversations = useMemo(
    () => sortConversationsByUpdatedAt(conversations.filter((conversation) => !conversation.deletedAt)),
    [conversations]
  )
  const trashedConversations = useMemo(
    () => sortConversationsByUpdatedAt(conversations.filter((conversation) => conversation.deletedAt)),
    [conversations]
  )
  const filteredPromptTemplates = useMemo(() => {
    const normalizedSearch = promptTemplateSearch.trim().toLowerCase()

    return promptTemplates.filter((template) => {
      const matchesCategory =
        selectedPromptTemplateCategoryId === 'all' || template.categoryId === selectedPromptTemplateCategoryId
      const matchesType = promptTemplateTypeFilter === 'all' || template.templateType === promptTemplateTypeFilter
      const searchableText = [template.title, template.description, template.prompt, ...(template.tags ?? [])]
        .filter(Boolean)
        .join('\n')
        .toLowerCase()
      const matchesSearch = !normalizedSearch || searchableText.includes(normalizedSearch)

      return matchesCategory && matchesType && matchesSearch
    })
  }, [promptTemplateSearch, promptTemplateTypeFilter, promptTemplates, selectedPromptTemplateCategoryId])
  const selectedVisiblePromptTemplateIds = useMemo(
    () =>
      filteredPromptTemplates
        .filter((template) => selectedPromptTemplateIds.has(template.id))
        .map((template) => template.id),
    [filteredPromptTemplates, selectedPromptTemplateIds]
  )
  const selectedPromptTemplateCount = selectedPromptTemplateIds.size
  const areAllVisiblePromptTemplatesSelected =
    filteredPromptTemplates.length > 0 && selectedVisiblePromptTemplateIds.length === filteredPromptTemplates.length

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const templateIds = new Set(promptTemplates.map((template) => template.id))

    setSelectedPromptTemplateIds((currentIds) => {
      const nextIds = new Set([...currentIds].filter((templateId) => templateIds.has(templateId)))
      return nextIds.size === currentIds.size ? currentIds : nextIds
    })
  }, [promptTemplates])

  const isNearConversationEnd = useCallback((): boolean => {
    const conversationElement = conversationScrollRef.current

    if (!conversationElement) {
      return true
    }

    const distanceToEnd =
      conversationElement.scrollHeight - conversationElement.scrollTop - conversationElement.clientHeight

    return distanceToEnd < 120
  }, [])

  const requestScrollToConversationEnd = (behavior: ScrollBehavior) => {
    pendingScrollBehaviorRef.current = behavior
  }

  const applySessionState = (state: ImageToolSessionState) => {
    const previousActiveConversationId = activeConversationIdRef.current
    activeConversationIdRef.current = state.activeConversationId
    setProjects(state.projects)
    setConversations(state.conversations)
    setActiveConversationId(state.activeConversationId)

    if (state.activeConversationId !== previousActiveConversationId) {
      requestScrollToConversationEnd('auto')

      const cachedMessages = state.activeConversationId
        ? (messagesByConversationIdRef.current[state.activeConversationId] ?? [])
        : []
      setMessages(cachedMessages)
      messagesRef.current = cachedMessages
    }

    setSelectedProjectId((currentProjectId) => {
      if (currentProjectId !== undefined) {
        if (currentProjectId === null) {
          return null
        }

        if (state.projects.some((project) => project.id === currentProjectId)) {
          return currentProjectId
        }
      }

      const nextActiveConversation = state.conversations.find(
        (conversation) => conversation.id === state.activeConversationId
      )
      return nextActiveConversation ? nextActiveConversation.projectId : undefined
    })
  }

  const clearComposerState = () => {
    setPrompt('')
    setReferenceImages([])
    setReferenceUploadError(undefined)
    setComposerPopover(undefined)
    setEditingSource(undefined)
    setImageEditError(undefined)
    setAppliedPromptTemplateType(undefined)
    setPromptTemplateReferenceNotice(undefined)
  }

  const storeConversationMessages = (conversationId: string | undefined, nextMessages: ConversationMessage[]) => {
    if (!conversationId) {
      setMessages(nextMessages)
      messagesRef.current = nextMessages
      return
    }

    messagesByConversationIdRef.current = {
      ...messagesByConversationIdRef.current,
      [conversationId]: nextMessages
    }
    setMessagesByConversationId(messagesByConversationIdRef.current)

    if (conversationId === activeConversationIdRef.current) {
      setMessages(nextMessages)
      messagesRef.current = nextMessages
    }
  }

  const updateConversationMessages = (
    conversationId: string | undefined,
    updater: (currentMessages: ConversationMessage[]) => ConversationMessage[]
  ) => {
    const currentMessages =
      conversationId && conversationId !== activeConversationIdRef.current
        ? (messagesByConversationIdRef.current[conversationId] ?? [])
        : messagesRef.current

    storeConversationMessages(conversationId, updater(currentMessages))
  }

  const replaceMessage = (messageId: string, nextMessage: ConversationMessage) => {
    updateConversationMessages(nextMessage.conversationId ?? activeConversationIdRef.current, (currentMessages) =>
      currentMessages.map((message) => (message.id === messageId ? nextMessage : message))
    )
  }

  const setAssistantMessageStatus = (
    conversationId: string | undefined,
    assistantMessageId: string,
    status: ConversationMessage['status']
  ) => {
    updateConversationMessages(conversationId, (currentMessages) =>
      currentMessages.map((message) =>
        message.id === assistantMessageId && message.kind === 'generating'
          ? {
              ...message,
              status
            }
          : message
      )
    )
  }

  const failLocalQueuedJob = (
    job: LocalImageQueueJob,
    error: NonNullable<ConversationMessage['error']>,
    taskId?: string
  ) => {
    replaceMessage(job.assistantMessageId, {
      id: job.assistantMessageId,
      conversationId: job.conversationId,
      role: 'assistant',
      kind: 'error',
      createdAt: Date.now(),
      prompt: job.request.prompt,
      params: job.params,
      referenceImages: job.referenceImages,
      error,
      relatedMessageId: job.userMessageId,
      taskId,
      status: 'failed'
    })
  }

  const scrollToConversationEnd = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const conversationElement = conversationScrollRef.current

    if (conversationElement) {
      conversationElement.scrollTo({
        top: conversationElement.scrollHeight,
        behavior
      })
      isNearConversationEndRef.current = true
      return
    }

    messagesEndRef.current?.scrollIntoView({
      block: 'end',
      behavior
    })
  }, [])

  const scheduleScrollToConversationEnd = useCallback(
    (behavior: ScrollBehavior = 'smooth') => {
      requestAnimationFrame(() => {
        scrollToConversationEnd(behavior)
      })
    },
    [scrollToConversationEnd]
  )

  const handlePreviewSettled = useCallback(() => {
    if (isNearConversationEndRef.current) {
      const didRecentlySwitchConversation = Date.now() - lastConversationSwitchAtRef.current < 1500
      scrollToConversationEnd(didRecentlySwitchConversation ? 'auto' : 'smooth')
    }
  }, [scrollToConversationEnd])

  const processImageTaskQueue = useCallback(() => {
    const imageToolApi = getImageToolApi()
    const diagnostics = getBridgeDiagnostics()
    setIsBridgeReady(diagnostics.hasBridge)

    if (!hasImageToolBridge(imageToolApi)) {
      return
    }

    while (runningImageJobsRef.current.size < IMAGE_TASK_MAX_CONCURRENCY && queuedImageJobsRef.current.length > 0) {
      const job = queuedImageJobsRef.current.shift()

      if (!job) {
        return
      }

      const apiKey = currentApiKey.trim()

      if (!apiKey) {
        failLocalQueuedJob(job, {
          code: 'missing_api_config',
          message: currentCopy.apiConfigRequired
        })
        continue
      }

      const executionRequest = {
        ...job.request,
        apiKey,
        baseUrl,
        endpointPath: normalizeEndpointPath(endpointPath),
        providerTemplateId,
        providerTemplateName: currentProviderTemplateLabel,
        ...(job.mode === 'image_generation' ? {} : { editEndpointPath: normalizeEditEndpointPath(editEndpointPath) })
      }
      const runningJob: LocalImageQueueJob = {
        ...job,
        request: executionRequest,
        status: 'running'
      }

      runningImageJobsRef.current.set(runningJob.id, runningJob)
      setAssistantMessageStatus(runningJob.conversationId, runningJob.assistantMessageId, 'running')

      void (async () => {
        try {
          const task =
            runningJob.mode === 'image_generation'
              ? await imageToolApi.createImage2Task(executionRequest as ImageToolGenerateImage2Request)
              : await imageToolApi.createImageEditTask(executionRequest as ImageToolEditImage2Request)
          const taskConversationId = task.request.conversationId ?? runningJob.conversationId

          if (taskConversationId) {
            taskConversationIdRef.current[task.id] = taskConversationId
          }

          taskIdToLocalJobIdRef.current[task.id] = runningJob.id
          replaceMessage(runningJob.assistantMessageId, {
            id: runningJob.assistantMessageId,
            conversationId: taskConversationId,
            role: 'assistant',
            kind: 'generating',
            createdAt: Date.now(),
            prompt: runningJob.request.prompt,
            params: runningJob.params,
            referenceImages: runningJob.referenceImages,
            status: 'running',
            relatedMessageId: runningJob.userMessageId,
            taskId: task.id
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : currentCopy.imageGenerationFailed

          runningImageJobsRef.current.delete(runningJob.id)

          if (isConcurrencyLimitErrorMessage(message) && runningJob.retryCount < IMAGE_TASK_CONCURRENCY_RETRY_LIMIT) {
            queuedImageJobsRef.current.unshift({
              ...runningJob,
              retryCount: runningJob.retryCount + 1,
              status: 'queued'
            })
            setAssistantMessageStatus(runningJob.conversationId, runningJob.assistantMessageId, 'queued')
            window.setTimeout(processImageTaskQueue, IMAGE_TASK_CONCURRENCY_RETRY_DELAY_MS)
            return
          }

          failLocalQueuedJob(runningJob, {
            code: isConcurrencyLimitErrorMessage(message) ? 'concurrency_limit_exceeded' : 'generation_failed',
            message
          })
          processImageTaskQueue()
        }
      })()
    }
  }, [
    baseUrl,
    currentApiKey,
    currentCopy,
    currentProviderTemplateLabel,
    editEndpointPath,
    endpointPath,
    providerTemplateId
  ])

  const enqueueImageJob = (job: Omit<LocalImageQueueJob, 'retryCount' | 'status'>) => {
    queuedImageJobsRef.current.push({
      ...job,
      retryCount: 0,
      status: 'queued'
    })
    processImageTaskQueue()
  }

  const loadHistoryMessages = async (
    conversationId?: string,
    scrollBehavior: ScrollBehavior = 'auto'
  ): Promise<ConversationMessage[]> => {
    if (!conversationId) {
      storeConversationMessages(undefined, [])
      return []
    }

    const imageToolApi = getImageToolApi()
    setIsBridgeReady(getBridgeDiagnostics().hasBridge)

    if (!hasImageToolBridge(imageToolApi)) {
      return []
    }

    const history = await imageToolApi.listHistory(conversationId)
    const historyWithImages = await Promise.all(
      history.map(async (item) => ({
        ...item,
        imageDataUrl: await imageToolApi.readHistoryImage(item.id)
      }))
    )
    const cachedMessages = conversationId ? messagesByConversationIdRef.current[conversationId] : undefined
    const historyMessages = createMessagesFromHistory(historyWithImages.reverse())
    const imageTasks = await imageToolApi.listImageTasks()
    const pendingTasks = imageTasks.filter((task) => {
      return task.request.conversationId === conversationId && (task.status === 'queued' || task.status === 'running')
    })
    const nextMessages = pendingTasks.reduce<ConversationMessage[]>(
      (currentMessages, task) => ensureMessagesForTask(currentMessages, task),
      cachedMessages ?? historyMessages
    )

    if (conversationId === activeConversationIdRef.current) {
      requestScrollToConversationEnd(scrollBehavior)
    }

    storeConversationMessages(conversationId, nextMessages)
    return nextMessages
  }

  const loadPromptTemplateLibrary = async () => {
    const imageToolApi = getImageToolApi()
    setIsBridgeReady(getBridgeDiagnostics().hasBridge)

    if (!hasImageToolBridge(imageToolApi)) {
      return
    }

    const [categories, templates] = await Promise.all([
      imageToolApi.listPromptTemplateCategories(),
      imageToolApi.listPromptTemplates()
    ])

    setPromptTemplateCategories(categories)
    setPromptTemplates(templates)
    setSelectedPromptTemplateCategoryId((currentCategoryId) => {
      if (currentCategoryId === 'all' || categories.some((category) => category.id === currentCategoryId)) {
        return currentCategoryId
      }

      return 'all'
    })
  }

  const loadTaskUsage = useCallback(
    async (filters: ImageToolTaskRecordFilters = usageRecordFilters) => {
      const imageToolApi = getImageToolApi()
      setIsBridgeReady(getBridgeDiagnostics().hasBridge)

      if (!hasImageToolBridge(imageToolApi)) {
        return
      }

      const snapshot = await imageToolApi.listTaskUsage(filters)
      setUsageSnapshot(snapshot)
    },
    [usageRecordFilters]
  )

  const openPromptLibrary = () => {
    setIsPromptLibraryOpen(true)
    setPromptLibraryStatus(undefined)
    void loadPromptTemplateLibrary()
  }

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId
    setPromptTemplateVariableDialog(undefined)
  }, [activeConversationId])

  useEffect(() => {
    if (referenceImages.length > 0 && appliedPromptTemplateType === 'image_to_image') {
      setPromptTemplateReferenceNotice(undefined)
    }
  }, [appliedPromptTemplateType, referenceImages.length])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    messagesByConversationIdRef.current = messagesByConversationId
  }, [messagesByConversationId])

  useLayoutEffect(() => {
    const didConversationChange = lastRenderedConversationIdRef.current !== activeConversationId
    const requestedScrollBehavior = pendingScrollBehaviorRef.current

    if (didConversationChange) {
      lastRenderedConversationIdRef.current = activeConversationId
      lastConversationSwitchAtRef.current = Date.now()
    }

    if (didConversationChange || requestedScrollBehavior === 'auto') {
      pendingScrollBehaviorRef.current = undefined
      scrollToConversationEnd('auto')
      scheduleScrollToConversationEnd('auto')
      return
    }

    if (requestedScrollBehavior) {
      pendingScrollBehaviorRef.current = undefined
      scrollToConversationEnd(requestedScrollBehavior)
      return
    }

    if (isNearConversationEndRef.current) {
      scrollToConversationEnd('smooth')
    }
  }, [activeConversationId, messages, scheduleScrollToConversationEnd, scrollToConversationEnd])

  useEffect(() => {
    let isMounted = true
    const imageToolApi = getImageToolApi()
    const diagnostics = getBridgeDiagnostics()
    setIsBridgeReady(diagnostics.hasBridge)

    void imageToolApi?.getSettings?.().then((settings) => {
      if (!isMounted) {
        return
      }

      setProviderTemplateId(settings.providerTemplateId)
      setBaseUrl(settings.baseUrl)
      setEndpointPath(settings.endpointPath)
      setEditEndpointPath(settings.editEndpointPath)
      setModel(settings.model)
      setQuality(settings.quality)
      setOutputFormat(settings.outputFormat)
      setSendOutputFormat(settings.sendOutputFormat)
      setSendResponseFormat(settings.sendResponseFormat)
      setResponseFormat(settings.responseFormat ?? 'b64_json')
      setCustomProviderTemplates(settings.customProviderTemplates)
      setProviderCredentials(settings.providerCredentials)
      setSaveApiKey(settings.saveApiKey)
      setDefaultUnitPrice(settings.defaultUnitPrice)
      setCurrency(settings.currency)
      setProviderUnitPrices(settings.providerUnitPrices)
      setUsageDefaultPriceDraft(String(settings.defaultUnitPrice))
      setUsageProviderPriceDraft(
        String(settings.providerUnitPrices[settings.providerTemplateId] ?? settings.defaultUnitPrice)
      )
      setAppearanceTheme(settings.appearanceTheme)
      setSettingsDraft(
        createApiSettingsDraft({
          providerTemplateId: settings.providerTemplateId,
          baseUrl: settings.baseUrl,
          endpointPath: settings.endpointPath,
          editEndpointPath: settings.editEndpointPath,
          apiKey: getProviderCredentialApiKey(settings.providerCredentials, settings.providerTemplateId),
          model: settings.model,
          outputFormat: settings.outputFormat,
          sendOutputFormat: settings.sendOutputFormat,
          sendResponseFormat: settings.sendResponseFormat,
          responseFormat: settings.responseFormat ?? 'b64_json',
          providerCredentials: settings.providerCredentials,
          customProviderTemplates: settings.customProviderTemplates
        })
      )
      setSizeMode(settings.sizeMode)
      setFixedSize(settings.sizePreset as ImageSizePreset)
    })
    void runPreviewSelfTest().then((result) => {
      if (isMounted) {
        setPreviewSelfTest(result)
      }
    })
    void imageToolApi?.getSessionState?.().then((state) => {
      if (!isMounted) {
        return
      }

      applySessionState(state)
      void loadHistoryMessages(state.activeConversationId)
    })
    void loadPromptTemplateLibrary()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'
  }, [language])

  useEffect(() => {
    document.documentElement.dataset.theme = appearanceTheme
  }, [appearanceTheme])

  useEffect(() => {
    writeStoredStringArray(COLLAPSED_PROJECT_IDS_STORAGE_KEY, Array.from(collapsedProjectIds))
  }, [collapsedProjectIds])

  useEffect(() => {
    writeStoredValue(PROMPT_TEMPLATE_CARD_SCALE_STORAGE_KEY, promptTemplateCardScale)
  }, [promptTemplateCardScale])

  useEffect(() => {
    setUsageProviderPriceDraft(String(providerUnitPrices[providerTemplateId] ?? defaultUnitPrice))
  }, [defaultUnitPrice, providerTemplateId, providerUnitPrices])

  useEffect(() => {
    if (usageOpen) {
      void loadTaskUsage(usageRecordFilters)
    }
  }, [loadTaskUsage, usageOpen, usageRecordFilters])

  useEffect(() => {
    if (!isLanguageMenuOpen) {
      return undefined
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!languageMenuRef.current?.contains(event.target as Node)) {
        setIsLanguageMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isLanguageMenuOpen])

  useEffect(() => {
    if (!isThemeMenuOpen) {
      return undefined
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!themeMenuRef.current?.contains(event.target as Node)) {
        setIsThemeMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isThemeMenuOpen])

  useEffect(() => {
    const imageToolApi = getImageToolApi()
    const diagnostics = getBridgeDiagnostics()
    setIsBridgeReady(diagnostics.hasBridge)

    const unsubscribe = imageToolApi?.onImageTaskEvent?.((event) => {
      if (usageOpen) {
        void loadTaskUsage(usageRecordFilters)
      }

      const eventConversationId =
        event.task.request.conversationId ??
        taskConversationIdRef.current[event.task.id] ??
        activeConversationIdRef.current

      if (eventConversationId) {
        taskConversationIdRef.current[event.task.id] = eventConversationId
      }

      if (event.task.status === 'succeeded' || event.task.status === 'failed') {
        const localJobId = taskIdToLocalJobIdRef.current[event.task.id]
        const localJob =
          (localJobId ? runningImageJobsRef.current.get(localJobId) : undefined) ??
          Array.from(runningImageJobsRef.current.values()).find((job) => {
            return (
              job.conversationId === eventConversationId &&
              job.request.prompt === event.task.request.prompt &&
              job.request.model === event.task.request.model
            )
          })

        if (localJob) {
          runningImageJobsRef.current.delete(localJob.id)
          delete taskIdToLocalJobIdRef.current[event.task.id]

          if (
            event.task.status === 'failed' &&
            isConcurrencyLimitErrorMessage(event.task.error?.message) &&
            localJob.retryCount < IMAGE_TASK_CONCURRENCY_RETRY_LIMIT
          ) {
            queuedImageJobsRef.current.unshift({
              ...localJob,
              retryCount: localJob.retryCount + 1,
              status: 'queued'
            })
            setAssistantMessageStatus(localJob.conversationId, localJob.assistantMessageId, 'queued')
            window.setTimeout(processImageTaskQueue, IMAGE_TASK_CONCURRENCY_RETRY_DELAY_MS)
            return
          }
        }

        void imageToolApi?.getSessionState?.().then(applySessionState)
      }

      const updateMessages = (historyItem?: ImageToolHistoryItem) => {
        updateConversationMessages(eventConversationId, (currentMessages) => {
          const messagesForTask = ensureMessagesForTask(currentMessages, event.task)

          return messagesForTask.map((message) => {
            if (message.taskId !== event.task.id || message.kind !== 'generating') {
              return message
            }

            const nextMessage = taskToResultMessage(message, event.task, currentCopy)

            if (nextMessage.kind === 'error' && !nextMessage.error?.message) {
              return {
                ...nextMessage,
                error: {
                  code: event.task.error?.code,
                  message: currentCopy.imageGenerationFailed
                }
              }
            }

            if (nextMessage.kind === 'image_result' && historyItem) {
              return {
                ...nextMessage,
                historyId: historyItem.id,
                imageDataUrl: historyItem.imageDataUrl,
                imageFileName: historyItem.imageFileName,
                result: nextMessage.result?.ok
                  ? {
                      ...nextMessage.result,
                      images: [
                        {
                          ...nextMessage.result.images[0],
                          previewDataUrl: historyItem.imageDataUrl
                        }
                      ],
                      historyId: historyItem.id,
                      previewDataUrl: historyItem.imageDataUrl,
                      imageMimeType: historyItem.imageMimeType,
                      imageFileName: historyItem.imageFileName
                    }
                  : nextMessage.result
              }
            }

            return nextMessage
          })
        })
      }
      const updateTerminalMessages = (historyItem?: ImageToolHistoryItem) => {
        updateMessages(historyItem)
        processImageTaskQueue()
      }

      if (event.task.status === 'succeeded') {
        if (event.task.result?.previewDataUrl) {
          updateTerminalMessages()
          return
        }

        const historyPromise = imageToolApi?.listHistory?.(eventConversationId)

        if (!historyPromise) {
          updateTerminalMessages()
          return
        }

        void historyPromise
          .then(async (history) => {
            const historyItem = history.find((item) => item.taskId === event.task.id)

            if (!historyItem) {
              updateTerminalMessages()
              return
            }

            updateTerminalMessages({
              ...historyItem,
              imageDataUrl: await imageToolApi.readHistoryImage(historyItem.id)
            })
          })
          .catch(() => updateTerminalMessages())
        return
      }

      updateMessages()

      if (event.task.status === 'failed') {
        processImageTaskQueue()
      }
    })

    return () => {
      unsubscribe?.()
    }
  }, [activeConversationId, currentCopy, loadTaskUsage, processImageTaskQueue, usageOpen, usageRecordFilters])

  useEffect(() => {
    if (!lightboxMessage) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLightboxMessage(undefined)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [lightboxMessage])

  useEffect(() => {
    const promptInput = promptInputRef.current

    if (!promptInput) {
      return
    }

    promptInput.style.height = 'auto'
    promptInput.style.height = `${Math.min(promptInput.scrollHeight, MAX_COMPOSER_PROMPT_HEIGHT)}px`
  }, [prompt])

  const validateComposerParams = (
    params: ConversationParams
  ): { ok: true } | { ok: false; message: ConversationMessage } => {
    if (!params.model.trim()) {
      return {
        ok: false,
        message: toValidationErrorMessage({ code: 'missing_model', message: currentCopy.modelRequired }, language)
      }
    }

    if (!params.size.trim()) {
      return {
        ok: false,
        message: toValidationErrorMessage({ code: 'missing_size', message: currentCopy.sizeRequired }, language)
      }
    }

    const sizeValidationError = validateComposerSize(params.size, language)

    if (sizeValidationError) {
      return {
        ok: false,
        message: toValidationErrorMessage(sizeValidationError, language)
      }
    }

    if (!isComposerQuality(params.quality)) {
      return {
        ok: false,
        message: toValidationErrorMessage({ code: 'invalid_quality', message: currentCopy.quality }, language)
      }
    }

    if (!isComposerOutputFormat(params.outputFormat)) {
      return {
        ok: false,
        message: toValidationErrorMessage({ code: 'invalid_output_format', message: currentCopy.format }, language)
      }
    }

    return { ok: true }
  }

  const buildComposerParams = (
    nextPrompt: string,
    mode: ComposerMode,
    paramsOverride?: ConversationParams,
    referenceImagesOverride?: ReferenceImageDraft[],
    maskOverride?: ReferenceImageDraft,
    editSubmitMetadataOverride?: ImageToolEditSubmitMetadata
  ): ComposerValidationResult => {
    const trimmedPrompt = nextPrompt.trim()
    const trimmedBaseUrl = baseUrl.trim()
    const trimmedApiKey = currentApiKey.trim()
    const trimmedModel = (paramsOverride?.model ?? model).trim()
    const effectiveMode: ComposerMode = paramsOverride?.mode ?? mode
    const sourceReferenceImage =
      effectiveMode === 'image_edit' && editingSource ? createReferenceImageFromEditingSource(editingSource) : undefined
    const currentReferenceImages =
      referenceImagesOverride ??
      (effectiveMode === 'image_edit'
        ? sourceReferenceImage
          ? [sourceReferenceImage]
          : []
        : effectiveMode === 'image_reference'
          ? referenceImages
          : [])
    const resolvedParams: ConversationParams = {
      mode: effectiveMode,
      model: trimmedModel || COMPOSER_MODEL_PRESET,
      size: paramsOverride?.size ?? (resolvedSize.ok ? resolvedSize.value.size : ''),
      quality: paramsOverride?.quality ?? quality,
      outputFormat: paramsOverride?.outputFormat ?? outputFormat,
      n: paramsOverride?.n ?? 1
    }

    if (!trimmedPrompt) {
      return {
        ok: false,
        message: toValidationErrorMessage(
          {
            code: 'missing_prompt',
            message: effectiveMode === 'image_edit' ? currentCopy.editPromptRequired : currentCopy.promptRequired
          },
          language
        )
      }
    }

    if (!trimmedBaseUrl) {
      return {
        ok: false,
        message: toValidationErrorMessage({ code: 'missing_base_url', message: currentCopy.baseUrlRequired }, language)
      }
    }

    if (!trimmedModel) {
      return {
        ok: false,
        message: toValidationErrorMessage({ code: 'missing_model', message: currentCopy.modelRequired }, language)
      }
    }

    if (effectiveMode === 'image_edit') {
      if (!editingSource) {
        return {
          ok: false,
          message: toValidationErrorMessage(
            { code: 'missing_edit_source', message: currentCopy.editModeNeedsSource },
            language
          )
        }
      }

      if (!maskOverride) {
        return {
          ok: false,
          message: toValidationErrorMessage({ code: 'missing_mask', message: currentCopy.maskRequired }, language)
        }
      }

      if (currentReferenceImages.length === 0) {
        return {
          ok: false,
          message: toValidationErrorMessage(
            { code: 'missing_edit_source', message: currentCopy.editModeNeedsSource },
            language
          )
        }
      }

      if (currentReferenceImages.length > 1) {
        return {
          ok: false,
          message: toValidationErrorMessage(
            { code: 'too_many_reference_images', message: currentCopy.referenceImageLimitEdit },
            language
          )
        }
      }
    }

    if (effectiveMode === 'image_reference') {
      const referenceImageTotalBytes = currentReferenceImages.reduce((total, image) => total + image.size, 0)

      if (currentReferenceImages.length === 0) {
        return {
          ok: false,
          message: toValidationErrorMessage(
            { code: 'missing_reference_image', message: currentCopy.referenceImageRequired },
            language
          )
        }
      }

      if (currentReferenceImages.length > MAX_REFERENCE_IMAGES) {
        return {
          ok: false,
          message: toValidationErrorMessage(
            { code: 'too_many_reference_images', message: currentCopy.referenceImageTooMany },
            language
          )
        }
      }

      if (referenceImageTotalBytes > MAX_REFERENCE_IMAGE_TOTAL_BYTES) {
        return {
          ok: false,
          message: toValidationErrorMessage(
            { code: 'reference_images_too_large', message: currentCopy.referenceImageTooLarge },
            language
          )
        }
      }
    }

    const validation = validateComposerParams(resolvedParams)

    if (!validation.ok) {
      return validation
    }

    if (effectiveMode === 'image_generation') {
      return {
        ok: true,
        params: resolvedParams,
        request: {
          conversationId: activeConversationId,
          baseUrl: trimmedBaseUrl,
          apiKey: trimmedApiKey,
          endpointPath: normalizeEndpointPath(endpointPath),
          providerTemplateId,
          providerTemplateName: currentProviderTemplateLabel,
          projectId: activeProjectId,
          model: trimmedModel,
          prompt: trimmedPrompt,
          size: resolvedParams.size,
          quality: resolvedParams.quality,
          outputFormat: resolvedParams.outputFormat,
          sendOutputFormat,
          sendResponseFormat,
          responseFormat
        }
      }
    }

    return {
      ok: true,
      params: resolvedParams,
      request: {
        conversationId: activeConversationId,
        baseUrl: trimmedBaseUrl,
        apiKey: trimmedApiKey,
        endpointPath: normalizeEndpointPath(endpointPath),
        editEndpointPath: normalizeEditEndpointPath(editEndpointPath),
        providerTemplateId,
        providerTemplateName: currentProviderTemplateLabel,
        projectId: activeProjectId,
        model: trimmedModel,
        prompt: trimmedPrompt,
        size: resolvedParams.size,
        quality: resolvedParams.quality,
        outputFormat: resolvedParams.outputFormat,
        sendOutputFormat,
        sendResponseFormat,
        responseFormat,
        n: 1,
        editMode: effectiveMode === 'image_reference' ? 'reference' : 'masked_edit',
        images: currentReferenceImages.map((image) => ({
          ...image,
          fileType: image.fileType ?? image.mimeType
        })),
        ...(maskOverride
          ? {
              mask: {
                ...maskOverride,
                fileType: maskOverride.fileType ?? maskOverride.mimeType
              }
            }
          : {}),
        ...editSubmitMetadataOverride
      }
    }
  }

  const runImageTask = async (
    nextPrompt: string,
    mode: ComposerMode,
    paramsOverride?: ConversationParams,
    referenceImagesOverride?: ReferenceImageDraft[],
    maskOverride?: ReferenceImageDraft,
    editSubmitMetadataOverride?: ImageToolEditSubmitMetadata
  ) => {
    const submissionConversationId = activeConversationIdRef.current ?? activeConversationId

    const snapshot = buildComposerParams(
      nextPrompt,
      paramsOverride?.mode ?? mode,
      paramsOverride,
      referenceImagesOverride,
      maskOverride,
      editSubmitMetadataOverride
    )
    const imageToolApi = getImageToolApi()
    const diagnostics = getBridgeDiagnostics()
    setIsBridgeReady(diagnostics.hasBridge)

    if (!snapshot.ok) {
      requestScrollToConversationEnd('smooth')
      updateConversationMessages(submissionConversationId, (currentMessages) => [
        ...currentMessages,
        {
          ...snapshot.message,
          conversationId: submissionConversationId
        }
      ])
      return
    }

    if (!hasImageToolBridge(imageToolApi)) {
      requestScrollToConversationEnd('smooth')
      updateConversationMessages(submissionConversationId, (currentMessages) => [
        ...currentMessages,
        {
          ...toErrorMessage('missing_bridge', currentCopy.missingBridge),
          conversationId: submissionConversationId
        }
      ])
      return
    }

    const sourceReferenceImage =
      snapshot.params.mode === 'image_edit' && editingSource
        ? createReferenceImageFromEditingSource(editingSource)
        : undefined
    const taskReferenceImages =
      referenceImagesOverride ??
      (snapshot.params.mode === 'image_edit'
        ? sourceReferenceImage
          ? [sourceReferenceImage]
          : []
        : snapshot.params.mode === 'image_reference'
          ? referenceImages
          : [])
    const messageReferenceImages =
      snapshot.params.mode === 'image_edit' || snapshot.params.mode === 'image_reference' ? taskReferenceImages : []
    const request = {
      ...snapshot.request,
      conversationId: submissionConversationId
    }
    const promptMessage: ConversationMessage = {
      id: createMessageId(),
      conversationId: submissionConversationId,
      role: 'user',
      kind: 'prompt',
      createdAt: Date.now(),
      prompt: request.prompt,
      params: snapshot.params,
      referenceImages: messageReferenceImages.length > 0 ? messageReferenceImages : undefined
    }
    const generatingMessage: ConversationMessage = {
      id: createMessageId(),
      conversationId: submissionConversationId,
      role: 'assistant',
      kind: 'generating',
      createdAt: Date.now(),
      prompt: request.prompt,
      params: snapshot.params,
      referenceImages: messageReferenceImages.length > 0 ? messageReferenceImages : undefined,
      status: 'queued',
      relatedMessageId: promptMessage.id
    }

    requestScrollToConversationEnd('smooth')
    updateConversationMessages(submissionConversationId, (currentMessages) => [
      ...currentMessages,
      promptMessage,
      generatingMessage
    ])
    setPrompt('')
    setAppliedPromptTemplateType(undefined)
    setPromptTemplateReferenceNotice(undefined)

    enqueueImageJob({
      id: createMessageId(),
      conversationId: submissionConversationId,
      userMessageId: promptMessage.id,
      assistantMessageId: generatingMessage.id,
      mode: snapshot.params.mode ?? mode,
      params: snapshot.params,
      request,
      referenceImages: messageReferenceImages.length > 0 ? messageReferenceImages : undefined
    })

    if (snapshot.params.mode === 'image_reference') {
      setReferenceImages([])
      setReferenceUploadError(undefined)
    }
  }

  const submitComposerPrompt = async () => {
    if (appliedPromptTemplateType === 'image_to_image' && referenceImages.length === 0) {
      setPromptTemplateReferenceNotice(currentCopy.imageToImageTemplateNotice)
      setReferenceUploadError(currentCopy.imageToImageTemplateNotice)
      return
    }

    if (!prompt.trim()) {
      showToast(currentCopy.promptRequired)
      promptInputRef.current?.focus()
      return
    }

    if (!hasActiveConversation) {
      const imageToolApi = getImageToolApi()
      const diagnostics = getBridgeDiagnostics()
      setIsBridgeReady(diagnostics.hasBridge)

      if (!hasImageToolBridge(imageToolApi)) {
        showToast(currentCopy.missingBridge)
        return
      }

      const state = await imageToolApi.createConversation(targetProjectId)
      applySessionState(state)
      await loadHistoryMessages(state.activeConversationId)

      if (!state.activeConversationId) {
        showToast(currentCopy.selectOrCreateChat)
        return
      }
    }

    await runImageTask(prompt, referenceImages.length > 0 ? 'image_reference' : 'image_generation')
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void submitComposerPrompt()
  }

  const submitImageEditFromWorkspace = async (
    nextPrompt: string,
    mask: MaskEditExport,
    editSubmitMode: ImageToolEditSubmitMode
  ): Promise<boolean> => {
    const submissionConversationId = activeConversationIdRef.current ?? activeConversationId
    const imageToolApi = getImageToolApi()
    const diagnostics = getBridgeDiagnostics()
    setIsBridgeReady(diagnostics.hasBridge)

    if (!editingSource) {
      setImageEditError({
        code: 'missing_edit_source',
        message: currentCopy.editModeNeedsSource
      })
      return false
    }

    const trimmedPrompt = nextPrompt.trim()

    if (!trimmedPrompt) {
      setImageEditError({
        code: 'missing_prompt',
        message: currentCopy.editPromptRequired
      })
      return false
    }

    if (!hasImageToolBridge(imageToolApi)) {
      setImageEditError({
        code: 'missing_bridge',
        message: currentCopy.missingBridge
      })
      return false
    }

    const sourceWidth = Math.round(editingSource.naturalWidth ?? editingSource.width ?? 0)
    const sourceHeight = Math.round(editingSource.naturalHeight ?? editingSource.height ?? 0)

    if (!sourceWidth || !sourceHeight) {
      setImageEditError({
        code: 'source_image_size_missing',
        message: currentCopy.sourceImageSizeMissing
      })
      return false
    }

    if (mask.mimeType !== 'image/png' || !mask.dataUrl.startsWith('data:image/png;base64,')) {
      setImageEditError({
        code: 'invalid_mask_png',
        message: currentCopy.maskPngRequired
      })
      return false
    }

    if (mask.width !== sourceWidth || mask.height !== sourceHeight) {
      setImageEditError({
        code: 'mask_size_mismatch',
        message: currentCopy.maskSizeMismatch
      })
      return false
    }

    if (!mask.hasTransparentPixels) {
      setImageEditError({
        code: 'missing_mask',
        message: currentCopy.maskRequired
      })
      return false
    }

    if (mask.transparentAlpha !== 0 || mask.opaqueAlpha !== 255) {
      setImageEditError({
        code: 'mask_alpha_invalid',
        message: currentCopy.maskAlphaInvalid
      })
      return false
    }

    if (mask.blobSize >= MAX_MASK_IMAGE_BYTES) {
      setImageEditError({
        code: 'mask_too_large',
        message: currentCopy.maskTooLarge
      })
      return false
    }

    let preparedAssets: PreparedEditAssets

    try {
      preparedAssets = await prepareEditAssets({
        editSubmitMode,
        mask,
        source: editingSource
      })
    } catch (error) {
      const code = error instanceof Error ? error.message : 'source_image_normalize_failed'
      setImageEditError({
        code,
        message:
          code === 'source_image_size_missing'
            ? currentCopy.sourceImageSizeMissing
            : code === 'normalized_source_image_too_large'
              ? currentCopy.normalizedSourceImageTooLarge
              : currentCopy.sourceImageNormalizeFailed
      })
      return false
    }

    const snapshot = buildComposerParams(
      trimmedPrompt,
      'image_edit',
      {
        mode: 'image_edit',
        model,
        size: preparedAssets.requestSize,
        quality: editSubmitMode === 'compatible' ? 'low' : quality,
        outputFormat,
        n: 1
      },
      [preparedAssets.sourceReferenceImage],
      preparedAssets.maskReferenceImage,
      preparedAssets.metadata
    )

    if (!snapshot.ok) {
      setImageEditError(snapshot.message.error ?? { code: 'validation_failed', message: currentCopy.maskExportFailed })
      return false
    }

    const request = {
      ...snapshot.request,
      conversationId: submissionConversationId
    }
    const promptMessage: ConversationMessage = {
      id: createMessageId(),
      conversationId: submissionConversationId,
      role: 'user',
      kind: 'prompt',
      createdAt: Date.now(),
      prompt: request.prompt,
      params: snapshot.params,
      referenceImages: [preparedAssets.sourceReferenceImage]
    }
    const generatingMessage: ConversationMessage = {
      id: createMessageId(),
      conversationId: submissionConversationId,
      role: 'assistant',
      kind: 'generating',
      createdAt: Date.now(),
      prompt: request.prompt,
      params: snapshot.params,
      referenceImages: [preparedAssets.sourceReferenceImage],
      status: 'queued',
      relatedMessageId: promptMessage.id
    }

    requestScrollToConversationEnd('smooth')
    updateConversationMessages(submissionConversationId, (currentMessages) => [
      ...currentMessages,
      promptMessage,
      generatingMessage
    ])
    setIsSubmittingImageEdit(true)
    setImageEditError(undefined)

    try {
      enqueueImageJob({
        id: createMessageId(),
        conversationId: submissionConversationId,
        userMessageId: promptMessage.id,
        assistantMessageId: generatingMessage.id,
        mode: 'image_edit',
        params: snapshot.params,
        request,
        referenceImages: [preparedAssets.sourceReferenceImage]
      })
      setPrompt('')
      setEditingSource(undefined)
      setImageEditError(undefined)
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : currentCopy.imageGenerationFailed
      replaceMessage(generatingMessage.id, {
        ...toErrorMessage('generation_failed', message, promptMessage.id),
        conversationId: submissionConversationId
      })
      setImageEditError({
        code: 'generation_failed',
        message
      })
      return false
    } finally {
      setIsSubmittingImageEdit(false)
    }
  }

  const buildEditingSourceFromMessage = async (
    message: ConversationMessage
  ): Promise<EditingSourceImage | undefined> => {
    const params = message.params
    const image = message.result?.ok ? message.result.images[0] : undefined
    const createEditingSource = (previewSource: ImagePreviewSource): EditingSourceImage | undefined => {
      const dataUrl = getImageEditingDataUrl(previewSource)

      if (!dataUrl) {
        return undefined
      }

      const mimeType = getImagePreviewMimeType(previewSource)

      return {
        messageId: message.id,
        historyId: message.historyId,
        fileName: getImageEditingFileName(message, params, mimeType),
        mimeType,
        dataUrl,
        width: image?.width,
        height: image?.height
      }
    }

    const previewDataUrlSource = createEditingSource(
      getImagePreviewSource(
        image?.previewDataUrl ? { previewDataUrl: image.previewDataUrl } : undefined,
        params?.outputFormat
      )
    )

    if (previewDataUrlSource) {
      return previewDataUrlSource
    }

    const messageDataUrlSource = createEditingSource(
      getImagePreviewSource(undefined, params?.outputFormat, message.imageDataUrl)
    )

    if (messageDataUrlSource) {
      return messageDataUrlSource
    }

    const imageToolApi = getImageToolApi()
    const historyImageDataUrl =
      message.historyId && imageToolApi?.readHistoryImage
        ? await imageToolApi.readHistoryImage(message.historyId)
        : undefined

    if (historyImageDataUrl) {
      const historySource = createEditingSource(
        getImagePreviewSource(undefined, params?.outputFormat, historyImageDataUrl)
      )

      if (historySource) {
        return historySource
      }
    }

    const b64JsonSource = createEditingSource(
      getImagePreviewSource(image?.b64Json ? { b64Json: image.b64Json } : undefined, params?.outputFormat)
    )

    if (b64JsonSource) {
      return b64JsonSource
    }

    return createEditingSource(
      getImagePreviewSource(
        image?.url && isDataImageBase64Url(image.url) ? { url: image.url } : undefined,
        params?.outputFormat
      )
    )
  }

  const startEditingFromMessage = async (message: ConversationMessage) => {
    const nextEditingSource = await buildEditingSourceFromMessage(message)

    if (!nextEditingSource) {
      updateConversationMessages(message.conversationId ?? activeConversationIdRef.current, (currentMessages) => [
        ...currentMessages,
        {
          ...toErrorMessage('editing_source_unavailable', currentCopy.editingSourceUnavailable, message.id),
          conversationId: message.conversationId ?? activeConversationIdRef.current
        }
      ])
      return
    }

    try {
      setEditingSource(await normalizeEditingSourceImage(nextEditingSource))
    } catch {
      updateConversationMessages(message.conversationId ?? activeConversationIdRef.current, (currentMessages) => [
        ...currentMessages,
        {
          ...toErrorMessage('editing_source_size_unavailable', currentCopy.sourceImageSizeMissing, message.id),
          conversationId: message.conversationId ?? activeConversationIdRef.current
        }
      ])
      return
    }
    setImageEditError(undefined)
    setLightboxMessage(undefined)
  }

  const cancelEditingSource = () => {
    setEditingSource(undefined)
    setImageEditError(undefined)
  }

  const openImageLightbox = (message: ConversationMessage) => {
    setLightboxMessage(message)
  }

  const closeImageLightbox = () => {
    setLightboxMessage(undefined)
  }

  const handleComposerSizeChange = (nextPreset: ImageSizePreset) => {
    setFixedSize(nextPreset)
    setSizeMode(nextPreset === 'auto' ? 'auto' : 'fixed')
    setComposerPopover(undefined)
  }

  const handleComposerQualityChange = (nextQuality: ImageToolImage2Quality) => {
    setQuality(nextQuality)
    setComposerPopover(undefined)
  }

  const handleComposerOutputFormatChange = (nextOutputFormat: ImageToolImage2OutputFormat) => {
    setOutputFormat(nextOutputFormat)
    setComposerPopover(undefined)
  }

  const toggleComposerPopover = (key: ComposerPopoverKey) => {
    setComposerPopover((currentPopover) => (currentPopover?.key === key ? undefined : { key }))
  }

  const openReferenceImagePicker = () => {
    referenceImageInputRef.current?.click()
  }

  const removeReferenceImage = (id: string) => {
    setReferenceImages((currentImages) => currentImages.filter((image) => image.id !== id))
    setReferenceUploadError(undefined)
  }

  const addReferenceImageFiles = useCallback(
    (selectedFiles: readonly File[]) => {
      if (selectedFiles.length === 0) {
        return false
      }

      const hasUnsupportedFile = selectedFiles.some(
        (file) => !file.type.startsWith('image/') || !isSupportedImageMimeType(file.type)
      )

      if (hasUnsupportedFile) {
        setReferenceUploadError(currentCopy.referenceImageUnsupported)
        return false
      }

      const nextImageCount = referenceImages.length + selectedFiles.length

      if (nextImageCount > MAX_REFERENCE_IMAGES) {
        setReferenceUploadError(currentCopy.referenceImageTooMany)
        return false
      }

      const nextTotalBytes =
        referenceImages.reduce((total, image) => total + image.size, 0) +
        selectedFiles.reduce((total, file) => total + file.size, 0)

      if (nextTotalBytes > MAX_REFERENCE_IMAGE_TOTAL_BYTES) {
        setReferenceUploadError(currentCopy.referenceImageTooLarge)
        return false
      }

      void Promise.all(selectedFiles.map(createReferenceImageFromFile))
        .then((nextImages) => {
          setReferenceImages((currentImages) => [...currentImages, ...nextImages].slice(0, MAX_REFERENCE_IMAGES))
          setReferenceUploadError(undefined)
        })
        .catch(() => {
          setReferenceUploadError(currentCopy.referenceImageUnsupported)
        })

      return true
    },
    [
      currentCopy.referenceImageTooLarge,
      currentCopy.referenceImageTooMany,
      currentCopy.referenceImageUnsupported,
      referenceImages
    ]
  )

  const handleReferenceImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    addReferenceImageFiles(selectedFiles)
  }

  const getTransferImageFiles = (files: FileList | readonly File[]): File[] => {
    return Array.from(files).filter(
      (file) => file.type.startsWith('image/') || /\.(png|jpe?g|webp|svg)$/i.test(file.name)
    )
  }

  const getClipboardImageFiles = (event: ClipboardEvent<HTMLElement>): File[] => {
    const clipboardFiles = getTransferImageFiles(event.clipboardData.files)

    if (clipboardFiles.length > 0) {
      return clipboardFiles
    }

    return Array.from(event.clipboardData.items)
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file))
  }

  const hasFileTransfer = (event: DragEvent<HTMLElement>): boolean => {
    return Array.from(event.dataTransfer.types).includes('Files')
  }

  const handleReferencePaste = (event: ClipboardEvent<HTMLElement>) => {
    const selectedFiles = getClipboardImageFiles(event)

    if (selectedFiles.length === 0) {
      return
    }

    event.preventDefault()
    addReferenceImageFiles(selectedFiles)
  }

  const handleReferenceDragEnter = (event: DragEvent<HTMLElement>) => {
    if (!hasFileTransfer(event)) {
      return
    }

    event.preventDefault()
    referenceDragDepthRef.current += 1
    setIsReferenceDropActive(true)
  }

  const handleReferenceDragOver = (event: DragEvent<HTMLElement>) => {
    if (!hasFileTransfer(event)) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setIsReferenceDropActive(true)
  }

  const handleReferenceDragLeave = (event: DragEvent<HTMLElement>) => {
    if (!hasFileTransfer(event)) {
      return
    }

    event.preventDefault()
    referenceDragDepthRef.current = Math.max(0, referenceDragDepthRef.current - 1)

    if (referenceDragDepthRef.current === 0) {
      setIsReferenceDropActive(false)
    }
  }

  const handleReferenceDrop = (event: DragEvent<HTMLElement>) => {
    if (!hasFileTransfer(event)) {
      return
    }

    event.preventDefault()
    referenceDragDepthRef.current = 0
    setIsReferenceDropActive(false)
    addReferenceImageFiles(getTransferImageFiles(event.dataTransfer.files))
  }

  const handleRegenerate = (message: ConversationMessage) => {
    if (!message.prompt || !message.params) {
      return
    }

    if (message.params.mode === 'image_edit') {
      updateConversationMessages(message.conversationId ?? activeConversationIdRef.current, (currentMessages) => [
        ...currentMessages,
        {
          ...toErrorMessage('missing_mask_for_regenerate', currentCopy.editModeNeedsSource, message.id),
          conversationId: message.conversationId ?? activeConversationIdRef.current
        }
      ])
      return
    }

    if (message.params.mode === 'image_reference') {
      if (!message.referenceImages?.length) {
        updateConversationMessages(message.conversationId ?? activeConversationIdRef.current, (currentMessages) => [
          ...currentMessages,
          {
            ...toErrorMessage('reference_images_not_saved', currentCopy.referenceImageNotSaved, message.id),
            conversationId: message.conversationId ?? activeConversationIdRef.current
          }
        ])
        return
      }

      void runImageTask(message.prompt, 'image_reference', message.params, message.referenceImages)
      return
    }

    void runImageTask(message.prompt, message.params.mode ?? 'image_generation', message.params)
  }

  const handleDownload = (message: ConversationMessage) => {
    const image = message.result?.ok ? message.result.images[0] : undefined
    const params = message.params

    if (!params) {
      return
    }

    const imagePreview = getImagePreviewSource(image, params.outputFormat, message.imageDataUrl)
    const downloadHref = getImageDownloadHref(imagePreview)

    if (!downloadHref) {
      return
    }

    const anchor = document.createElement('a')
    anchor.href = downloadHref
    const resultFileName = message.result?.ok ? message.result.imageFileName : undefined
    anchor.download =
      message.imageFileName ??
      resultFileName ??
      buildDownloadName(params, message.createdAt, message.taskId ?? message.historyId)
    anchor.click()
  }

  const handleDeleteHistory = async (message: ConversationMessage) => {
    const imageToolApi = getImageToolApi()

    if (!message.historyId || !imageToolApi?.deleteHistoryItem) {
      return
    }

    await imageToolApi.deleteHistoryItem(message.historyId)
    updateConversationMessages(message.conversationId ?? activeConversationIdRef.current, (currentMessages) =>
      currentMessages.filter((currentMessage) => currentMessage.historyId !== message.historyId)
    )
    void imageToolApi.getSessionState().then(applySessionState)
  }

  const applyPromptTemplateToComposer = (
    template: ImageToolPromptTemplate,
    nextPrompt: string,
    applyMode: PromptTemplateApplyMode
  ) => {
    setPrompt((currentPrompt) => {
      if (applyMode === 'append' && currentPrompt.trim()) {
        return `${currentPrompt.trim()}\n${nextPrompt}`
      }

      return nextPrompt
    })
    setAppliedPromptTemplateType(template.templateType)
    setPromptTemplateReferenceNotice(
      template.templateType === 'image_to_image' ? currentCopy.imageToImageTemplateNotice : undefined
    )
    setReferenceUploadError(undefined)
    setPromptTemplateVariableDialog(undefined)
    setIsPromptLibraryOpen(false)
    window.setTimeout(() => promptInputRef.current?.focus(), 0)
  }

  const handleUsePromptTemplate = (template: ImageToolPromptTemplate) => {
    if (template.variables?.length) {
      const values = template.variables.reduce<Record<string, string>>((result, variable) => {
        result[variable.key] = variable.defaultValue ?? ''
        return result
      }, {})

      setPromptTemplateVariableDialog({
        template,
        values,
        applyMode: 'replace'
      })
      return
    }

    applyPromptTemplateToComposer(template, template.prompt, 'replace')
  }

  const handleApplyPromptTemplateVariables = () => {
    if (!promptTemplateVariableDialog) {
      return
    }

    const missingRequiredVariable = promptTemplateVariableDialog.template.variables?.some((variable) => {
      return variable.required && !promptTemplateVariableDialog.values[variable.key]?.trim()
    })

    if (missingRequiredVariable) {
      setPromptTemplateVariableDialog({
        ...promptTemplateVariableDialog,
        error: currentCopy.requiredVariableMissing
      })
      return
    }

    applyPromptTemplateToComposer(
      promptTemplateVariableDialog.template,
      applyPromptTemplateValues(promptTemplateVariableDialog.template, promptTemplateVariableDialog.values),
      promptTemplateVariableDialog.applyMode
    )
  }

  const handleCopyPromptTemplate = async (template: ImageToolPromptTemplate) => {
    await navigator.clipboard.writeText(template.prompt)
    setPromptLibraryStatus(currentCopy.templateCopied)
  }

  const handleSavePromptTemplateDraft = async (draft: PromptTemplateEditorDraft) => {
    const imageToolApi = getImageToolApi()

    if (!hasImageToolBridge(imageToolApi)) {
      setPromptLibraryStatus(currentCopy.missingBridge)
      return
    }

    if (!draft.title.trim() || !draft.prompt.trim()) {
      setPromptLibraryStatus(currentCopy.promptRequired)
      return
    }

    const input = promptTemplateEditorDraftToInput(draft)

    if (draft.sourceHistoryId || draft.sourceImageDataUrl) {
      await imageToolApi.saveImageResultAsPromptTemplate({
        ...input,
        historyId: draft.sourceHistoryId,
        imageDataUrl: draft.sourceImageDataUrl
      })
    } else {
      await imageToolApi.savePromptTemplate(input)
    }

    setPromptTemplateEditorDraft(undefined)
    setPromptLibraryStatus(currentCopy.templateSaved)
    await loadPromptTemplateLibrary()
  }

  const handleDeletePromptTemplate = async (template: ImageToolPromptTemplate) => {
    const confirmed = await requestConfirmation({
      message: currentCopy.confirmDeletePromptTemplate,
      title: currentCopy.deletePromptTemplate
    })

    if (!confirmed) {
      return
    }

    const imageToolApi = getImageToolApi()

    if (!hasImageToolBridge(imageToolApi)) {
      setPromptLibraryStatus(currentCopy.missingBridge)
      return
    }

    await imageToolApi.deletePromptTemplate(template.id)
    setPromptTemplates((currentTemplates) =>
      currentTemplates.filter((currentTemplate) => currentTemplate.id !== template.id)
    )
    setPromptLibraryStatus(currentCopy.templateDeleted)
  }

  const togglePromptTemplateSelection = (templateId: string, selected: boolean) => {
    setSelectedPromptTemplateIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (selected) {
        nextIds.add(templateId)
      } else {
        nextIds.delete(templateId)
      }

      return nextIds
    })
  }

  const toggleVisiblePromptTemplateSelection = () => {
    setSelectedPromptTemplateIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (areAllVisiblePromptTemplatesSelected) {
        for (const template of filteredPromptTemplates) {
          nextIds.delete(template.id)
        }
      } else {
        for (const template of filteredPromptTemplates) {
          nextIds.add(template.id)
        }
      }

      return nextIds
    })
  }

  const clearPromptTemplateSelection = () => {
    setSelectedPromptTemplateIds(new Set())
  }

  const handleDeleteSelectedPromptTemplates = async () => {
    const templateIds = [...selectedPromptTemplateIds]

    if (templateIds.length === 0) {
      return
    }

    const confirmed = await requestConfirmation({
      message: currentCopy.confirmDeleteSelectedPromptTemplates.replace('{count}', String(templateIds.length)),
      title: currentCopy.deleteSelectedTemplates
    })

    if (!confirmed) {
      return
    }

    const imageToolApi = getImageToolApi()

    if (!hasImageToolBridge(imageToolApi)) {
      setPromptLibraryStatus(currentCopy.missingBridge)
      return
    }

    const deletedCount = await imageToolApi.deletePromptTemplates(templateIds)
    setSelectedPromptTemplateIds(new Set())
    setPromptLibraryStatus(currentCopy.selectedTemplatesDeleted.replace('{count}', String(deletedCount)))
    await loadPromptTemplateLibrary()
  }

  const handleMoveSelectedPromptTemplates = async (categoryId: string) => {
    const templateIds = [...selectedPromptTemplateIds]

    if (templateIds.length === 0) {
      return
    }

    const imageToolApi = getImageToolApi()

    if (!hasImageToolBridge(imageToolApi)) {
      setPromptLibraryStatus(currentCopy.missingBridge)
      return
    }

    const movedCount = await imageToolApi.movePromptTemplatesToCategory(templateIds, categoryId)
    setSelectedPromptTemplateIds(new Set())
    setSelectedPromptTemplateCategoryId(categoryId)
    setPromptLibraryStatus(currentCopy.selectedTemplatesMoved.replace('{count}', String(movedCount)))
    await loadPromptTemplateLibrary()
  }

  const handleExportSelectedPromptTemplates = async () => {
    const templateIds = [...selectedPromptTemplateIds]

    if (templateIds.length === 0) {
      return
    }

    const imageToolApi = getImageToolApi()

    if (!hasImageToolBridge(imageToolApi)) {
      setPromptLibraryStatus(currentCopy.missingBridge)
      return
    }

    const result = await imageToolApi.exportPromptTemplates(templateIds)
    setPromptLibraryStatus(currentCopy.templateExported.replace('{fileName}', result.fileName))
  }

  const handleExportPromptTemplate = async (template: ImageToolPromptTemplate) => {
    const imageToolApi = getImageToolApi()

    if (!hasImageToolBridge(imageToolApi)) {
      setPromptLibraryStatus(currentCopy.missingBridge)
      return
    }

    const result = await imageToolApi.exportPromptTemplate(template.id)
    setPromptLibraryStatus(currentCopy.templateExported.replace('{fileName}', result.fileName))
  }

  const handlePromptTemplateImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []) as (File & { path?: string })[]
    event.currentTarget.value = ''

    const imageToolApi = getImageToolApi()

    if (!hasImageToolBridge(imageToolApi)) {
      setPromptLibraryStatus(currentCopy.missingBridge)
      return
    }

    if (files.length === 0) {
      setPromptLibraryStatus(currentCopy.importFileNeedsPath)
      return
    }

    const totalResult: ImageToolPromptTemplateImportResult = {
      imported: 0,
      skipped: 0,
      updated: 0,
      errors: []
    }

    for (const file of files) {
      const filePath = imageToolApi.getFilePath(file) || file.path
      const result = filePath
        ? await imageToolApi.importPromptTemplateFile(filePath)
        : await imageToolApi.importPromptTemplateFileContent(file.name, await file.text())

      totalResult.imported += result.imported
      totalResult.skipped += result.skipped
      totalResult.updated = (totalResult.updated ?? 0) + (result.updated ?? 0)
      totalResult.errors.push(...result.errors)
    }

    setPromptLibraryStatus(formatPromptTemplateImportResult(totalResult, currentCopy))
    await loadPromptTemplateLibrary()
  }

  const handleScanPromptTemplateImports = async () => {
    const imageToolApi = getImageToolApi()

    if (!hasImageToolBridge(imageToolApi)) {
      setPromptLibraryStatus(currentCopy.missingBridge)
      return
    }

    const result = await imageToolApi.scanPromptTemplateImports()
    setPromptLibraryStatus(formatPromptTemplateImportResult(result, currentCopy))
    await loadPromptTemplateLibrary()
  }

  const handleExportPromptTemplateCategory = async () => {
    if (selectedPromptTemplateCategoryId === 'all') {
      return
    }

    const imageToolApi = getImageToolApi()

    if (!hasImageToolBridge(imageToolApi)) {
      setPromptLibraryStatus(currentCopy.missingBridge)
      return
    }

    const result = await imageToolApi.exportPromptTemplateCategory(selectedPromptTemplateCategoryId)
    setPromptLibraryStatus(currentCopy.templateExported.replace('{fileName}', result.fileName))
  }

  const handleExportAllPromptTemplates = async () => {
    const imageToolApi = getImageToolApi()

    if (!hasImageToolBridge(imageToolApi)) {
      setPromptLibraryStatus(currentCopy.missingBridge)
      return
    }

    const result = await imageToolApi.exportAllPromptTemplates()
    setPromptLibraryStatus(currentCopy.templateExported.replace('{fileName}', result.fileName))
  }

  const handleOpenPromptTemplateFolder = async () => {
    const imageToolApi = getImageToolApi()

    if (!hasImageToolBridge(imageToolApi)) {
      setPromptLibraryStatus(currentCopy.missingBridge)
      return
    }

    await imageToolApi.openPromptTemplateFolder()
    setPromptLibraryStatus(currentCopy.folderOpened)
  }

  const handleCreatePromptTemplateCategory = async () => {
    setPromptTemplateCategoryDialog({ mode: 'create', name: '' })
  }

  const handleRenamePromptTemplateCategory = async (category: ImageToolPromptTemplateCategory) => {
    setPromptTemplateCategoryDialog({ mode: 'rename', category, name: category.name })
  }

  const handleSavePromptTemplateCategoryDialog = async (dialog: PromptTemplateCategoryDialogState) => {
    const name = dialog.name.trim()

    if (!name) {
      setPromptTemplateCategoryDialog({ ...dialog, error: currentCopy.categoryNamePrompt })
      return
    }

    const imageToolApi = getImageToolApi()

    if (!hasImageToolBridge(imageToolApi)) {
      setPromptLibraryStatus(currentCopy.missingBridge)
      return
    }

    if (dialog.mode === 'create') {
      const category = await imageToolApi.savePromptTemplateCategory({ name })
      setSelectedPromptTemplateCategoryId(category.id)
    } else {
      await imageToolApi.savePromptTemplateCategory({ ...dialog.category, name })
    }

    setPromptTemplateCategoryDialog(undefined)
    setPromptLibraryStatus(currentCopy.categorySaved)
    await loadPromptTemplateLibrary()
  }

  const handleDeletePromptTemplateCategory = async (category: ImageToolPromptTemplateCategory) => {
    if (category.id === PROMPT_TEMPLATE_UNCATEGORIZED_ID) {
      return
    }

    const confirmed = await requestConfirmation({
      message: currentCopy.confirmDeletePromptCategory,
      title: currentCopy.deleteCategory
    })

    if (!confirmed) {
      return
    }

    const imageToolApi = getImageToolApi()

    if (!hasImageToolBridge(imageToolApi)) {
      setPromptLibraryStatus(currentCopy.missingBridge)
      return
    }

    await imageToolApi.deletePromptTemplateCategory(category.id)
    setSelectedPromptTemplateCategoryId('all')
    setPromptLibraryStatus(currentCopy.categoryDeleted)
    await loadPromptTemplateLibrary()
  }

  const handleSaveImageResultAsTemplate = (message: ConversationMessage) => {
    const params = message.params
    const image = message.result?.ok ? message.result.images[0] : undefined
    const imagePreviewSource = getImagePreviewSource(image, params?.outputFormat, message.imageDataUrl)
    const imageDataUrl = getImageEditingDataUrl(imagePreviewSource)
    const draft = createPromptTemplateEditorDraft(
      selectedPromptTemplateCategoryId === 'all' ? null : selectedPromptTemplateCategoryId
    )

    setPromptTemplateEditorDraft({
      ...draft,
      prompt: message.prompt ?? '',
      templateType: params?.mode === 'image_generation' ? 'text_to_image' : 'image_to_image',
      recommendedSize: params?.size ?? '',
      recommendedQuality: params?.quality ?? '',
      recommendedOutputFormat: params?.outputFormat ?? '',
      previewDataUrl: imageDataUrl,
      sourceHistoryId: message.historyId,
      sourceImageDataUrl: imageDataUrl
    })
    setIsPromptLibraryOpen(true)
  }

  const handleCreateConversation = async () => {
    const imageToolApi = getImageToolApi()

    if (!hasImageToolBridge(imageToolApi)) {
      return
    }

    const state = await imageToolApi.createConversation(targetProjectId)
    applySessionState(state)
    clearComposerState()
    storeConversationMessages(state.activeConversationId, [])
    setIsTrashOpen(false)
  }

  const handleSelectConversation = async (conversationId: string) => {
    const imageToolApi = getImageToolApi()

    if (!hasImageToolBridge(imageToolApi) || conversationId === activeConversationId) {
      return
    }

    const state = await imageToolApi.setActiveConversation(conversationId)
    applySessionState(state)
    clearComposerState()
    await loadHistoryMessages(state.activeConversationId ?? conversationId)
  }

  const handleRenameConversation = async (conversation: ImageToolConversation) => {
    const imageToolApi = getImageToolApi()

    if (!hasImageToolBridge(imageToolApi)) {
      return
    }

    const title = await requestTextInput({
      initialValue: getConversationDisplayTitle(conversation, currentCopy),
      label: currentCopy.conversationTitlePrompt,
      requiredMessage: currentCopy.inputRequired,
      title: currentCopy.rename
    })

    if (!title) {
      return
    }

    applySessionState(await imageToolApi.renameConversation(conversation.id, title))
  }

  const handleMoveConversation = async (conversationId: string, projectId: string | null) => {
    const imageToolApi = getImageToolApi()

    if (!hasImageToolBridge(imageToolApi)) {
      return
    }

    applySessionState(await imageToolApi.moveConversationToProject(conversationId, projectId))
  }

  const handleDeleteConversation = async (conversationId: string) => {
    const imageToolApi = getImageToolApi()

    if (!hasImageToolBridge(imageToolApi)) {
      return
    }

    const confirmed = await requestConfirmation({
      confirmLabel: currentCopy.trash,
      message: currentCopy.confirmDeleteConversation,
      title: currentCopy.trash
    })

    if (!confirmed) {
      return
    }

    const state = await imageToolApi.deleteConversation(conversationId)
    applySessionState(state)
    clearComposerState()
    await loadHistoryMessages(state.activeConversationId)
    showToast(currentCopy.chatMovedToTrash)
  }

  const handleRestoreConversation = async (conversationId: string) => {
    const imageToolApi = getImageToolApi()

    if (!hasImageToolBridge(imageToolApi)) {
      return
    }

    const state = await imageToolApi.restoreConversation(conversationId)
    applySessionState(state)
    clearComposerState()
    setIsTrashOpen(false)
    await loadHistoryMessages(state.activeConversationId ?? conversationId)
  }

  const handlePermanentlyDeleteConversation = async (conversationId: string) => {
    const imageToolApi = getImageToolApi()

    if (!hasImageToolBridge(imageToolApi)) {
      return
    }

    const confirmed = await requestConfirmation({
      confirmLabel: currentCopy.deletePermanently,
      message: currentCopy.confirmPermanentDeleteChat,
      title: currentCopy.deletePermanently
    })

    if (!confirmed) {
      return
    }

    const state = await imageToolApi.permanentlyDeleteConversation(conversationId)
    applySessionState(state)

    if (state.activeConversationId !== activeConversationId) {
      clearComposerState()
      await loadHistoryMessages(state.activeConversationId)
    }
  }

  const handleSelectProject = (projectId: string | null) => {
    setSelectedProjectId(projectId)

    if (activeConversation && activeConversation.projectId !== projectId) {
      activeConversationIdRef.current = undefined
      setActiveConversationId(undefined)
      storeConversationMessages(undefined, [])
      clearComposerState()
    }
  }

  const handleCreateProject = async () => {
    const imageToolApi = getImageToolApi()

    if (!hasImageToolBridge(imageToolApi)) {
      return
    }

    const name = createUniqueProjectName(projects, currentCopy.newProjectName)
    const previousProjectIds = new Set(projects.map((project) => project.id))
    const state = await imageToolApi.createProject(name)
    const createdProject = state.projects.find((project) => !previousProjectIds.has(project.id))

    applySessionState(state)
    setSelectedProjectId(createdProject?.id ?? state.projects[0]?.id)

    if (createdProject) {
      setRenamingProjectId(createdProject.id)
      setProjectRenameDraft(createdProject.name)
    }
  }

  const handleRenameProject = (project: ImageToolProjectGroup) => {
    setRenamingProjectId(project.id)
    setProjectRenameDraft(project.name)
  }

  const handleCancelProjectRename = () => {
    setRenamingProjectId(undefined)
    setProjectRenameDraft('')
  }

  const handleCommitProjectRename = async (projectId: string) => {
    const imageToolApi = getImageToolApi()
    const project = projects.find((item) => item.id === projectId)

    if (!project) {
      handleCancelProjectRename()
      return
    }

    const name = projectRenameDraft.trim()

    if (!name) {
      setProjectRenameDraft(project.name)
      handleCancelProjectRename()
      return
    }

    if (!hasImageToolBridge(imageToolApi)) {
      return
    }

    const state = await imageToolApi.renameProject(project.id, name)
    applySessionState(state)
    setSelectedProjectId(project.id)
    handleCancelProjectRename()
  }

  const handleDeleteProject = async (project: ImageToolProjectGroup) => {
    const imageToolApi = getImageToolApi()

    if (!hasImageToolBridge(imageToolApi)) {
      return
    }

    const confirmed = await requestConfirmation({
      message: currentCopy.confirmDeleteProject,
      title: currentCopy.delete
    })

    if (!confirmed) {
      return
    }

    const state = await imageToolApi.deleteProject(project.id)
    applySessionState(state)
    clearComposerState()
    await loadHistoryMessages(state.activeConversationId)
  }

  const handleToggleProjectCollapse = (projectId: string) => {
    setCollapsedProjectIds((currentProjectIds) => {
      const nextProjectIds = new Set(currentProjectIds)

      if (nextProjectIds.has(projectId)) {
        nextProjectIds.delete(projectId)
      } else {
        nextProjectIds.add(projectId)
      }

      return nextProjectIds
    })
  }

  const openLogoPicker = () => {
    logoFileInputRef.current?.click()
  }

  const handleLogoImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''

    if (!file) {
      return
    }

    if (!isSupportedLogoFile(file)) {
      showToast(currentCopy.logoUnsupported)
      return
    }

    const reader = new FileReader()

    reader.addEventListener('error', () => {
      showToast(currentCopy.logoReadFailed)
    })
    reader.addEventListener('load', () => {
      if (typeof reader.result !== 'string' || !reader.result.startsWith('data:')) {
        showToast(currentCopy.logoReadFailed)
        return
      }

      setCustomLogoDataUrl(reader.result)
      writeStoredValue(CUSTOM_LOGO_STORAGE_KEY, reader.result)
      showToast(currentCopy.logoUpdated)
    })
    reader.readAsDataURL(file)
  }

  const handleRestoreDefaultLogo = () => {
    setCustomLogoDataUrl(undefined)
    removeStoredValue(CUSTOM_LOGO_STORAGE_KEY)
    showToast(currentCopy.logoRestored)
  }

  const applySavedSettings = (savedSettings: ImageToolPersistedSettings) => {
    setProviderTemplateId(savedSettings.providerTemplateId)
    setBaseUrl(savedSettings.baseUrl)
    setEndpointPath(savedSettings.endpointPath)
    setEditEndpointPath(savedSettings.editEndpointPath)
    setModel(savedSettings.model)
    setQuality(savedSettings.quality)
    setOutputFormat(savedSettings.outputFormat)
    setSendOutputFormat(savedSettings.sendOutputFormat)
    setSendResponseFormat(savedSettings.sendResponseFormat)
    setResponseFormat(savedSettings.responseFormat ?? 'b64_json')
    setCustomProviderTemplates(savedSettings.customProviderTemplates)
    setProviderCredentials(savedSettings.providerCredentials)
    setSaveApiKey(savedSettings.saveApiKey)
    setDefaultUnitPrice(savedSettings.defaultUnitPrice)
    setCurrency(savedSettings.currency)
    setProviderUnitPrices(savedSettings.providerUnitPrices)
    setUsageDefaultPriceDraft(String(savedSettings.defaultUnitPrice))
    setUsageProviderPriceDraft(
      String(savedSettings.providerUnitPrices[savedSettings.providerTemplateId] ?? savedSettings.defaultUnitPrice)
    )
    setAppearanceTheme(savedSettings.appearanceTheme)
    setSizeMode(savedSettings.sizeMode)
    setFixedSize(savedSettings.sizePreset as ImageSizePreset)
    setSettingsDraft(
      createApiSettingsDraft({
        providerTemplateId: savedSettings.providerTemplateId,
        baseUrl: savedSettings.baseUrl,
        endpointPath: savedSettings.endpointPath,
        editEndpointPath: savedSettings.editEndpointPath,
        apiKey: getProviderCredentialApiKey(savedSettings.providerCredentials, savedSettings.providerTemplateId),
        model: savedSettings.model,
        outputFormat: savedSettings.outputFormat,
        sendOutputFormat: savedSettings.sendOutputFormat,
        sendResponseFormat: savedSettings.sendResponseFormat,
        responseFormat: savedSettings.responseFormat ?? 'b64_json',
        providerCredentials: savedSettings.providerCredentials,
        customProviderTemplates: savedSettings.customProviderTemplates
      })
    )
  }

  const openSettingsDrawer = () => {
    setSettingsDraft(
      createApiSettingsDraft({
        providerTemplateId,
        baseUrl,
        endpointPath,
        editEndpointPath,
        apiKey: currentApiKey,
        model,
        outputFormat,
        sendOutputFormat,
        sendResponseFormat,
        responseFormat,
        providerCredentials,
        customProviderTemplates
      })
    )
    setSettingsStatus(undefined)
    setConnectionTestResult(undefined)
    setTemplateEditorDraft(undefined)
    setTemplateEditorStatus(undefined)
    setSettingsOpen(true)
  }

  const closeSettingsDrawer = () => {
    setSettingsDraft(
      createApiSettingsDraft({
        providerTemplateId,
        baseUrl,
        endpointPath,
        editEndpointPath,
        apiKey: currentApiKey,
        model,
        outputFormat,
        sendOutputFormat,
        sendResponseFormat,
        responseFormat,
        providerCredentials,
        customProviderTemplates
      })
    )
    setSettingsStatus(undefined)
    setConnectionTestResult(undefined)
    setTemplateEditorDraft(undefined)
    setTemplateEditorStatus(undefined)
    setSettingsOpen(false)
  }

  const openUsagePanel = () => {
    setUsageStatus(undefined)
    setUsageDefaultPriceDraft(String(defaultUnitPrice))
    setUsageProviderPriceDraft(String(providerUnitPrices[providerTemplateId] ?? defaultUnitPrice))
    setUsageOpen(true)
    void loadTaskUsage(usageRecordFilters)
  }

  const closeUsagePanel = () => {
    setUsageStatus(undefined)
    setUsageOpen(false)
  }

  const handleSaveUsagePrices = async () => {
    const imageToolApi = getImageToolApi()
    const diagnostics = getBridgeDiagnostics()
    setIsBridgeReady(diagnostics.hasBridge)

    if (!hasImageToolBridge(imageToolApi)) {
      setUsageStatus(currentCopy.missingBridge)
      return
    }

    const nextDefaultUnitPrice = normalizeUnitPriceInput(usageDefaultPriceDraft)
    const nextProviderUnitPrice = normalizeUnitPriceInput(usageProviderPriceDraft)

    if (nextDefaultUnitPrice === undefined || nextProviderUnitPrice === undefined) {
      setUsageStatus(currentCopy.usageInvalidPrice)
      return
    }

    const nextProviderUnitPrices = {
      ...providerUnitPrices,
      [providerTemplateId]: nextProviderUnitPrice
    }
    const savedSettings = await imageToolApi.saveUsagePriceSettings({
      defaultUnitPrice: nextDefaultUnitPrice,
      currency,
      providerUnitPrices: nextProviderUnitPrices
    })

    applySavedSettings(savedSettings)
    setUsageStatus(currentCopy.usagePricesSaved)
    void loadTaskUsage(usageRecordFilters)
  }

  const handleExportUsageCsv = async () => {
    const imageToolApi = getImageToolApi()
    setIsBridgeReady(getBridgeDiagnostics().hasBridge)

    if (!hasImageToolBridge(imageToolApi)) {
      setUsageStatus(currentCopy.missingBridge)
      return
    }

    const result = await imageToolApi.exportTaskUsageCsv(usageRecordFilters)
    setUsageStatus(currentCopy.usageCsvExported.replace('{fileName}', result.fileName))
  }

  const handleClearUsageRecords = async () => {
    const imageToolApi = getImageToolApi()
    setIsBridgeReady(getBridgeDiagnostics().hasBridge)

    if (!hasImageToolBridge(imageToolApi)) {
      setUsageStatus(currentCopy.missingBridge)
      return
    }

    const confirmed = await requestConfirmation({
      message: currentCopy.usageConfirmClear,
      title: currentCopy.usageClear
    })

    if (!confirmed) {
      return
    }

    const snapshot = await imageToolApi.clearTaskUsage()
    setUsageSnapshot(snapshot)
    setUsageStatus(currentCopy.usageEmpty)
  }

  const createCurrentSettingsSnapshot = (theme: AppearanceTheme): ImageToolPersistedSettings => ({
    appearanceTheme: theme,
    providerTemplateId,
    baseUrl,
    endpointPath,
    editEndpointPath,
    model,
    quality,
    outputFormat,
    sendOutputFormat,
    sendResponseFormat,
    responseFormat,
    sizeMode,
    sizePreset: fixedSize,
    saveApiKey,
    providerCredentials,
    customProviderTemplates,
    defaultUnitPrice,
    currency,
    providerUnitPrices
  })

  const handleThemeChange = async (nextTheme: AppearanceTheme) => {
    if (nextTheme === appearanceTheme) {
      return
    }

    const previousTheme = appearanceTheme
    const imageToolApi = getImageToolApi()
    const diagnostics = getBridgeDiagnostics()
    setIsBridgeReady(diagnostics.hasBridge)
    setAppearanceTheme(nextTheme)

    if (!hasImageToolBridge(imageToolApi)) {
      return
    }

    try {
      const currentSettings = await imageToolApi.getSettings().catch(() => createCurrentSettingsSnapshot(nextTheme))
      const savedSettings = await imageToolApi.saveSettings({
        ...currentSettings,
        appearanceTheme: nextTheme
      })
      applySavedSettings(savedSettings)
    } catch {
      setAppearanceTheme(previousTheme)
    }
  }

  const updateSettingsDraft = (patch: Partial<ApiSettingsDraft>) => {
    setSettingsDraft((currentDraft) => ({
      ...currentDraft,
      ...patch
    }))
  }

  const handleSaveSettings = async () => {
    const imageToolApi = getImageToolApi()
    const diagnostics = getBridgeDiagnostics()
    setIsBridgeReady(diagnostics.hasBridge)

    if (!hasImageToolBridge(imageToolApi)) {
      setSettingsStatus(currentCopy.missingBridge)
      return
    }

    const nextProviderCredentials = setProviderCredentialApiKey(
      settingsDraft.providerCredentials,
      settingsDraft.providerTemplateId,
      settingsDraft.apiKey
    )
    const savedSettings = await imageToolApi.saveSettings({
      appearanceTheme,
      providerTemplateId: settingsDraft.providerTemplateId,
      baseUrl: settingsDraft.baseUrl.trim(),
      endpointPath: normalizeEndpointPath(settingsDraft.endpointPath),
      editEndpointPath: normalizeEditEndpointPath(settingsDraft.editEndpointPath),
      model: settingsDraft.model.trim() || 'gpt-image-2',
      quality,
      outputFormat: settingsDraft.outputFormat,
      sendOutputFormat: settingsDraft.sendOutputFormat,
      sendResponseFormat: settingsDraft.sendResponseFormat,
      responseFormat: settingsDraft.responseFormat,
      sizeMode,
      sizePreset: fixedSize,
      saveApiKey: true,
      providerCredentials: nextProviderCredentials,
      customProviderTemplates: settingsDraft.customProviderTemplates,
      defaultUnitPrice,
      currency,
      providerUnitPrices
    })

    applySavedSettings(savedSettings)
    setSettingsStatus(currentCopy.settingsSaved)
    setSettingsOpen(false)
  }

  const handleTestConnection = async () => {
    const imageToolApi = getImageToolApi()
    const diagnostics = getBridgeDiagnostics()
    setIsBridgeReady(diagnostics.hasBridge)

    if (!hasImageToolBridge(imageToolApi)) {
      setConnectionTestResult({
        ok: false,
        status: 'failed',
        code: 'missing_bridge',
        message: currentCopy.missingBridge
      })
      return
    }

    if (!resolvedSize.ok) {
      setConnectionTestResult({
        ok: false,
        status: 'failed',
        code: resolvedSize.error.code,
        message:
          currentCopy.sizeErrors[resolvedSize.error.code as keyof typeof currentCopy.sizeErrors] ??
          resolvedSize.error.message
      })
      return
    }

    setIsTestingConnection(true)

    try {
      const result = await imageToolApi.testImage2Connection({
        baseUrl: settingsDraft.baseUrl.trim(),
        apiKey: settingsDraft.apiKey,
        endpointPath: normalizeEndpointPath(settingsDraft.endpointPath),
        model: settingsDraft.model.trim(),
        size: resolvedSize.value.size,
        quality,
        outputFormat: settingsDraft.outputFormat,
        sendOutputFormat: settingsDraft.sendOutputFormat,
        sendResponseFormat: settingsDraft.sendResponseFormat,
        responseFormat: settingsDraft.responseFormat
      })
      setConnectionTestResult(result)
    } catch (error) {
      setConnectionTestResult({
        ok: false,
        status: 'failed',
        code: 'connection_test_failed',
        message: error instanceof Error ? error.message : 'Connection test failed.'
      })
    } finally {
      setIsTestingConnection(false)
    }
  }

  const handleTemplateChange = (templateId: string) => {
    setSettingsDraft((currentDraft) => {
      const nextProviderCredentials = setProviderCredentialApiKey(
        currentDraft.providerCredentials,
        currentDraft.providerTemplateId,
        currentDraft.apiKey
      )
      const template = getImageProviderTemplate(templateId, currentDraft.customProviderTemplates)

      return {
        ...currentDraft,
        providerTemplateId: template.id,
        baseUrl: template.defaultBaseUrl,
        endpointPath: template.endpointPath,
        editEndpointPath: template.editEndpointPath,
        model: template.model,
        sendOutputFormat: template.sendOutputFormat,
        sendResponseFormat: template.sendResponseFormat,
        responseFormat: template.responseFormat ?? currentDraft.responseFormat,
        outputFormat: template.outputFormat ?? currentDraft.outputFormat,
        apiKey: getProviderCredentialApiKey(nextProviderCredentials, template.id),
        providerCredentials: nextProviderCredentials
      }
    })
    setTemplateEditorStatus(undefined)
  }

  const handleAddTemplate = () => {
    setTemplateEditorDraft(createTemplateEditorDraftForNewTemplate(settingsDraft, currentCopy.newInterfaceTemplateName))
    setTemplateEditorStatus(undefined)
  }

  const handleEditTemplate = () => {
    if (protectedImageProviderTemplateIds.has(settingsDraft.providerTemplateId)) {
      setTemplateEditorStatus(currentCopy.builtInTemplateLocked)
      return
    }

    setTemplateEditorDraft(createTemplateEditorDraftFromTemplate(draftTemplate))
    setTemplateEditorStatus(undefined)
  }

  const handleSaveTemplate = () => {
    if (!templateEditorDraft) {
      return
    }

    const template = templateEditorDraftToTemplate(templateEditorDraft)

    if (!template) {
      setTemplateEditorStatus(currentCopy.templateNameRequired)
      return
    }

    setSettingsDraft((currentDraft) => {
      const nextProviderCredentials = setProviderCredentialApiKey(
        currentDraft.providerCredentials,
        currentDraft.providerTemplateId,
        currentDraft.apiKey
      )

      return {
        ...currentDraft,
        providerTemplateId: template.id,
        baseUrl: template.defaultBaseUrl,
        endpointPath: template.endpointPath,
        editEndpointPath: template.editEndpointPath,
        model: template.model,
        sendOutputFormat: template.sendOutputFormat,
        outputFormat: template.outputFormat ?? currentDraft.outputFormat,
        sendResponseFormat: template.sendResponseFormat,
        responseFormat: template.responseFormat ?? currentDraft.responseFormat,
        apiKey:
          template.id === currentDraft.providerTemplateId
            ? currentDraft.apiKey
            : getProviderCredentialApiKey(nextProviderCredentials, template.id),
        providerCredentials: nextProviderCredentials,
        customProviderTemplates: [
          template,
          ...currentDraft.customProviderTemplates.filter((item) => item.id !== template.id)
        ]
      }
    })
    setTemplateEditorDraft(undefined)
    setTemplateEditorStatus(undefined)
  }

  const handleDeleteTemplate = () => {
    const templateId = settingsDraft.providerTemplateId

    if (protectedImageProviderTemplateIds.has(templateId)) {
      setTemplateEditorStatus(currentCopy.builtInTemplateLocked)
      return
    }

    void requestConfirmation({
      message: currentCopy.confirmDeleteTemplate,
      title: currentCopy.deleteTemplate
    }).then((confirmed) => {
      if (!confirmed) {
        return
      }

      setSettingsDraft((currentDraft) => {
        const nextProviderCredentials = { ...currentDraft.providerCredentials }
        const fallbackTemplate = getImageProviderTemplate('compatible-default', currentDraft.customProviderTemplates)
        delete nextProviderCredentials[templateId]

        return {
          ...currentDraft,
          providerTemplateId: fallbackTemplate.id,
          baseUrl: fallbackTemplate.defaultBaseUrl,
          endpointPath: fallbackTemplate.endpointPath,
          editEndpointPath: fallbackTemplate.editEndpointPath,
          model: fallbackTemplate.model,
          sendOutputFormat: fallbackTemplate.sendOutputFormat,
          sendResponseFormat: fallbackTemplate.sendResponseFormat,
          responseFormat: fallbackTemplate.responseFormat ?? currentDraft.responseFormat,
          outputFormat: fallbackTemplate.outputFormat ?? currentDraft.outputFormat,
          apiKey: getProviderCredentialApiKey(nextProviderCredentials, fallbackTemplate.id),
          providerCredentials: nextProviderCredentials,
          customProviderTemplates: currentDraft.customProviderTemplates.filter((template) => template.id !== templateId)
        }
      })
      setTemplateEditorDraft(undefined)
      setTemplateEditorStatus(undefined)
    })
  }

  return (
    <main
      className={isReferenceDropActive ? 'chat-shell is-reference-drop-active' : 'chat-shell'}
      data-theme={appearanceTheme}
      onDragEnter={handleReferenceDragEnter}
      onDragLeave={handleReferenceDragLeave}
      onDragOver={handleReferenceDragOver}
      onDrop={handleReferenceDrop}
      onPaste={handleReferencePaste}
    >
      <ConversationSidebar
        activeConversationId={activeConversationId}
        collapsedProjectIds={collapsedProjectIds}
        conversations={visibleConversations}
        customLogoDataUrl={customLogoDataUrl}
        language={language}
        onChooseLogo={openLogoPicker}
        onCreateConversation={handleCreateConversation}
        onCreateProject={handleCreateProject}
        onDeleteConversation={handleDeleteConversation}
        onDeleteProject={handleDeleteProject}
        onMoveConversation={handleMoveConversation}
        onCancelProjectRename={handleCancelProjectRename}
        onCommitProjectRename={handleCommitProjectRename}
        onProjectRenameDraftChange={setProjectRenameDraft}
        onRenameConversation={handleRenameConversation}
        onRenameProject={handleRenameProject}
        onRestoreDefaultLogo={handleRestoreDefaultLogo}
        onSelectConversation={handleSelectConversation}
        onSelectProject={handleSelectProject}
        onToggleProjectCollapse={handleToggleProjectCollapse}
        onTasksUsageOpen={openUsagePanel}
        onTrashOpen={() => setIsTrashOpen(true)}
        projectRenameDraft={projectRenameDraft}
        projects={projects}
        renamingProjectId={renamingProjectId}
        selectedProjectId={targetProjectId}
        text={currentCopy}
        trashCount={trashedConversations.length}
      />
      <div className="chat-main">
        <header className="app-header">
          <div className="app-header-spacer" aria-hidden="true" />
          <div className="header-status" aria-label={currentCopy.currentSettingsLabel}>
            <span className={`api-status api-status-${apiStatus}`}>{getApiStatusLabel(apiStatus, currentCopy)}</span>
          </div>
          <div className="theme-menu" ref={themeMenuRef}>
            <button
              aria-expanded={isThemeMenuOpen}
              aria-haspopup="menu"
              aria-label={currentCopy.theme}
              className="theme-menu-trigger"
              onClick={() => {
                setIsLanguageMenuOpen(false)
                setIsThemeMenuOpen((isOpen) => !isOpen)
              }}
              type="button"
            >
              <span>{appearanceTheme === 'dark' ? currentCopy.darkTheme : currentCopy.lightTheme}</span>
              <span className="theme-chevron" aria-hidden="true" />
            </button>
            {isThemeMenuOpen && (
              <div className="theme-menu-panel" role="menu" aria-label={currentCopy.theme}>
                {appearanceThemeOptions.map((themeOption) => (
                  <button
                    aria-checked={appearanceTheme === themeOption}
                    key={themeOption}
                    onClick={() => {
                      setIsThemeMenuOpen(false)
                      void handleThemeChange(themeOption)
                    }}
                    role="menuitemradio"
                    type="button"
                  >
                    <span>{themeOption === 'dark' ? currentCopy.darkTheme : currentCopy.lightTheme}</span>
                    <span
                      className={appearanceTheme === themeOption ? 'theme-check is-visible' : 'theme-check'}
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="language-menu" ref={languageMenuRef}>
            <button
              aria-expanded={isLanguageMenuOpen}
              aria-haspopup="menu"
              className="language-menu-trigger"
              onClick={() => {
                setIsThemeMenuOpen(false)
                setIsLanguageMenuOpen((isOpen) => !isOpen)
              }}
              type="button"
            >
              <span>{currentCopy[language]}</span>
              <span className="language-chevron" aria-hidden="true" />
            </button>
            {isLanguageMenuOpen && (
              <div className="language-menu-panel" role="menu">
                {(['zh', 'en'] as const).map((nextLanguage) => (
                  <button
                    aria-checked={language === nextLanguage}
                    key={nextLanguage}
                    onClick={() => {
                      setLanguage(nextLanguage)
                      setIsLanguageMenuOpen(false)
                    }}
                    role="menuitemradio"
                    type="button"
                  >
                    <span>{currentCopy[nextLanguage]}</span>
                    <span
                      className={language === nextLanguage ? 'language-check is-visible' : 'language-check'}
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="icon-button settings-button" onClick={openSettingsDrawer} type="button">
            {currentCopy.settings}
          </button>
        </header>

        {settingsOpen && (
          <ApiSettingsDrawer
            connectionTestResult={connectionTestResult}
            currentCopy={currentCopy}
            draft={settingsDraft}
            endpoint={draftRequestEndpoint}
            editEndpoint={draftEditRequestEndpoint}
            isTestingConnection={isTestingConnection}
            onAddTemplate={handleAddTemplate}
            onCancel={closeSettingsDrawer}
            onDeleteTemplate={handleDeleteTemplate}
            onDraftChange={updateSettingsDraft}
            onEditTemplate={handleEditTemplate}
            onSave={handleSaveSettings}
            onSaveTemplate={handleSaveTemplate}
            onTemplateEditorChange={(patch) =>
              setTemplateEditorDraft((currentDraft) => (currentDraft ? { ...currentDraft, ...patch } : currentDraft))
            }
            onTemplateEditorCancel={() => {
              setTemplateEditorDraft(undefined)
              setTemplateEditorStatus(undefined)
            }}
            onTemplateChange={handleTemplateChange}
            onTestConnection={handleTestConnection}
            quality={quality}
            resolvedSizeLabel={currentSizeLabel}
            settingsStatus={settingsStatus}
            template={draftTemplate}
            templateEditorDraft={templateEditorDraft}
            templateEditorStatus={templateEditorStatus}
            templates={availableTemplates}
          />
        )}

        {usageOpen && (
          <TaskUsagePanel
            currentProviderTemplateId={providerTemplateId}
            defaultUnitPriceDraft={usageDefaultPriceDraft}
            filters={usageFilters}
            language={language}
            onClear={handleClearUsageRecords}
            onClose={closeUsagePanel}
            onDefaultUnitPriceDraftChange={setUsageDefaultPriceDraft}
            onExportCsv={handleExportUsageCsv}
            onFiltersChange={setUsageFilters}
            onProviderUnitPriceDraftChange={setUsageProviderPriceDraft}
            onSavePrices={handleSaveUsagePrices}
            projects={projects}
            providerUnitPriceDraft={usageProviderPriceDraft}
            snapshot={usageSnapshot}
            status={usageStatus}
            text={currentCopy}
            templates={usageTemplates}
          />
        )}

        {isPromptLibraryOpen && (
          <PromptLibraryPanel
            categories={promptTemplateCategories}
            currentCopy={currentCopy}
            filteredTemplates={filteredPromptTemplates}
            onCategoryChange={setSelectedPromptTemplateCategoryId}
            onClose={() => {
              setIsPromptLibraryOpen(false)
              setPromptTemplateVariableDialog(undefined)
            }}
            onCopyTemplate={handleCopyPromptTemplate}
            onCreateCategory={handleCreatePromptTemplateCategory}
            onCreateTemplate={() =>
              setPromptTemplateEditorDraft(
                createPromptTemplateEditorDraft(
                  selectedPromptTemplateCategoryId === 'all' ? null : selectedPromptTemplateCategoryId
                )
              )
            }
            onDeleteCategory={handleDeletePromptTemplateCategory}
            onDeleteTemplate={handleDeletePromptTemplate}
            onDeleteSelectedTemplates={handleDeleteSelectedPromptTemplates}
            onEditCategory={handleRenamePromptTemplateCategory}
            onEditTemplate={(template) => setPromptTemplateEditorDraft(createPromptTemplateEditorDraft(null, template))}
            onExportAll={handleExportAllPromptTemplates}
            onExportCategory={handleExportPromptTemplateCategory}
            onExportSelectedTemplates={handleExportSelectedPromptTemplates}
            onExportTemplate={handleExportPromptTemplate}
            onImport={() => promptTemplateImportInputRef.current?.click()}
            onMoveSelectedTemplates={handleMoveSelectedPromptTemplates}
            onOpenFolder={handleOpenPromptTemplateFolder}
            onScanImports={handleScanPromptTemplateImports}
            onSearchChange={setPromptTemplateSearch}
            onSelectAllVisibleTemplates={toggleVisiblePromptTemplateSelection}
            onSelectionChange={togglePromptTemplateSelection}
            onCardScaleChange={setPromptTemplateCardScale}
            onTypeFilterChange={setPromptTemplateTypeFilter}
            onUseTemplate={handleUsePromptTemplate}
            onClearSelection={clearPromptTemplateSelection}
            cardScale={promptTemplateCardScale}
            selectedTemplateCount={selectedPromptTemplateCount}
            selectedTemplateIds={selectedPromptTemplateIds}
            search={promptTemplateSearch}
            selectedCategoryId={selectedPromptTemplateCategoryId}
            visibleTemplatesAllSelected={areAllVisiblePromptTemplatesSelected}
            status={promptLibraryStatus}
            typeFilter={promptTemplateTypeFilter}
          />
        )}

        <input
          accept=".image-prompt-template.json,.image-prompt-pack.json,application/json"
          className="reference-file-input"
          multiple
          onChange={handlePromptTemplateImportFile}
          ref={promptTemplateImportInputRef}
          type="file"
        />
        <input
          accept="image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg"
          className="reference-file-input"
          onChange={handleLogoImageUpload}
          ref={logoFileInputRef}
          type="file"
        />

        <section
          className="conversation"
          aria-label={currentCopy.conversationLabel}
          onScroll={() => {
            isNearConversationEndRef.current = isNearConversationEnd()
          }}
          ref={conversationScrollRef}
        >
          <div className="conversation-inner">
            {messages.length === 0 ? (
              <div className="empty-state">
                <h2>{hasActiveConversation ? currentCopy.emptyState : currentCopy.selectOrCreateChat}</h2>
                <p>{hasActiveConversation ? currentCopy.emptyStateHint : currentCopy.noProjectsHint}</p>
              </div>
            ) : (
              messages.map((message) => {
                return (
                  <article
                    className={`message message-${message.role}${message.kind === 'image_result' ? ' message-image-result' : ''}`}
                    key={message.id}
                  >
                    <div className={`message-bubble${message.kind === 'image_result' ? ' image-result-card' : ''}`}>
                      {message.kind === 'prompt' && (
                        <>
                          <CollapsibleText
                            collapsedLabel={currentCopy.expand}
                            expandedLabel={currentCopy.collapse}
                            id={message.id}
                            text={message.prompt}
                          />
                          {message.params && (
                            <ParamChips
                              label={currentCopy.generationParameters}
                              params={message.params}
                              text={currentCopy}
                            />
                          )}
                          {message.referenceImages && message.referenceImages.length > 0 && (
                            <ReferenceImagePreviewList
                              images={message.referenceImages}
                              notice={currentCopy.referenceImagePending}
                              removable={false}
                              removeLabel={currentCopy.removeReferenceImage}
                            />
                          )}
                        </>
                      )}
                      {message.kind === 'generating' && (
                        <div className="generating-state">
                          <span className="loading-dot" aria-hidden="true" />
                          <div>
                            <strong>{getTaskStatusText(message, currentCopy)}</strong>
                            <p>
                              {currentCopy.requestedSize}: {message.params?.size}
                            </p>
                          </div>
                        </div>
                      )}
                      {message.kind === 'image_result' && message.result?.ok && (
                        <ImageResultMessage
                          message={message}
                          text={currentCopy}
                          onDeleteHistory={handleDeleteHistory}
                          onDownload={handleDownload}
                          onEditImage={startEditingFromMessage}
                          onOpenPreview={openImageLightbox}
                          onPreviewSettled={handlePreviewSettled}
                          previewSelfTest={previewSelfTest}
                          onRegenerate={handleRegenerate}
                          onSaveAsTemplate={handleSaveImageResultAsTemplate}
                        />
                      )}
                      {message.kind === 'error' && (
                        <div className="message-error" role="alert">
                          <strong>{message.error?.code ?? currentCopy.generationError}</strong>
                          <span>{message.error?.message ?? currentCopy.imageGenerationFailed}</span>
                          <EditDebugDetails details={message.error?.debugDetails} text={currentCopy} />
                        </div>
                      )}
                    </div>
                  </article>
                )
              })
            )}
            <div ref={messagesEndRef} className="messages-end" aria-hidden="true" />
          </div>
        </section>

        <form
          className={isReferenceDropActive ? 'composer-shell is-reference-drop-target' : 'composer-shell'}
          onSubmit={handleSubmit}
        >
          {referenceImages.length > 0 && (
            <ReferenceImagePreviewList
              images={referenceImages}
              removable
              onRemove={removeReferenceImage}
              removeLabel={currentCopy.removeReferenceImage}
            />
          )}
          <div className="composer-main-row">
            <input
              accept="image/*"
              className="reference-file-input"
              multiple
              onChange={handleReferenceImageUpload}
              ref={referenceImageInputRef}
              type="file"
            />
            <button
              aria-label={currentCopy.addReferenceImage}
              className="reference-add-button"
              disabled={referenceImages.length >= MAX_REFERENCE_IMAGES}
              onClick={openReferenceImagePicker}
              title={currentCopy.addReferenceImage}
              type="button"
            >
              <span aria-hidden="true">+</span>
            </button>
            <textarea
              aria-label={currentCopy.promptLabel}
              className="prompt-input"
              onChange={(event) => {
                setPrompt(event.currentTarget.value)
                setReferenceUploadError(undefined)
              }}
              placeholder={currentCopy.promptPlaceholder}
              ref={promptInputRef}
              rows={1}
              value={prompt}
            />
            <button className="generate-button composer-generate-button" type="submit">
              {currentCopy.generate}
            </button>
          </div>
          <div className="composer-bottom-row">
            <div className="composer-chip-strip" aria-label={currentCopy.generationParameters}>
              {referenceImages.length > 0 && (
                <span className="composer-chip-static">
                  {currentCopy.referenceImageCount.replace('{count}', String(referenceImages.length))}
                </span>
              )}
              <span className="composer-chip-static">
                {currentCopy.model}: {model || COMPOSER_MODEL_PRESET}
              </span>
              <button
                aria-expanded={composerPopover?.key === 'size'}
                className="composer-chip"
                onClick={() => toggleComposerPopover('size')}
                type="button"
              >
                {currentCopy.size}: {composerSizeLabel}
              </button>
              <button
                aria-expanded={composerPopover?.key === 'quality'}
                className="composer-chip"
                onClick={() => toggleComposerPopover('quality')}
                type="button"
              >
                {currentCopy.quality}: {quality}
              </button>
              <button
                aria-expanded={composerPopover?.key === 'format'}
                className="composer-chip"
                onClick={() => toggleComposerPopover('format')}
                type="button"
              >
                {currentCopy.format}: {outputFormat}
              </button>
              <button className="template-library-button" onClick={openPromptLibrary} type="button">
                {currentCopy.promptLibrary}
              </button>
            </div>
          </div>
          {referenceUploadError && (
            <p className="composer-upload-error" role="alert">
              {referenceUploadError}
            </p>
          )}
          {promptTemplateReferenceNotice && (
            <p className="composer-template-notice" role="status">
              {promptTemplateReferenceNotice}
            </p>
          )}
          {composerPopover && (
            <ComposerParameterPopover
              fixedSize={fixedSize}
              language={language}
              onClose={() => setComposerPopover(undefined)}
              onOutputFormatChange={handleComposerOutputFormatChange}
              onQualityChange={handleComposerQualityChange}
              onSizeChange={handleComposerSizeChange}
              outputFormat={outputFormat}
              popover={composerPopover.key}
              quality={quality}
              sizeMode={sizeMode}
              text={currentCopy}
            />
          )}
        </form>
        {isReferenceDropActive && (
          <div className="reference-drop-overlay" aria-hidden="true">
            <span>{currentCopy.addReferenceImage}</span>
          </div>
        )}
      </div>
      {isTrashOpen && (
        <TrashDialog
          conversations={trashedConversations}
          language={language}
          onClose={() => setIsTrashOpen(false)}
          onDeletePermanently={handlePermanentlyDeleteConversation}
          onRestore={handleRestoreConversation}
          text={currentCopy}
        />
      )}
      {lightboxMessage && (
        <ImageLightbox
          message={lightboxMessage}
          onClose={closeImageLightbox}
          onDownload={handleDownload}
          text={currentCopy}
        />
      )}
      {editingSource && (
        <ImageEditWorkspace
          error={imageEditError}
          format={outputFormat}
          isSubmitting={isSubmittingImageEdit}
          model={model || COMPOSER_MODEL_PRESET}
          onClose={cancelEditingSource}
          onSubmit={submitImageEditFromWorkspace}
          quality={quality}
          sizeLabel={currentSizeLabel}
          source={editingSource}
          text={currentCopy}
        />
      )}
      {promptTemplateEditorDraft && (
        <PromptTemplateEditorDialog
          categories={promptTemplateCategories}
          draft={promptTemplateEditorDraft}
          onCancel={() => setPromptTemplateEditorDraft(undefined)}
          onChange={(patch) =>
            setPromptTemplateEditorDraft((currentDraft) =>
              currentDraft ? { ...currentDraft, ...patch } : currentDraft
            )
          }
          onSave={handleSavePromptTemplateDraft}
          text={currentCopy}
        />
      )}
      {promptTemplateCategoryDialog && (
        <PromptTemplateCategoryDialog
          state={promptTemplateCategoryDialog}
          onCancel={() => setPromptTemplateCategoryDialog(undefined)}
          onChange={setPromptTemplateCategoryDialog}
          onSubmit={handleSavePromptTemplateCategoryDialog}
          text={currentCopy}
        />
      )}
      {promptTemplateVariableDialog && (
        <PromptTemplateVariableDialog
          state={promptTemplateVariableDialog}
          onCancel={() => setPromptTemplateVariableDialog(undefined)}
          onChange={setPromptTemplateVariableDialog}
          onSubmit={handleApplyPromptTemplateVariables}
          text={currentCopy}
        />
      )}
      {confirmationDialog && (
        <ConfirmationDialog
          state={confirmationDialog}
          onCancel={() => resolveConfirmationDialog(false)}
          onConfirm={() => resolveConfirmationDialog(true)}
        />
      )}
      {textInputDialog && (
        <TextInputDialog
          state={textInputDialog}
          onCancel={() => resolveTextInputDialog(undefined)}
          onChange={(value) => setTextInputDialog({ ...textInputDialog, error: undefined, value })}
          onSubmit={() => resolveTextInputDialog(textInputDialog.value)}
        />
      )}
      {toastMessage && (
        <div className="app-toast" role="status">
          {toastMessage}
        </div>
      )}
    </main>
  )
}

function ConfirmationDialog({
  onCancel,
  onConfirm,
  state
}: {
  onCancel: () => void
  onConfirm: () => void
  state: ConfirmationDialogState
}): React.JSX.Element {
  return (
    <div className="template-editor-backdrop confirm-dialog-backdrop" onClick={onCancel} role="presentation">
      <section
        className={`confirm-dialog${state.tone === 'primary' ? ' confirm-dialog-primary' : ''}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={state.title}
      >
        <div>
          <p className="eyebrow">{state.title}</p>
          <h2>{state.title}</h2>
          <p>{state.message}</p>
        </div>
        <div className="settings-drawer-actions">
          <button className="secondary-button" onClick={onCancel} type="button">
            {state.cancelLabel}
          </button>
          <button
            className={state.tone === 'primary' ? 'generate-button' : 'danger-button'}
            onClick={onConfirm}
            type="button"
          >
            {state.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}

function TextInputDialog({
  onCancel,
  onChange,
  onSubmit,
  state
}: {
  onCancel: () => void
  onChange: (value: string) => void
  onSubmit: () => void
  state: TextInputDialogState
}): React.JSX.Element {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit()
  }

  return (
    <div className="template-editor-backdrop confirm-dialog-backdrop" onClick={onCancel} role="presentation">
      <section
        className="confirm-dialog text-input-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={state.title}
      >
        <form onSubmit={handleSubmit}>
          <div>
            <p className="eyebrow">{state.title}</p>
            <h2>{state.title}</h2>
          </div>
          <label className="compact-field">
            <span>{state.label}</span>
            <input
              autoFocus
              onChange={(event) => onChange(event.currentTarget.value)}
              onFocus={(event) => event.currentTarget.select()}
              value={state.value}
            />
          </label>
          {state.error && <p className="composer-upload-error">{state.error}</p>}
          <div className="settings-drawer-actions">
            <button className="secondary-button" onClick={onCancel} type="button">
              {state.cancelLabel}
            </button>
            <button className="generate-button" type="submit">
              {state.confirmLabel}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function ConversationSidebar({
  activeConversationId,
  collapsedProjectIds,
  conversations,
  customLogoDataUrl,
  language,
  onCancelProjectRename,
  onChooseLogo,
  onCommitProjectRename,
  onCreateConversation,
  onCreateProject,
  onDeleteConversation,
  onDeleteProject,
  onMoveConversation,
  onProjectRenameDraftChange,
  onRenameConversation,
  onRenameProject,
  onRestoreDefaultLogo,
  onSelectConversation,
  onSelectProject,
  onToggleProjectCollapse,
  onTasksUsageOpen,
  onTrashOpen,
  projectRenameDraft,
  projects,
  renamingProjectId,
  selectedProjectId,
  text,
  trashCount
}: {
  activeConversationId?: string
  collapsedProjectIds: ReadonlySet<string>
  conversations: ImageToolConversation[]
  customLogoDataUrl?: string
  language: Language
  onCancelProjectRename: () => void
  onChooseLogo: () => void
  onCommitProjectRename: (projectId: string) => void
  onCreateConversation: () => void
  onCreateProject: () => void
  onDeleteConversation: (conversationId: string) => void
  onDeleteProject: (project: ImageToolProjectGroup) => void
  onMoveConversation: (conversationId: string, projectId: string | null) => void
  onProjectRenameDraftChange: (name: string) => void
  onRenameConversation: (conversation: ImageToolConversation) => void
  onRenameProject: (project: ImageToolProjectGroup) => void
  onRestoreDefaultLogo: () => void
  onSelectConversation: (conversationId: string) => void
  onSelectProject: (projectId: string | null) => void
  onToggleProjectCollapse: (projectId: string) => void
  onTasksUsageOpen: () => void
  onTrashOpen: () => void
  projectRenameDraft: string
  projects: ImageToolProjectGroup[]
  renamingProjectId?: string
  selectedProjectId?: string | null
  text: (typeof copy)[Language]
  trashCount: number
}): React.JSX.Element {
  const ungroupedConversations = conversations.filter((conversation) => conversation.projectId === null)
  const projectEntries: Array<{
    conversations: ImageToolConversation[]
    id: string | null
    key: string
    label: string
    project?: ImageToolProjectGroup
  }> = [
    ...projects.map((project) => ({
      conversations: conversations.filter((conversation) => conversation.projectId === project.id),
      id: project.id,
      key: project.id,
      label: project.name,
      project
    })),
    ...(ungroupedConversations.length > 0
      ? [
          {
            conversations: ungroupedConversations,
            id: null,
            key: UNGROUPED_PROJECT_KEY,
            label: text.ungroupedProject
          }
        ]
      : [])
  ]

  return (
    <aside className="conversation-sidebar" aria-label={text.conversationLabel}>
      <div className="sidebar-brand">
        <div className="sidebar-logo-wrap">
          <button
            aria-label={text.changeLogo}
            className={customLogoDataUrl ? 'sidebar-logo-button has-custom-logo' : 'sidebar-logo-button'}
            onClick={onChooseLogo}
            title={text.changeLogo}
            type="button"
          >
            <img alt="" className="sidebar-logo-img" src={customLogoDataUrl ?? appLogo} />
          </button>
          <details className="logo-menu">
            <summary aria-label={text.moreActions}>...</summary>
            <div className="conversation-menu-panel logo-menu-panel">
              <button onClick={onChooseLogo} type="button">
                {text.changeLogo}
              </button>
              {customLogoDataUrl && (
                <button onClick={onRestoreDefaultLogo} type="button">
                  {text.restoreDefaultLogo}
                </button>
              )}
            </div>
          </details>
        </div>
        <strong>{text.appTitle}</strong>
      </div>
      <div className="sidebar-top">
        <button className="new-chat-button" onClick={onCreateConversation} type="button">
          + {text.newChat}
        </button>
      </div>
      <div className="sidebar-section-heading">
        <span>{text.projectsLabel}</span>
        <div className="sidebar-section-actions">
          <button
            aria-label={text.newProject}
            className="sidebar-create-project-button"
            onClick={onCreateProject}
            title={text.newProject}
            type="button"
          >
            +
          </button>
        </div>
      </div>
      <div className="project-list">
        {projectEntries.length === 0 ? (
          <div className="sidebar-empty-state">
            <strong>{text.noProjectsYet}</strong>
            <span>{text.noProjectsHint}</span>
          </div>
        ) : (
          projectEntries.map((entry) => {
            const project = entry.project
            const projectConversations = entry.conversations
            const projectLabel = entry.label
            const isProjectCollapsed = collapsedProjectIds.has(entry.key)
            const isProjectSelected = selectedProjectId === entry.id
            const sectionClassName = [
              'project-section',
              isProjectSelected ? 'is-selected' : '',
              isProjectCollapsed ? 'is-collapsed' : ''
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <section className={sectionClassName} key={entry.key}>
                <div className="project-header">
                  <button
                    aria-expanded={!isProjectCollapsed}
                    aria-label={isProjectCollapsed ? text.expandProject : text.collapseProject}
                    className="project-collapse-button"
                    onClick={() => onToggleProjectCollapse(entry.key)}
                    type="button"
                  >
                    <span
                      className={isProjectCollapsed ? 'section-chevron is-collapsed' : 'section-chevron'}
                      aria-hidden="true"
                    />
                  </button>
                  {project && renamingProjectId === project.id ? (
                    <form
                      className="project-rename-form"
                      onSubmit={(event) => {
                        event.preventDefault()
                        onCommitProjectRename(project.id)
                      }}
                    >
                      <input
                        aria-label={text.projectNamePrompt}
                        autoFocus
                        onBlur={() => onCommitProjectRename(project.id)}
                        onChange={(event) => onProjectRenameDraftChange(event.currentTarget.value)}
                        onFocus={(event) => event.currentTarget.select()}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            event.preventDefault()
                            onCancelProjectRename()
                          }
                        }}
                        value={projectRenameDraft}
                      />
                    </form>
                  ) : (
                    <button
                      aria-pressed={isProjectSelected}
                      className="project-title-button"
                      onClick={() => onSelectProject(entry.id)}
                      title={projectLabel}
                      type="button"
                    >
                      <span className="project-title-content">
                        <span className="project-title-line">
                          <span className="project-folder-icon" aria-hidden="true" />
                          <span>{projectLabel}</span>
                        </span>
                        <small>{formatProjectConversationCount(projectConversations.length, text)}</small>
                      </span>
                    </button>
                  )}
                  {project && renamingProjectId !== project.id && (
                    <details className="project-menu">
                      <summary aria-label={text.moreActions}>...</summary>
                      <div className="conversation-menu-panel project-menu-panel">
                        <button aria-label={text.rename} onClick={() => onRenameProject(project)} type="button">
                          {text.rename}
                        </button>
                        <button
                          aria-label={text.delete}
                          className="danger-menu-item"
                          onClick={() => onDeleteProject(project)}
                          type="button"
                        >
                          {text.delete}
                        </button>
                      </div>
                    </details>
                  )}
                </div>
                {!isProjectCollapsed && (
                  <div className="conversation-list">
                    {projectConversations.length === 0 ? (
                      <p className="sidebar-empty">{text.noChats}</p>
                    ) : (
                      projectConversations.map((conversation) => {
                        const conversationTitle = getConversationDisplayTitle(conversation, text)

                        return (
                          <div
                            className={
                              conversation.id === activeConversationId
                                ? 'conversation-row is-active'
                                : 'conversation-row'
                            }
                            key={conversation.id}
                          >
                            <button
                              className="conversation-select-button"
                              onClick={() => onSelectConversation(conversation.id)}
                              title={conversationTitle}
                              type="button"
                            >
                              <span className="conversation-title-line">
                                <span className="conversation-card-icon" aria-hidden="true" />
                                <span>{conversationTitle}</span>
                              </span>
                              <small>
                                {formatConversationTime(conversation.lastMessageAt ?? conversation.updatedAt, language)}
                                {conversation.imageCount ? ` · ${conversation.imageCount}` : ''}
                              </small>
                            </button>
                            <details className="conversation-menu">
                              <summary aria-label={text.moreActions}>...</summary>
                              <div className="conversation-menu-panel">
                                <label>
                                  <span>{text.moveToProject}</span>
                                  <select
                                    onChange={(event) =>
                                      onMoveConversation(
                                        conversation.id,
                                        event.currentTarget.value === UNGROUPED_PROJECT_KEY
                                          ? null
                                          : event.currentTarget.value
                                      )
                                    }
                                    value={conversation.projectId ?? UNGROUPED_PROJECT_KEY}
                                  >
                                    <option value={UNGROUPED_PROJECT_KEY}>{text.ungroupedProject}</option>
                                    {projects.map((projectOption) => (
                                      <option key={projectOption.id} value={projectOption.id}>
                                        {projectOption.name}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <button onClick={() => onRenameConversation(conversation)} type="button">
                                  {text.rename}
                                </button>
                                <button
                                  className="danger-menu-item"
                                  onClick={() => onDeleteConversation(conversation.id)}
                                  type="button"
                                >
                                  {text.delete}
                                </button>
                              </div>
                            </details>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </section>
            )
          })
        )}
      </div>
      <button className="trash-button" onClick={onTasksUsageOpen} title={text.tasksUsage} type="button">
        <span>{text.tasksUsage.split(' / ')[0]}</span>
      </button>
      <button className="trash-button" onClick={onTrashOpen} type="button">
        <span>{text.trash}</span>
        <strong>{trashCount}</strong>
      </button>
    </aside>
  )
}

function TrashDialog({
  conversations,
  language,
  onClose,
  onDeletePermanently,
  onRestore,
  text
}: {
  conversations: ImageToolConversation[]
  language: Language
  onClose: () => void
  onDeletePermanently: (conversationId: string) => void
  onRestore: (conversationId: string) => void
  text: (typeof copy)[Language]
}): React.JSX.Element {
  return (
    <div className="trash-dialog-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <section className="trash-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="trash-dialog-header">
          <h2>{text.trash}</h2>
          <button className="icon-button" onClick={onClose} type="button">
            {text.close}
          </button>
        </div>
        <div className="trash-dialog-body">
          {conversations.length === 0 ? (
            <p className="trash-empty">{text.trashEmpty}</p>
          ) : (
            conversations.map((conversation) => {
              const conversationTitle = getConversationDisplayTitle(conversation, text)

              return (
                <div className="trash-row" key={conversation.id}>
                  <div>
                    <strong>{conversationTitle}</strong>
                    <span>{formatConversationTime(conversation.deletedAt ?? conversation.updatedAt, language)}</span>
                  </div>
                  <div className="trash-actions">
                    <button className="secondary-button" onClick={() => onRestore(conversation.id)} type="button">
                      {text.restore}
                    </button>
                    <button
                      className="danger-button"
                      onClick={() => onDeletePermanently(conversation.id)}
                      type="button"
                    >
                      {text.deletePermanently}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}

function CollapsibleText({
  className = 'message-text',
  collapsedLabel,
  expandedLabel,
  id,
  text
}: {
  className?: string
  collapsedLabel: string
  expandedLabel: string
  id: string
  text?: string
}): React.JSX.Element | null {
  const [expanded, setExpanded] = useState(false)
  const [isCollapsible, setIsCollapsible] = useState(false)
  const textRef = useRef<HTMLParagraphElement | null>(null)

  useLayoutEffect(() => {
    const element = textRef.current

    if (!element) {
      return
    }

    const computedStyle = window.getComputedStyle(element)
    const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 22
    const collapsedHeight = lineHeight * COLLAPSIBLE_TEXT_MAX_LINES
    const nextIsCollapsible = element.scrollHeight - collapsedHeight > 4

    setIsCollapsible(nextIsCollapsible)

    if (!nextIsCollapsible) {
      setExpanded(false)
    }
  }, [id, text, expanded])

  useEffect(() => {
    setExpanded(false)
  }, [id])

  if (!text) {
    return null
  }

  return (
    <div className={expanded ? 'collapsible-text is-expanded' : 'collapsible-text'}>
      <p
        className={className}
        ref={textRef}
        style={
          expanded
            ? undefined
            : ({
                '--collapsible-lines': String(COLLAPSIBLE_TEXT_MAX_LINES)
              } as CSSProperties)
        }
      >
        {text}
      </p>
      {isCollapsible && (
        <button className="collapsible-text-toggle" onClick={() => setExpanded((value) => !value)} type="button">
          {expanded ? expandedLabel : collapsedLabel}
        </button>
      )}
    </div>
  )
}

function PromptLibraryPanel({
  categories,
  currentCopy,
  filteredTemplates,
  onCategoryChange,
  onClose,
  onCopyTemplate,
  onCreateCategory,
  onCreateTemplate,
  onDeleteCategory,
  onDeleteSelectedTemplates,
  onDeleteTemplate,
  onEditCategory,
  onEditTemplate,
  onExportAll,
  onExportCategory,
  onExportSelectedTemplates,
  onExportTemplate,
  onImport,
  onMoveSelectedTemplates,
  onOpenFolder,
  onScanImports,
  onSearchChange,
  onSelectAllVisibleTemplates,
  onSelectionChange,
  onCardScaleChange,
  onTypeFilterChange,
  onUseTemplate,
  onClearSelection,
  cardScale,
  search,
  selectedTemplateCount,
  selectedTemplateIds,
  selectedCategoryId,
  status,
  typeFilter,
  visibleTemplatesAllSelected
}: {
  categories: ImageToolPromptTemplateCategory[]
  currentCopy: (typeof copy)[Language]
  filteredTemplates: ImageToolPromptTemplate[]
  onCategoryChange: (categoryId: string) => void
  onClose: () => void
  onCopyTemplate: (template: ImageToolPromptTemplate) => void
  onCreateCategory: () => void
  onCreateTemplate: () => void
  onDeleteCategory: (category: ImageToolPromptTemplateCategory) => void
  onDeleteSelectedTemplates: () => void
  onDeleteTemplate: (template: ImageToolPromptTemplate) => void
  onEditCategory: (category: ImageToolPromptTemplateCategory) => void
  onEditTemplate: (template: ImageToolPromptTemplate) => void
  onExportAll: () => void
  onExportCategory: () => void
  onExportSelectedTemplates: () => void
  onExportTemplate: (template: ImageToolPromptTemplate) => void
  onImport: () => void
  onMoveSelectedTemplates: (categoryId: string) => void
  onOpenFolder: () => void
  onScanImports: () => void
  onSearchChange: (value: string) => void
  onSelectAllVisibleTemplates: () => void
  onSelectionChange: (templateId: string, selected: boolean) => void
  onCardScaleChange: (scale: PromptTemplateCardScale) => void
  onTypeFilterChange: (value: PromptTemplateTypeFilter) => void
  onUseTemplate: (template: ImageToolPromptTemplate) => void
  onClearSelection: () => void
  cardScale: PromptTemplateCardScale
  search: string
  selectedTemplateCount: number
  selectedTemplateIds: ReadonlySet<string>
  selectedCategoryId: string
  status?: string
  typeFilter: PromptTemplateTypeFilter
  visibleTemplatesAllSelected: boolean
}): React.JSX.Element {
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId)
  const canEditSelectedCategory = Boolean(selectedCategory && selectedCategory.id !== PROMPT_TEMPLATE_UNCATEGORIZED_ID)
  const hasSelectedTemplates = selectedTemplateCount > 0

  return (
    <div className="prompt-library-backdrop" role="presentation">
      <aside className="prompt-library-panel" aria-label={currentCopy.promptLibraryPanelLabel} role="dialog">
        <div className="prompt-library-header">
          <div>
            <p className="eyebrow">{currentCopy.promptLibrary}</p>
            <h2>{currentCopy.templateLibrary}</h2>
          </div>
          <button className="icon-button" onClick={onClose} type="button">
            {currentCopy.close}
          </button>
        </div>
        <div className="prompt-library-body">
          <nav className="prompt-category-pane" aria-label={currentCopy.category}>
            <button
              className={selectedCategoryId === 'all' ? 'prompt-category-button is-active' : 'prompt-category-button'}
              onClick={() => onCategoryChange('all')}
              type="button"
            >
              {currentCopy.allCategories}
            </button>
            {categories.map((category) => (
              <button
                className={
                  selectedCategoryId === category.id ? 'prompt-category-button is-active' : 'prompt-category-button'
                }
                key={category.id}
                onClick={() => onCategoryChange(category.id)}
                type="button"
              >
                {category.id === PROMPT_TEMPLATE_UNCATEGORIZED_ID ? currentCopy.uncategorized : category.name}
              </button>
            ))}
            <div className="prompt-category-actions">
              <button className="secondary-button" onClick={onCreateCategory} type="button">
                {currentCopy.newCategory}
              </button>
              <button
                className="secondary-button"
                disabled={!canEditSelectedCategory}
                onClick={() => selectedCategory && onEditCategory(selectedCategory)}
                type="button"
              >
                {currentCopy.renameCategory}
              </button>
              <button
                className="secondary-button danger-subtle-button"
                disabled={!canEditSelectedCategory}
                onClick={() => selectedCategory && onDeleteCategory(selectedCategory)}
                type="button"
              >
                {currentCopy.deleteCategory}
              </button>
            </div>
          </nav>
          <section className="prompt-template-pane">
            <div className="prompt-template-toolbar">
              <input
                aria-label={currentCopy.searchTemplates}
                onChange={(event) => onSearchChange(event.currentTarget.value)}
                placeholder={currentCopy.searchTemplates}
                value={search}
              />
              <select
                aria-label={currentCopy.templateType}
                onChange={(event) => onTypeFilterChange(event.currentTarget.value as PromptTemplateTypeFilter)}
                value={typeFilter}
              >
                <option value="all">{currentCopy.allTemplateTypes}</option>
                <option value="text_to_image">{currentCopy.textToImage}</option>
                <option value="image_to_image">{currentCopy.imageToImage}</option>
              </select>
              <button className="generate-button" onClick={onCreateTemplate} type="button">
                {currentCopy.newPromptTemplate}
              </button>
            </div>
            <div className="prompt-template-io-actions">
              <button className="secondary-button" onClick={onImport} type="button">
                {currentCopy.importPromptTemplateFile}
              </button>
              <button className="secondary-button" onClick={onScanImports} type="button">
                {currentCopy.scanImport}
              </button>
              <button
                className="secondary-button"
                disabled={selectedCategoryId === 'all'}
                onClick={onExportCategory}
                type="button"
              >
                {currentCopy.exportCategory}
              </button>
              <button className="secondary-button" onClick={onExportAll} type="button">
                {currentCopy.exportAll}
              </button>
              <button className="secondary-button" onClick={onOpenFolder} type="button">
                {currentCopy.openTemplateFolder}
              </button>
              <div className="prompt-template-card-scale" aria-label={currentCopy.templateCardSize}>
                <span>{currentCopy.templateCardSize}</span>
                {(['compact', 'comfortable', 'large'] as const).map((scale) => (
                  <button
                    aria-pressed={cardScale === scale}
                    className="secondary-button"
                    key={scale}
                    onClick={() => onCardScaleChange(scale)}
                    type="button"
                  >
                    {scale === 'compact'
                      ? currentCopy.templateCardCompact
                      : scale === 'comfortable'
                        ? currentCopy.templateCardComfortable
                        : currentCopy.templateCardLarge}
                  </button>
                ))}
              </div>
            </div>
            <div className="prompt-template-bulk-actions">
              <button
                className="secondary-button"
                disabled={filteredTemplates.length === 0}
                onClick={onSelectAllVisibleTemplates}
                type="button"
              >
                {visibleTemplatesAllSelected
                  ? currentCopy.clearVisibleTemplateSelection
                  : currentCopy.selectAllVisibleTemplates}
              </button>
              <span className="prompt-template-selection-count">
                {currentCopy.selectedTemplates.replace('{count}', String(selectedTemplateCount))}
              </span>
              <select
                aria-label={currentCopy.moveToCategory}
                disabled={!hasSelectedTemplates}
                onChange={(event) => {
                  const categoryId = event.currentTarget.value
                  event.currentTarget.value = ''

                  if (categoryId) {
                    onMoveSelectedTemplates(categoryId)
                  }
                }}
                value=""
              >
                <option value="">{currentCopy.moveSelectedTemplates}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.id === PROMPT_TEMPLATE_UNCATEGORIZED_ID ? currentCopy.uncategorized : category.name}
                  </option>
                ))}
              </select>
              <button
                className="secondary-button"
                disabled={!hasSelectedTemplates}
                onClick={onExportSelectedTemplates}
                type="button"
              >
                {currentCopy.exportSelectedTemplates}
              </button>
              <button
                className="secondary-button danger-subtle-button"
                disabled={!hasSelectedTemplates}
                onClick={onDeleteSelectedTemplates}
                type="button"
              >
                {currentCopy.deleteSelectedTemplates}
              </button>
              <button
                className="secondary-button"
                disabled={!hasSelectedTemplates}
                onClick={onClearSelection}
                type="button"
              >
                {currentCopy.clearTemplateSelection}
              </button>
            </div>
            {status && <p className="prompt-library-status">{status}</p>}
            {filteredTemplates.length === 0 ? (
              <p className="prompt-template-empty">{currentCopy.noTemplates}</p>
            ) : (
              <div className="prompt-template-grid" data-card-scale={cardScale}>
                {filteredTemplates.map((template) => (
                  <PromptTemplateCard
                    key={template.id}
                    template={template}
                    text={currentCopy}
                    isSelected={selectedTemplateIds.has(template.id)}
                    onCopy={onCopyTemplate}
                    onDelete={onDeleteTemplate}
                    onEdit={onEditTemplate}
                    onExport={onExportTemplate}
                    onSelectionChange={onSelectionChange}
                    onUse={onUseTemplate}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </aside>
    </div>
  )
}

function PromptTemplateCard({
  isSelected,
  onCopy,
  onDelete,
  onEdit,
  onExport,
  onSelectionChange,
  onUse,
  template,
  text
}: {
  isSelected: boolean
  onCopy: (template: ImageToolPromptTemplate) => void
  onDelete: (template: ImageToolPromptTemplate) => void
  onEdit: (template: ImageToolPromptTemplate) => void
  onExport: (template: ImageToolPromptTemplate) => void
  onSelectionChange: (templateId: string, selected: boolean) => void
  onUse: (template: ImageToolPromptTemplate) => void
  template: ImageToolPromptTemplate
  text: (typeof copy)[Language]
}): React.JSX.Element {
  const descriptionText = template.description?.trim()
  const promptSummary = template.prompt.trim()
  const visibleTags = (template.tags ?? []).slice(0, TEMPLATE_CARD_TAG_LIMIT)
  const hiddenTagCount = Math.max((template.tags?.length ?? 0) - visibleTags.length, 0)

  return (
    <article className={isSelected ? 'prompt-template-card is-selected' : 'prompt-template-card'}>
      <label className="prompt-template-card-select">
        <input
          checked={isSelected}
          onChange={(event) => onSelectionChange(template.id, event.currentTarget.checked)}
          type="checkbox"
        />
        <span>{text.selectTemplate}</span>
      </label>
      <div className="prompt-template-preview">
        {template.previewDataUrl ? (
          <img alt={template.title} src={template.previewDataUrl} />
        ) : (
          <span>{text.noPreview}</span>
        )}
      </div>
      <div className="prompt-template-card-body">
        <div className="prompt-template-card-title">
          <h3>{template.title}</h3>
          <span className={`prompt-template-type prompt-template-type-${template.templateType}`}>
            {getPromptTemplateTypeLabel(template.templateType, text)}
          </span>
        </div>
        {descriptionText && <p className="prompt-template-description">{descriptionText}</p>}
        <p className="prompt-template-summary">{promptSummary}</p>
        {visibleTags.length > 0 && (
          <div className="prompt-template-tags">
            {visibleTags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
            {hiddenTagCount > 0 && <span>{`+${hiddenTagCount}`}</span>}
          </div>
        )}
      </div>
      <div className="prompt-template-card-actions">
        <button className="generate-button prompt-template-use-button" onClick={() => onUse(template)} type="button">
          {text.useTemplate}
        </button>
        <button className="secondary-button" onClick={() => onCopy(template)} type="button">
          {text.copyPrompt}
        </button>
        <button className="secondary-button" onClick={() => onEdit(template)} type="button">
          {text.editPromptTemplate}
        </button>
        <button className="secondary-button" onClick={() => onExport(template)} type="button">
          {text.exportTemplate}
        </button>
        <button className="secondary-button danger-subtle-button" onClick={() => onDelete(template)} type="button">
          {text.deletePromptTemplate}
        </button>
      </div>
    </article>
  )
}

function PromptTemplateCategoryDialog({
  onCancel,
  onChange,
  onSubmit,
  state,
  text
}: {
  onCancel: () => void
  onChange: (state: PromptTemplateCategoryDialogState) => void
  onSubmit: (state: PromptTemplateCategoryDialogState) => void
  state: PromptTemplateCategoryDialogState
  text: (typeof copy)[Language]
}): React.JSX.Element {
  const title = state.mode === 'create' ? text.newCategory : text.renameCategory

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit(state)
  }

  return (
    <div className="template-editor-backdrop" role="presentation">
      <section className="prompt-category-dialog" aria-label={title} role="dialog">
        <div className="settings-drawer-header">
          <div>
            <p className="eyebrow">{text.promptLibrary}</p>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" onClick={onCancel} type="button">
            {text.close}
          </button>
        </div>
        <form className="prompt-category-form" onSubmit={handleSubmit}>
          <label className="compact-field">
            <span>{text.categoryNamePrompt}</span>
            <input
              autoFocus
              onChange={(event) => onChange({ ...state, name: event.currentTarget.value, error: undefined })}
              value={state.name}
            />
          </label>
          {state.error && <p className="composer-upload-error">{state.error}</p>}
          <div className="settings-drawer-actions">
            <button className="secondary-button" onClick={onCancel} type="button">
              {text.cancel}
            </button>
            <button className="generate-button" type="submit">
              {text.saveCategory}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function PromptTemplateEditorDialog({
  categories,
  draft,
  onCancel,
  onChange,
  onSave,
  text
}: {
  categories: ImageToolPromptTemplateCategory[]
  draft: PromptTemplateEditorDraft
  onCancel: () => void
  onChange: (patch: Partial<PromptTemplateEditorDraft>) => void
  onSave: (draft: PromptTemplateEditorDraft) => void
  text: (typeof copy)[Language]
}): React.JSX.Element {
  const updateVariable = (index: number, patch: Partial<PromptTemplateVariableDraft>) => {
    onChange({
      variables: draft.variables.map((variable, variableIndex) =>
        variableIndex === index ? { ...variable, ...patch } : variable
      )
    })
  }

  const handlePreviewUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''

    if (!file || !file.type.startsWith('image/')) {
      return
    }

    const reader = new FileReader()
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        onChange({ previewDataUrl: reader.result, removePreview: false })
      }
    })
    reader.readAsDataURL(file)
  }

  return (
    <div className="template-editor-backdrop" role="presentation">
      <section
        className="prompt-template-editor"
        aria-label={draft.id ? text.editPromptTemplate : text.newPromptTemplate}
        role="dialog"
      >
        <div className="settings-drawer-header">
          <div>
            <p className="eyebrow">{text.promptLibrary}</p>
            <h2>{draft.id ? text.editPromptTemplate : text.newPromptTemplate}</h2>
          </div>
          <button className="icon-button" onClick={onCancel} type="button">
            {text.close}
          </button>
        </div>
        <div className="prompt-template-editor-body">
          <div className="prompt-template-editor-top">
            <label className="compact-field">
              <span>{text.title}</span>
              <input onChange={(event) => onChange({ title: event.currentTarget.value })} value={draft.title} />
            </label>
            <label className="compact-field">
              <span>{text.category}</span>
              <select
                onChange={(event) => onChange({ categoryId: event.currentTarget.value })}
                value={draft.categoryId ?? PROMPT_TEMPLATE_UNCATEGORIZED_ID}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.id === PROMPT_TEMPLATE_UNCATEGORIZED_ID ? text.uncategorized : category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="compact-field">
              <span>{text.templateType}</span>
              <select
                onChange={(event) =>
                  onChange({ templateType: event.currentTarget.value as ImageToolPromptTemplateType })
                }
                value={draft.templateType}
              >
                <option value="text_to_image">{text.textToImage}</option>
                <option value="image_to_image">{text.imageToImage}</option>
              </select>
            </label>
            <label className="compact-field">
              <span>{text.description}</span>
              <input
                onChange={(event) => onChange({ description: event.currentTarget.value })}
                value={draft.description}
              />
            </label>
            <label className="compact-field">
              <span>{text.recommendedSize}</span>
              <select
                aria-label={text.recommendedSize}
                onChange={(event) => onChange({ recommendedSize: event.currentTarget.value })}
                value={draft.recommendedSize || 'auto'}
              >
                {composerSizeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label[text.close === '关闭' ? 'zh' : 'en']}
                  </option>
                ))}
              </select>
            </label>
            <label className="compact-field">
              <span>{text.recommendedQuality}</span>
              <select
                aria-label={text.recommendedQuality}
                onChange={(event) =>
                  onChange({ recommendedQuality: event.currentTarget.value as ImageToolImage2Quality | '' })
                }
                value={draft.recommendedQuality}
              >
                <option value="">{text.none}</option>
                {templateRecommendedQualityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="compact-field">
              <span>{text.recommendedFormat}</span>
              <select
                aria-label={text.recommendedFormat}
                onChange={(event) =>
                  onChange({ recommendedOutputFormat: event.currentTarget.value as ImageToolImage2OutputFormat | '' })
                }
                value={draft.recommendedOutputFormat}
              >
                <option value="">{text.none}</option>
                {templateRecommendedFormatOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="compact-field prompt-template-editor-wide prompt-template-prompt-field">
            <span>{text.promptTemplatePrompt}</span>
            <textarea
              onChange={(event) => onChange({ prompt: event.currentTarget.value })}
              placeholder={text.promptTemplatePrompt}
              value={draft.prompt}
            />
          </label>
          <div className="prompt-template-editor-bottom prompt-template-editor-wide">
            <div className="prompt-template-preview-editor">
              <span>{text.effectImage}</span>
              <div>
                {draft.previewDataUrl ? (
                  <img alt={text.effectImage} src={draft.previewDataUrl} />
                ) : (
                  <div className="prompt-template-preview-placeholder">{text.noPreview}</div>
                )}
                <label className="secondary-button">
                  {text.previewUpload}
                  <input accept="image/*" onChange={handlePreviewUpload} type="file" />
                </label>
                <button
                  className="secondary-button"
                  onClick={() => onChange({ previewDataUrl: undefined, removePreview: true })}
                  type="button"
                >
                  {text.removePreview}
                </button>
              </div>
            </div>
            <label className="compact-field prompt-template-editor-wide">
              <span>{text.tags}</span>
              <input onChange={(event) => onChange({ tags: event.currentTarget.value })} value={draft.tags} />
            </label>
          </div>
          <fieldset className="prompt-template-editor-wide prompt-template-fieldset prompt-template-variable-fieldset">
            <legend>{text.variables}</legend>
            {draft.variables.map((variable, index) => (
              <div className="prompt-template-variable-row" key={`${variable.key}-${index}`}>
                <input
                  aria-label={text.variableKey}
                  onChange={(event) => updateVariable(index, { key: event.currentTarget.value })}
                  placeholder={text.variableKey}
                  value={variable.key}
                />
                <input
                  aria-label={text.variableLabel}
                  onChange={(event) => updateVariable(index, { label: event.currentTarget.value })}
                  placeholder={text.variableLabel}
                  value={variable.label}
                />
                <input
                  aria-label={text.variableDefault}
                  onChange={(event) => updateVariable(index, { defaultValue: event.currentTarget.value })}
                  placeholder={text.variableDefault}
                  value={variable.defaultValue}
                />
                <input
                  aria-label={text.variablePlaceholder}
                  onChange={(event) => updateVariable(index, { placeholder: event.currentTarget.value })}
                  placeholder={text.variablePlaceholder}
                  value={variable.placeholder}
                />
                <label>
                  <input
                    checked={variable.required}
                    onChange={(event) => updateVariable(index, { required: event.currentTarget.checked })}
                    type="checkbox"
                  />
                  {text.variableRequired}
                </label>
                <button
                  className="secondary-button danger-subtle-button"
                  onClick={() =>
                    onChange({ variables: draft.variables.filter((_, variableIndex) => variableIndex !== index) })
                  }
                  type="button"
                >
                  {text.removeVariable}
                </button>
              </div>
            ))}
            <button
              className="secondary-button prompt-template-add-variable-button"
              onClick={() =>
                onChange({
                  variables: [
                    ...draft.variables,
                    {
                      key: '',
                      label: '',
                      placeholder: '',
                      required: false,
                      defaultValue: ''
                    }
                  ]
                })
              }
              type="button"
            >
              {text.addVariable}
            </button>
          </fieldset>
        </div>
        <div className="settings-drawer-actions">
          <button className="secondary-button" onClick={onCancel} type="button">
            {text.cancel}
          </button>
          <button className="generate-button" onClick={() => onSave(draft)} type="button">
            {text.saveTemplate}
          </button>
        </div>
      </section>
    </div>
  )
}

function PromptTemplateVariableDialog({
  onCancel,
  onChange,
  onSubmit,
  state,
  text
}: {
  onCancel: () => void
  onChange: (state: PromptTemplateVariableDialogState) => void
  onSubmit: () => void
  state: PromptTemplateVariableDialogState
  text: (typeof copy)[Language]
}): React.JSX.Element {
  return (
    <div className="template-editor-backdrop" role="presentation">
      <section className="prompt-variable-dialog" aria-label={text.templateVariables} role="dialog">
        <div className="settings-drawer-header">
          <div>
            <p className="eyebrow">{text.promptLibrary}</p>
            <h2>{text.templateVariables}</h2>
          </div>
          <button className="icon-button" onClick={onCancel} type="button">
            {text.close}
          </button>
        </div>
        <div className="prompt-variable-body">
          <div className="prompt-apply-mode">
            <label>
              <input
                checked={state.applyMode === 'replace'}
                onChange={() => onChange({ ...state, applyMode: 'replace', error: undefined })}
                type="radio"
              />
              {text.replaceCurrentPrompt}
            </label>
            <label>
              <input
                checked={state.applyMode === 'append'}
                onChange={() => onChange({ ...state, applyMode: 'append', error: undefined })}
                type="radio"
              />
              {text.appendToCurrentPrompt}
            </label>
          </div>
          {(state.template.variables ?? []).map((variable) => (
            <label className="compact-field" key={variable.key}>
              <span>
                {variable.label}
                {variable.required ? ' *' : ''}
              </span>
              <input
                onChange={(event) =>
                  onChange({
                    ...state,
                    values: {
                      ...state.values,
                      [variable.key]: event.currentTarget.value
                    },
                    error: undefined
                  })
                }
                placeholder={variable.placeholder}
                value={state.values[variable.key] ?? ''}
              />
            </label>
          ))}
          {state.error && <p className="composer-upload-error">{state.error}</p>}
        </div>
        <div className="settings-drawer-actions">
          <button className="secondary-button" onClick={onCancel} type="button">
            {text.cancel}
          </button>
          <button className="generate-button" onClick={onSubmit} type="button">
            {text.fillVariables}
          </button>
        </div>
      </section>
    </div>
  )
}

function ConnectionTestResultPanel({
  label,
  result,
  text
}: {
  label: string
  result: ImageToolTestConnectionResult
  text: (typeof copy)[Language]
}): React.JSX.Element {
  return (
    <section className={result.ok ? 'connection-result success' : 'connection-result failed'} aria-label={label}>
      <div className="connection-result-header">
        <strong>{label}</strong>
        <span>{result.ok ? text.success : text.failed}</span>
      </div>
      <dl>
        <div>
          <dt>{text.connectionEndpoint}</dt>
          <dd>{result.endpoint ?? text.unknown}</dd>
        </div>
        {result.ok ? (
          <>
            <div>
              <dt>{text.connectionModel}</dt>
              <dd>{result.model}</dd>
            </div>
            <div>
              <dt>{text.connectionSize}</dt>
              <dd>{result.size}</dd>
            </div>
            <div>
              <dt>{text.connectionHasUrl}</dt>
              <dd>{String(result.hasUrl)}</dd>
            </div>
            <div>
              <dt>{text.connectionHasB64Json}</dt>
              <dd>{String(result.hasB64Json)}</dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt>{text.connectionCode}</dt>
              <dd>{result.code}</dd>
            </div>
            <div>
              <dt>{text.connectionHttpStatus}</dt>
              <dd>{result.httpStatus ?? text.none}</dd>
            </div>
            <div>
              <dt>{text.connectionUpstreamCode}</dt>
              <dd>{result.upstreamCode ?? text.none}</dd>
            </div>
            <div>
              <dt>{text.connectionUpstreamType}</dt>
              <dd>{result.upstreamType ?? text.none}</dd>
            </div>
            <div className="connection-result-wide">
              <dt>{text.connectionMessage}</dt>
              <dd>{result.message}</dd>
            </div>
          </>
        )}
        {result.requestSummary && (
          <div className="connection-result-wide">
            <dt>{text.connectionRequestSummary}</dt>
            <dd>{JSON.stringify(result.requestSummary)}</dd>
          </div>
        )}
      </dl>
    </section>
  )
}

function ApiSettingsDrawer({
  connectionTestResult,
  currentCopy,
  draft,
  editEndpoint,
  endpoint,
  isTestingConnection,
  onAddTemplate,
  onCancel,
  onDeleteTemplate,
  onDraftChange,
  onEditTemplate,
  onSave,
  onSaveTemplate,
  onTemplateEditorCancel,
  onTemplateEditorChange,
  onTemplateChange,
  onTestConnection,
  quality,
  resolvedSizeLabel,
  settingsStatus,
  template,
  templateEditorDraft,
  templateEditorStatus,
  templates
}: {
  connectionTestResult: ImageToolTestConnectionResult | undefined
  currentCopy: (typeof copy)[Language]
  draft: ApiSettingsDraft
  editEndpoint: string
  endpoint: string
  isTestingConnection: boolean
  onAddTemplate: () => void
  onCancel: () => void
  onDeleteTemplate: () => void
  onDraftChange: (patch: Partial<ApiSettingsDraft>) => void
  onEditTemplate: () => void
  onSave: () => void
  onSaveTemplate: () => void
  onTemplateEditorCancel: () => void
  onTemplateEditorChange: (patch: Partial<TemplateEditorDraft>) => void
  onTemplateChange: (templateId: string) => void
  onTestConnection: () => void
  quality: ImageToolImage2Quality
  resolvedSizeLabel: string
  settingsStatus: string | undefined
  template: ImageProviderTemplate
  templateEditorDraft: TemplateEditorDraft | undefined
  templateEditorStatus: string | undefined
  templates: ImageProviderTemplate[]
}): React.JSX.Element {
  const canEditSelectedTemplate = !protectedImageProviderTemplateIds.has(draft.providerTemplateId)
  const selectedTemplateLabel = getProviderTemplateLabel(template, currentCopy)
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false)

  return (
    <div className="settings-drawer-backdrop" role="presentation">
      <aside className="settings-drawer" aria-label={currentCopy.providerSettings} aria-modal="true" role="dialog">
        <div className="settings-drawer-header">
          <div>
            <p className="eyebrow">{currentCopy.settings}</p>
            <h2>{currentCopy.providerSettings}</h2>
          </div>
          <button className="icon-button" onClick={onCancel} type="button">
            {currentCopy.close}
          </button>
        </div>

        <div className="settings-drawer-body">
          <section className="settings-section">
            <label className="compact-field template-field" htmlFor="provider-template">
              <span>{currentCopy.providerTemplate}</span>
              <select
                id="provider-template"
                onChange={(event) => onTemplateChange(event.currentTarget.value)}
                value={draft.providerTemplateId}
              >
                {templates.map((providerTemplate) => (
                  <option key={providerTemplate.id} value={providerTemplate.id}>
                    {getProviderTemplateLabel(providerTemplate, currentCopy).name}
                  </option>
                ))}
              </select>
            </label>
            <div className="template-actions">
              <button className="secondary-button" onClick={onAddTemplate} type="button">
                {currentCopy.addTemplate}
              </button>
              <button
                className="secondary-button"
                disabled={!canEditSelectedTemplate}
                onClick={onEditTemplate}
                type="button"
              >
                {currentCopy.editTemplate}
              </button>
              <button
                className="secondary-button danger-button"
                disabled={!canEditSelectedTemplate}
                onClick={onDeleteTemplate}
                type="button"
              >
                {currentCopy.deleteTemplate}
              </button>
            </div>
            <div className="template-description" aria-label={currentCopy.templateDescription}>
              <strong>{selectedTemplateLabel.name}</strong>
              {selectedTemplateLabel.description && <span>{selectedTemplateLabel.description}</span>}
              {selectedTemplateLabel.notes && <span>{selectedTemplateLabel.notes}</span>}
            </div>
            <label className="compact-field" htmlFor="base-url">
              <span>{currentCopy.baseUrl}</span>
              <input
                id="base-url"
                onChange={(event) => onDraftChange({ baseUrl: event.currentTarget.value })}
                placeholder="https://api.openai.com"
                type="url"
                value={draft.baseUrl}
              />
            </label>
            <label className="compact-field" htmlFor="api-key">
              <span>{currentCopy.apiKey}</span>
              <div className="api-key-input-wrap">
                <input
                  autoComplete="off"
                  id="api-key"
                  onChange={(event) => onDraftChange({ apiKey: event.currentTarget.value })}
                  type={isApiKeyVisible ? 'text' : 'password'}
                  value={draft.apiKey}
                />
                <button
                  aria-label={isApiKeyVisible ? currentCopy.hideApiKey : currentCopy.showApiKey}
                  onClick={() => setIsApiKeyVisible((isVisible) => !isVisible)}
                  type="button"
                >
                  {isApiKeyVisible ? currentCopy.hideApiKey : currentCopy.showApiKey}
                </button>
              </div>
            </label>
            <label className="compact-field" htmlFor="settings-model">
              <span>{currentCopy.model}</span>
              <input
                id="settings-model"
                onChange={(event) => onDraftChange({ model: event.currentTarget.value })}
                type="text"
                value={draft.model}
              />
            </label>
          </section>

          {templateEditorDraft && (
            <section className="template-editor" aria-label={currentCopy.editTemplate}>
              <div className="request-preview-header">
                <strong>{templateEditorDraft.id ? currentCopy.editTemplate : currentCopy.addTemplate}</strong>
              </div>
              <label className="compact-field" htmlFor="template-name">
                <span>{currentCopy.templateName}</span>
                <input
                  id="template-name"
                  onChange={(event) => onTemplateEditorChange({ name: event.currentTarget.value })}
                  type="text"
                  value={templateEditorDraft.name}
                />
              </label>
              <label className="compact-field" htmlFor="template-description">
                <span>{currentCopy.templateDescription}</span>
                <input
                  id="template-description"
                  onChange={(event) => onTemplateEditorChange({ description: event.currentTarget.value })}
                  type="text"
                  value={templateEditorDraft.description}
                />
              </label>
              <label className="compact-field" htmlFor="template-base-url">
                <span>{currentCopy.baseUrl}</span>
                <input
                  id="template-base-url"
                  onChange={(event) => onTemplateEditorChange({ defaultBaseUrl: event.currentTarget.value })}
                  placeholder="https://api.openai.com"
                  type="url"
                  value={templateEditorDraft.defaultBaseUrl}
                />
              </label>
              <label className="compact-field" htmlFor="template-endpoint-path">
                <span>{currentCopy.endpointPath}</span>
                <input
                  id="template-endpoint-path"
                  onChange={(event) => onTemplateEditorChange({ endpointPath: event.currentTarget.value })}
                  placeholder="/v1/images/generations or /images/generations"
                  type="text"
                  value={templateEditorDraft.endpointPath}
                />
              </label>
              <label className="compact-field" htmlFor="template-edit-endpoint-path">
                <span>{currentCopy.editEndpointPath}</span>
                <input
                  id="template-edit-endpoint-path"
                  onChange={(event) => onTemplateEditorChange({ editEndpointPath: event.currentTarget.value })}
                  placeholder="/v1/images/edits"
                  type="text"
                  value={templateEditorDraft.editEndpointPath}
                />
              </label>
              <label className="compact-field" htmlFor="template-model">
                <span>{currentCopy.model}</span>
                <input
                  id="template-model"
                  onChange={(event) => onTemplateEditorChange({ model: event.currentTarget.value })}
                  type="text"
                  value={templateEditorDraft.model}
                />
              </label>
              <label className="checkbox-field" htmlFor="template-send-output-format">
                <input
                  checked={templateEditorDraft.sendOutputFormat}
                  id="template-send-output-format"
                  onChange={(event) => onTemplateEditorChange({ sendOutputFormat: event.currentTarget.checked })}
                  type="checkbox"
                />
                <span>{currentCopy.sendOutputFormat}</span>
              </label>
              <label className="compact-field" htmlFor="template-output-format">
                <span>{currentCopy.outputFormat}</span>
                <select
                  id="template-output-format"
                  onChange={(event) =>
                    onTemplateEditorChange({ outputFormat: event.currentTarget.value as ImageToolImage2OutputFormat })
                  }
                  value={templateEditorDraft.outputFormat}
                >
                  {outputFormatOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="checkbox-field" htmlFor="template-send-response-format">
                <input
                  checked={templateEditorDraft.sendResponseFormat}
                  id="template-send-response-format"
                  onChange={(event) => onTemplateEditorChange({ sendResponseFormat: event.currentTarget.checked })}
                  type="checkbox"
                />
                <span>{currentCopy.sendResponseFormat}</span>
              </label>
              <label className="compact-field" htmlFor="template-response-format">
                <span>{currentCopy.responseFormat}</span>
                <select
                  disabled={!templateEditorDraft.sendResponseFormat}
                  id="template-response-format"
                  onChange={(event) =>
                    onTemplateEditorChange({
                      responseFormat: event.currentTarget.value as ImageToolImage2ResponseFormat
                    })
                  }
                  value={templateEditorDraft.responseFormat}
                >
                  {responseFormatOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <RequestPreviewPanel
                endpoint={createRequestEndpoint(templateEditorDraft.defaultBaseUrl, templateEditorDraft.endpointPath)}
                editEndpoint={createRequestEndpoint(
                  templateEditorDraft.defaultBaseUrl,
                  templateEditorDraft.editEndpointPath
                )}
                label={currentCopy.requestPreview}
                model={templateEditorDraft.model || 'gpt-image-2'}
                quality={quality}
                sendOutputFormat={templateEditorDraft.sendOutputFormat}
                sendResponseFormat={templateEditorDraft.sendResponseFormat}
                size={resolvedSizeLabel}
                templateName={templateEditorDraft.name || currentCopy.addTemplate}
                text={currentCopy}
              />
              <div className="template-editor-actions">
                <button className="secondary-button" onClick={onTemplateEditorCancel} type="button">
                  {currentCopy.cancel}
                </button>
                <button className="generate-button" onClick={onSaveTemplate} type="button">
                  {currentCopy.saveTemplate}
                </button>
              </div>
              {templateEditorStatus && <p className="settings-status">{templateEditorStatus}</p>}
            </section>
          )}

          <RequestPreviewPanel
            endpoint={endpoint}
            editEndpoint={editEndpoint}
            label={currentCopy.requestPreview}
            model={draft.model || 'gpt-image-2'}
            quality={quality}
            sendOutputFormat={draft.sendOutputFormat}
            sendResponseFormat={draft.sendResponseFormat}
            size={resolvedSizeLabel}
            templateName={selectedTemplateLabel.name}
            text={currentCopy}
          />

          <details className="advanced-settings">
            <summary>{currentCopy.advancedSettings}</summary>
            <label className="compact-field" htmlFor="endpoint-path">
              <span>{currentCopy.endpointPath}</span>
              <input
                id="endpoint-path"
                onChange={(event) => onDraftChange({ endpointPath: event.currentTarget.value })}
                type="text"
                value={draft.endpointPath}
              />
            </label>
            <label className="compact-field" htmlFor="edit-endpoint-path">
              <span>{currentCopy.editEndpointPath}</span>
              <input
                id="edit-endpoint-path"
                onChange={(event) => onDraftChange({ editEndpointPath: event.currentTarget.value })}
                type="text"
                value={draft.editEndpointPath}
              />
            </label>
            <label className="checkbox-field" htmlFor="send-output-format">
              <input
                checked={draft.sendOutputFormat}
                id="send-output-format"
                onChange={(event) => onDraftChange({ sendOutputFormat: event.currentTarget.checked })}
                type="checkbox"
              />
              <span>{currentCopy.sendOutputFormat}</span>
            </label>
            <label className="compact-field" htmlFor="advanced-output-format">
              <span>{currentCopy.outputFormat}</span>
              <select
                id="advanced-output-format"
                onChange={(event) =>
                  onDraftChange({ outputFormat: event.currentTarget.value as ImageToolImage2OutputFormat })
                }
                value={draft.outputFormat}
              >
                {outputFormatOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox-field" htmlFor="send-response-format">
              <input
                checked={draft.sendResponseFormat}
                id="send-response-format"
                onChange={(event) => onDraftChange({ sendResponseFormat: event.currentTarget.checked })}
                type="checkbox"
              />
              <span>{currentCopy.sendResponseFormat}</span>
            </label>
            <label className="compact-field" htmlFor="response-format">
              <span>{currentCopy.responseFormat}</span>
              <select
                disabled={!draft.sendResponseFormat}
                id="response-format"
                onChange={(event) =>
                  onDraftChange({ responseFormat: event.currentTarget.value as ImageToolImage2ResponseFormat })
                }
                value={draft.responseFormat}
              >
                {responseFormatOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <p>{currentCopy.compatibilityHint}</p>
          </details>

          {connectionTestResult && (
            <ConnectionTestResultPanel
              label={currentCopy.connectionTestResult}
              result={connectionTestResult}
              text={currentCopy}
            />
          )}
          {settingsStatus && <p className="settings-status">{settingsStatus}</p>}

          <details className="debug-details">
            <summary>{currentCopy.debugDetails}</summary>
            <div className="bridge-diagnostics" aria-label={currentCopy.diagnosticsTitle}>
              <div className="diagnostics-row">
                <strong>providerTemplateId</strong>
                <span>{draft.providerTemplateId}</span>
              </div>
              <div className="diagnostics-row">
                <strong>hasApiKey</strong>
                <span>{draft.apiKey.trim() ? 'true' : 'false'}</span>
              </div>
              <div className="diagnostics-row">
                <strong>credentialsTemplateCount</strong>
                <span>{Object.keys(draft.providerCredentials).length}</span>
              </div>
              <div className="diagnostics-row">
                <strong>currentTemplateHasApiKey</strong>
                <span>
                  {getProviderCredentialApiKey(draft.providerCredentials, draft.providerTemplateId).trim()
                    ? 'true'
                    : 'false'}
                </span>
              </div>
            </div>
          </details>
        </div>

        <div className="settings-drawer-actions">
          <button className="secondary-button" onClick={onCancel} type="button">
            {currentCopy.cancel}
          </button>
          <button
            className="secondary-button settings-test-button"
            disabled={isTestingConnection}
            onClick={onTestConnection}
            type="button"
          >
            {isTestingConnection ? currentCopy.testingConnection : currentCopy.testConnection}
          </button>
          <button className="generate-button" onClick={onSave} type="button">
            {currentCopy.saveSettings}
          </button>
        </div>
      </aside>
    </div>
  )
}

function TaskUsagePanel({
  currentProviderTemplateId,
  defaultUnitPriceDraft,
  filters,
  language,
  onClear,
  onClose,
  onDefaultUnitPriceDraftChange,
  onExportCsv,
  onFiltersChange,
  onProviderUnitPriceDraftChange,
  onSavePrices,
  projects,
  providerUnitPriceDraft,
  snapshot,
  status,
  templates,
  text
}: {
  currentProviderTemplateId: string
  defaultUnitPriceDraft: string
  filters: UsageFilters
  language: Language
  onClear: () => void
  onClose: () => void
  onDefaultUnitPriceDraftChange: (value: string) => void
  onExportCsv: () => void
  onFiltersChange: (filters: UsageFilters) => void
  onProviderUnitPriceDraftChange: (value: string) => void
  onSavePrices: () => void
  projects: ImageToolProjectGroup[]
  providerUnitPriceDraft: string
  snapshot: ImageToolTaskUsageSnapshot
  status?: string
  templates: ImageProviderTemplate[]
  text: (typeof copy)[Language]
}): React.JSX.Element {
  const stats = snapshot.stats
  const projectNameById = new Map(projects.map((project) => [project.id, project.name]))
  const currentTemplate = getImageProviderTemplate(currentProviderTemplateId, templates)
  const currentTemplateName = getProviderTemplateLabel(currentTemplate, text).name
  const updateFilter = (patch: Partial<UsageFilters>) => onFiltersChange({ ...filters, ...patch })

  return (
    <div className="settings-drawer-backdrop usage-panel-backdrop" role="presentation">
      <aside className="settings-drawer usage-panel" aria-label={text.usageTitle} aria-modal="true" role="dialog">
        <div className="settings-drawer-header">
          <div>
            <p className="eyebrow">{text.tasksUsage}</p>
            <h2>{text.usageTitle}</h2>
          </div>
          <button className="icon-button" onClick={onClose} type="button">
            {text.close}
          </button>
        </div>
        <div className="settings-drawer-body usage-panel-body">
          <section className="usage-stats-grid" aria-label={text.usageTitle}>
            <UsageStatCard label={text.usageStatsTotalTasks} value={stats.totalTasks} />
            <UsageStatCard label={text.usageStatsSucceededTasks} value={stats.succeededTasks} />
            <UsageStatCard label={text.usageStatsFailedTasks} value={stats.failedTasks} />
            <UsageStatCard label={text.usageStatsRunningTasks} value={stats.runningTasks} />
            <UsageStatCard label={text.usageStatsSuccessfulImages} value={stats.successfulImages} />
            <UsageStatCard label={text.usageStatsTotalCost} value={formatCurrencyCny(stats.totalCost)} />
          </section>

          <section className="settings-section usage-price-section" aria-label={text.usagePriceSettings}>
            <div className="request-preview-header">
              <strong>{text.usagePriceSettings}</strong>
            </div>
            <label className="compact-field" htmlFor="usage-default-price">
              <span>{text.usageDefaultUnitPrice}</span>
              <input
                id="usage-default-price"
                inputMode="decimal"
                min="0"
                onChange={(event) => onDefaultUnitPriceDraftChange(event.currentTarget.value)}
                step="0.0001"
                type="number"
                value={defaultUnitPriceDraft}
              />
            </label>
            <label className="compact-field" htmlFor="usage-provider-price">
              <span>
                {text.usageCurrentProviderUnitPrice} · {currentTemplateName}
              </span>
              <input
                id="usage-provider-price"
                inputMode="decimal"
                min="0"
                onChange={(event) => onProviderUnitPriceDraftChange(event.currentTarget.value)}
                step="0.0001"
                type="number"
                value={providerUnitPriceDraft}
              />
            </label>
            <p className="usage-price-note">{text.usageUnitLabel}</p>
            <button className="generate-button" onClick={onSavePrices} type="button">
              {text.usageSavePrices}
            </button>
          </section>

          <section className="settings-section usage-filter-section" aria-label={text.usageFilters}>
            <div className="request-preview-header">
              <strong>{text.usageFilters}</strong>
            </div>
            <label className="compact-field">
              <span>{text.usageTableApi}</span>
              <select
                onChange={(event) => updateFilter({ providerTemplateId: event.currentTarget.value })}
                value={filters.providerTemplateId}
              >
                <option value="all">{text.usageAllApis}</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {getProviderTemplateLabel(template, text).name}
                  </option>
                ))}
                <option value="deleted">{text.usageDeletedApis}</option>
              </select>
            </label>
            <label className="compact-field">
              <span>{text.usageTableStatus}</span>
              <select
                onChange={(event) => updateFilter({ status: event.currentTarget.value as UsageStatusFilter })}
                value={filters.status}
              >
                <option value="all">{text.usageAllStatuses}</option>
                <option value="queued">{text.usageStatusQueued}</option>
                <option value="running">{text.usageStatusRunning}</option>
                <option value="succeeded">{text.usageStatusSucceeded}</option>
                <option value="failed">{text.usageStatusFailed}</option>
                <option value="canceled">{text.usageStatusCanceled}</option>
              </select>
            </label>
            <label className="compact-field">
              <span>{text.usageTableType}</span>
              <select
                onChange={(event) => updateFilter({ taskType: event.currentTarget.value as UsageTypeFilter })}
                value={filters.taskType}
              >
                <option value="all">{text.usageAllTypes}</option>
                <option value="text_to_image">{text.usageTypeTextToImage}</option>
                <option value="image_to_image">{text.usageTypeImageToImage}</option>
                <option value="image_edit">{text.usageTypeImageEdit}</option>
              </select>
            </label>
            <label className="compact-field">
              <span>{text.usageTableTime}</span>
              <select
                onChange={(event) => updateFilter({ timeRange: event.currentTarget.value as UsageTimeRangeFilter })}
                value={filters.timeRange}
              >
                <option value="all">{text.usageAllTime}</option>
                <option value="today">{text.usageToday}</option>
                <option value="7d">{text.usageLast7Days}</option>
                <option value="30d">{text.usageLast30Days}</option>
              </select>
            </label>
          </section>

          <div className="usage-table-wrap">
            {snapshot.records.length === 0 ? (
              <p className="usage-empty">{text.usageEmpty}</p>
            ) : (
              <table className="usage-table">
                <thead>
                  <tr>
                    <th>{text.usageTableTime}</th>
                    <th>{text.usageTableApi}</th>
                    <th>{text.usageTableType}</th>
                    <th>{text.usageTableStatus}</th>
                    <th>{text.usageTableModel}</th>
                    <th>{text.usageTableSize}</th>
                    <th>{text.usageTableImages}</th>
                    <th>{text.usageTableUnitPrice}</th>
                    <th>{text.usageTableCost}</th>
                    <th>{text.usageTableConversation}</th>
                    <th>{text.usageTableError}</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.records.map((record) => {
                    const imageCount =
                      record.status === 'succeeded'
                        ? `${record.successfulImageCount}/${record.requestedImageCount}`
                        : String(record.requestedImageCount)
                    const cost =
                      record.status === 'succeeded'
                        ? formatCurrencyCny(record.estimatedCost)
                        : record.status === 'failed' || record.status === 'canceled'
                          ? formatCurrencyCny(0)
                          : `${formatCurrencyCny(record.estimatedCost)} ${text.usageEstimatedCostHint}`
                    const conversationLabel = [
                      record.conversationId,
                      record.projectId ? (projectNameById.get(record.projectId) ?? record.projectId) : undefined
                    ]
                      .filter(Boolean)
                      .join(' / ')

                    return (
                      <tr key={record.id}>
                        <td>{formatFullDateTime(record.createdAt, language)}</td>
                        <td title={record.providerTemplateName}>{record.providerTemplateName}</td>
                        <td>{getUsageTaskTypeLabel(record.taskType, text)}</td>
                        <td>
                          <span className={`usage-status-pill usage-status-${record.status}`}>
                            {getUsageStatusLabel(record.status, text)}
                          </span>
                        </td>
                        <td title={record.model}>{record.model}</td>
                        <td>{record.size ?? '-'}</td>
                        <td>{imageCount}</td>
                        <td>{formatUnitPrice(record.unitPrice)}</td>
                        <td>{cost}</td>
                        <td title={conversationLabel}>{conversationLabel || '-'}</td>
                        <td title={record.errorMessage ?? record.promptPreview ?? ''}>
                          {record.errorMessage ?? record.promptPreview ?? '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
          {status && <p className="settings-status">{status}</p>}
        </div>
        <div className="settings-drawer-actions">
          <button className="secondary-button" onClick={onClear} type="button">
            {text.usageClear}
          </button>
          <button className="secondary-button" onClick={onExportCsv} type="button">
            {text.usageExportCsv}
          </button>
          <button className="generate-button" onClick={onClose} type="button">
            {text.close}
          </button>
        </div>
      </aside>
    </div>
  )
}

function UsageStatCard({ label, value }: { label: string; value: number | string }): React.JSX.Element {
  return (
    <div className="usage-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function RequestPreviewPanel({
  editEndpoint,
  endpoint,
  label,
  model,
  quality,
  sendOutputFormat,
  sendResponseFormat,
  size,
  templateName,
  text
}: {
  editEndpoint: string
  endpoint: string
  label: string
  model: string
  quality: string
  sendOutputFormat: boolean
  sendResponseFormat: boolean
  size: string
  templateName: string
  text: (typeof copy)[Language]
}): React.JSX.Element {
  return (
    <section className="request-preview" aria-label={label}>
      <div className="request-preview-header">
        <strong>{label}</strong>
      </div>
      <dl>
        <div>
          <dt>{text.requestPreviewTemplate}</dt>
          <dd>{templateName}</dd>
        </div>
        <div className="request-preview-wide">
          <dt>{text.requestPreviewGenerationEndpoint}</dt>
          <dd>{endpoint}</dd>
        </div>
        <div className="request-preview-wide">
          <dt>{text.requestPreviewEditEndpoint}</dt>
          <dd>{editEndpoint}</dd>
        </div>
        <div>
          <dt>{text.model}</dt>
          <dd>{model}</dd>
        </div>
        <div>
          <dt>{text.size}</dt>
          <dd>{size}</dd>
        </div>
        <div>
          <dt>{text.quality}</dt>
          <dd>{quality}</dd>
        </div>
        <div>
          <dt>{text.requestPreviewSendOutputFormat}</dt>
          <dd>{sendOutputFormat ? text.yes : text.no}</dd>
        </div>
        <div>
          <dt>{text.requestPreviewSendResponseFormat}</dt>
          <dd>{sendResponseFormat ? text.yes : text.no}</dd>
        </div>
      </dl>
    </section>
  )
}

function ParamChips({
  label,
  params,
  text
}: {
  label: string
  params: ConversationParams
  text: (typeof copy)[Language]
}): React.JSX.Element {
  const metadata = [
    params.mode ? getComposerModeLabel(params.mode, text) : undefined,
    params.model,
    params.size === 'auto' ? params.size : params.size.replace(/x/i, '×'),
    params.quality,
    params.outputFormat,
    params.n ? `n=${params.n}` : undefined
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <p className="param-chips param-line" aria-label={label}>
      {metadata}
    </p>
  )
}

function ReferenceImagePreviewList({
  images,
  notice,
  onRemove,
  removable,
  removeLabel
}: {
  images: readonly ImageToolReferenceImage[]
  notice?: string
  onRemove?: (id: string) => void
  removable: boolean
  removeLabel: string
}): React.JSX.Element {
  return (
    <div className="reference-preview-list">
      <div className="reference-preview-items">
        {images.map((image) => (
          <figure className="reference-preview-thumb" key={image.id}>
            <img alt={image.name} src={image.dataUrl} />
            <figcaption title={image.name}>{image.name}</figcaption>
            {removable && onRemove && (
              <button
                aria-label={removeLabel}
                className="reference-remove-button"
                onClick={() => onRemove(image.id)}
                type="button"
              >
                x
              </button>
            )}
          </figure>
        ))}
      </div>
      {notice && <span className="reference-preview-notice">{notice}</span>}
    </div>
  )
}

function ImageEditMaskCanvas({
  brushSize,
  controllerRef,
  onMaskPaintChange,
  isPanningMode,
  scale,
  sourceHeight,
  sourceWidth,
  tool
}: {
  brushSize: number
  controllerRef: MutableRefObject<MaskEditController | null>
  isPanningMode: boolean
  onMaskPaintChange: (hasPaint: boolean) => void
  scale: number
  sourceHeight: number
  sourceWidth: number
  tool: MaskEditTool
}): React.JSX.Element {
  const visibleCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef<MaskStrokePoint | undefined>(undefined)
  const sourceSize = useMemo(
    () => ({
      width: Math.max(1, Math.round(sourceWidth)),
      height: Math.max(1, Math.round(sourceHeight))
    }),
    [sourceHeight, sourceWidth]
  )

  const drawVisibleFromMask = useCallback(() => {
    const visibleCanvas = visibleCanvasRef.current
    const maskCanvas = maskCanvasRef.current

    if (!visibleCanvas || !maskCanvas) {
      return
    }

    const context = visibleCanvas.getContext('2d')

    if (!context) {
      return
    }

    context.clearRect(0, 0, visibleCanvas.width, visibleCanvas.height)
    context.save()
    context.drawImage(maskCanvas, 0, 0)
    context.globalCompositeOperation = 'source-in'
    context.fillStyle = 'rgba(37, 99, 235, 0.34)'
    context.fillRect(0, 0, visibleCanvas.width, visibleCanvas.height)
    context.restore()
  }, [])

  const maskHasPaint = useCallback(() => {
    const maskCanvas = maskCanvasRef.current
    const maskContext = maskCanvas?.getContext('2d')

    if (!maskCanvas || !maskContext) {
      return false
    }

    const sourcePixels = maskContext.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data

    for (let index = 3; index < sourcePixels.length; index += 4) {
      if (sourcePixels[index] > 0) {
        return true
      }
    }

    return false
  }, [])

  const initializeCanvases = useCallback(() => {
    const visibleCanvas = visibleCanvasRef.current

    if (!visibleCanvas) {
      return
    }

    visibleCanvas.width = sourceSize.width
    visibleCanvas.height = sourceSize.height

    const maskCanvas = document.createElement('canvas')
    maskCanvas.width = sourceSize.width
    maskCanvas.height = sourceSize.height

    const maskContext = maskCanvas.getContext('2d')

    if (maskContext) {
      maskContext.clearRect(0, 0, maskCanvas.width, maskCanvas.height)
    }

    maskCanvasRef.current = maskCanvas
    drawVisibleFromMask()
    onMaskPaintChange(false)
  }, [drawVisibleFromMask, onMaskPaintChange, sourceSize.height, sourceSize.width])

  useEffect(() => {
    initializeCanvases()
  }, [initializeCanvases])

  useEffect(() => {
    controllerRef.current = {
      clear: () => {
        const maskCanvas = maskCanvasRef.current

        if (!maskCanvas) {
          return
        }

        const maskContext = maskCanvas.getContext('2d')

        if (maskContext) {
          maskContext.clearRect(0, 0, maskCanvas.width, maskCanvas.height)
        }

        drawVisibleFromMask()
        onMaskPaintChange(false)
      },
      exportMask: async () => {
        const sourceMaskCanvas = maskCanvasRef.current

        if (!sourceMaskCanvas) {
          throw new Error('missing_mask_canvas')
        }

        const sourceMaskContext = sourceMaskCanvas.getContext('2d')

        if (!sourceMaskContext) {
          throw new Error('missing_mask_context')
        }

        const outputCanvas = document.createElement('canvas')
        outputCanvas.width = sourceSize.width
        outputCanvas.height = sourceSize.height
        const outputContext = outputCanvas.getContext('2d')

        if (!outputContext) {
          throw new Error('missing_mask_context')
        }

        const sourcePixels = sourceMaskContext.getImageData(0, 0, sourceSize.width, sourceSize.height).data
        const outputImageData = outputContext.createImageData(sourceSize.width, sourceSize.height)
        const outputPixels = outputImageData.data
        let hasTransparentPixels = false
        let hasOpaquePixels = false

        for (let index = 0; index < outputPixels.length; index += 4) {
          const isPainted = sourcePixels[index + 3] > 0
          outputPixels[index] = 255
          outputPixels[index + 1] = 255
          outputPixels[index + 2] = 255
          outputPixels[index + 3] = isPainted ? 0 : 255
          hasTransparentPixels = hasTransparentPixels || isPainted
          hasOpaquePixels = hasOpaquePixels || !isPainted
        }

        outputContext.putImageData(outputImageData, 0, 0)

        const blob = await canvasToPngBlob(outputCanvas)

        return {
          dataUrl: await blobToDataUrl(blob),
          mimeType: 'image/png',
          blobSize: blob.size,
          width: outputCanvas.width,
          height: outputCanvas.height,
          hasTransparentPixels,
          hasOpaquePixels,
          transparentAlpha: 0,
          opaqueAlpha: 255
        }
      }
    }

    return () => {
      controllerRef.current = null
    }
  }, [controllerRef, drawVisibleFromMask, maskHasPaint, onMaskPaintChange, sourceSize.height, sourceSize.width])

  const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>): MaskStrokePoint => {
    const canvas = event.currentTarget
    const bounds = canvas.getBoundingClientRect()

    return {
      x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * canvas.height
    }
  }

  const paintBetweenPoints = useCallback(
    (fromPoint: MaskStrokePoint, toPoint: MaskStrokePoint) => {
      const visibleCanvas = visibleCanvasRef.current
      const maskCanvas = maskCanvasRef.current

      if (!visibleCanvas || !maskCanvas) {
        return
      }

      const maskContext = maskCanvas.getContext('2d')

      if (!maskContext) {
        return
      }

      const naturalBrushSize = brushSize / Math.max(scale, 0.1)

      maskContext.save()
      maskContext.globalCompositeOperation = tool === 'brush' ? 'source-over' : 'destination-out'
      maskContext.strokeStyle = 'rgba(0, 0, 0, 1)'
      maskContext.lineCap = 'round'
      maskContext.lineJoin = 'round'
      maskContext.lineWidth = naturalBrushSize
      maskContext.beginPath()
      maskContext.moveTo(fromPoint.x, fromPoint.y)
      maskContext.lineTo(toPoint.x, toPoint.y)
      maskContext.stroke()
      maskContext.restore()
      drawVisibleFromMask()
      onMaskPaintChange(maskHasPaint())
    },
    [brushSize, drawVisibleFromMask, maskHasPaint, onMaskPaintChange, scale, tool]
  )

  return (
    <canvas
      aria-label="mask editor"
      className={`mask-editor-canvas mask-editor-${tool}`}
      height={sourceSize.height}
      onPointerDown={(event) => {
        if (isPanningMode || event.button === 1) {
          return
        }

        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        drawingRef.current = true
        const point = getCanvasPoint(event)
        lastPointRef.current = point
        paintBetweenPoints(point, point)
      }}
      onPointerMove={(event) => {
        if (!drawingRef.current || !lastPointRef.current) {
          return
        }

        const point = getCanvasPoint(event)
        paintBetweenPoints(lastPointRef.current, point)
        lastPointRef.current = point
      }}
      onPointerUp={(event) => {
        if (drawingRef.current) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }

        drawingRef.current = false
        lastPointRef.current = undefined
      }}
      onPointerCancel={() => {
        drawingRef.current = false
        lastPointRef.current = undefined
      }}
      ref={visibleCanvasRef}
      width={sourceSize.width}
    />
  )
}

function ImageEditWorkspace({
  error,
  format,
  isSubmitting,
  model,
  onClose,
  onSubmit,
  quality,
  sizeLabel,
  source,
  text
}: {
  error?: ConversationMessage['error']
  format: ImageToolImage2OutputFormat
  isSubmitting: boolean
  model: string
  onClose: () => void
  onSubmit: (prompt: string, mask: MaskEditExport, editSubmitMode: ImageToolEditSubmitMode) => Promise<boolean>
  quality: ImageToolImage2Quality
  sizeLabel: string
  source: EditingSourceImage
  text: (typeof copy)[Language]
}): React.JSX.Element {
  const actualSourceWidth = Math.round(source.naturalWidth ?? source.width ?? 0)
  const actualSourceHeight = Math.round(source.naturalHeight ?? source.height ?? 0)
  const sourceWidth = Math.max(1, actualSourceWidth)
  const sourceHeight = Math.max(1, actualSourceHeight)
  const controllerRef = useRef<MaskEditController | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [prompt, setPrompt] = useState('')
  const [localError, setLocalError] = useState<ConversationMessage['error']>()
  const [tool, setTool] = useState<MaskEditTool>('brush')
  const [brushSize, setBrushSize] = useState(32)
  const [hasPaint, setHasPaint] = useState(false)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const [editSubmitMode, setEditSubmitMode] = useState<ImageToolEditSubmitMode>('compatible')
  const [isCloseConfirmationOpen, setIsCloseConfirmationOpen] = useState(false)
  const isPanningMode = isSpacePressed || isPanning
  const panStartRef = useRef({
    pointerId: -1,
    pointerX: 0,
    pointerY: 0,
    offsetX: 0,
    offsetY: 0
  })
  const activeError = localError ?? error
  const clampScale = (nextScale: number): number => Math.min(4, Math.max(0.1, nextScale))
  const getFitScale = useCallback(() => {
    const stage = stageRef.current

    if (!stage) {
      return 1
    }

    const bounds = stage.getBoundingClientRect()
    const nextScale = Math.min((bounds.width - 48) / sourceWidth, (bounds.height - 48) / sourceHeight, 1)

    return clampScale(Number(nextScale.toFixed(3)))
  }, [sourceHeight, sourceWidth])
  const fitToScreen = useCallback(() => {
    setScale(getFitScale())
    setOffset({ x: 0, y: 0 })
  }, [getFitScale])
  const setActualSize = () => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }
  const zoomBy = (delta: number) => {
    setScale((currentScale) => clampScale(Number((currentScale + delta).toFixed(2))))
  }
  const beginPan = (event: React.PointerEvent<HTMLElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    panStartRef.current = {
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y
    }
    setIsPanning(true)
  }
  const maybeClose = useCallback(() => {
    if (hasPaint || prompt.trim()) {
      setIsCloseConfirmationOpen(true)
      return
    }

    onClose()
  }, [hasPaint, onClose, prompt])

  useEffect(() => {
    fitToScreen()
  }, [fitToScreen])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        maybeClose()
      }

      if (event.code === 'Space') {
        setIsSpacePressed(true)
      }
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        setIsSpacePressed(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [maybeClose])

  const submitEdit = async () => {
    const trimmedPrompt = prompt.trim()

    setLocalError(undefined)

    if (!trimmedPrompt) {
      setLocalError({
        code: 'missing_prompt',
        message: text.editPromptRequired
      })
      return
    }

    if (!actualSourceWidth || !actualSourceHeight) {
      setLocalError({
        code: 'source_image_size_missing',
        message: text.sourceImageSizeMissing
      })
      return
    }

    if (!hasPaint) {
      setLocalError({
        code: 'missing_mask',
        message: text.maskRequired
      })
      return
    }

    const controller = controllerRef.current

    if (!controller) {
      setLocalError({
        code: 'missing_mask_canvas',
        message: text.maskExportFailed
      })
      return
    }

    let mask: MaskEditExport

    try {
      mask = await controller.exportMask()
    } catch {
      setLocalError({
        code: 'mask_export_failed',
        message: text.maskExportFailed
      })
      return
    }

    if (mask.mimeType !== 'image/png' || !mask.dataUrl.startsWith('data:image/png;base64,')) {
      setLocalError({
        code: 'invalid_mask_png',
        message: text.maskPngRequired
      })
      return
    }

    if (!mask.hasTransparentPixels) {
      setLocalError({
        code: 'missing_mask',
        message: text.maskRequired
      })
      return
    }

    if (mask.width !== actualSourceWidth || mask.height !== actualSourceHeight) {
      setLocalError({
        code: 'mask_size_mismatch',
        message: text.maskSizeMismatch
      })
      return
    }

    if (mask.transparentAlpha !== 0 || mask.opaqueAlpha !== 255) {
      setLocalError({
        code: 'mask_alpha_invalid',
        message: text.maskAlphaInvalid
      })
      return
    }

    if (mask.blobSize >= MAX_MASK_IMAGE_BYTES) {
      setLocalError({
        code: 'mask_too_large',
        message: text.maskTooLarge
      })
      return
    }

    const didSubmit = await onSubmit(trimmedPrompt, mask, editSubmitMode)

    if (!didSubmit) {
      setLocalError(undefined)
    }
  }

  const imageTransformStyle: CSSProperties = {
    height: `${sourceHeight}px`,
    transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`,
    width: `${sourceWidth}px`
  }
  const workspaceRequestSize = editSubmitMode === 'compatible' ? text.sizeAuto : sizeLabel
  const workspaceQuality = editSubmitMode === 'compatible' ? 'low' : quality
  const workspaceMetadata = `${text.composerModeEdit} · ${model} · ${workspaceRequestSize} · ${workspaceQuality} · ${format}`
  const workspaceSizeMetadata = `${text.sourceImageSize}: ${actualSourceWidth || sourceWidth}x${actualSourceHeight || sourceHeight}`
  const editSubmitModeHint =
    editSubmitMode === 'compatible' ? text.editSubmitCompatibleHint : text.editSubmitOriginalHint
  return (
    <div className="image-edit-workspace" role="dialog" aria-modal="true" aria-label={text.editWorkspaceTitle}>
      <div className="image-edit-workspace-panel">
        <header className="image-edit-workspace-header">
          <div className="image-edit-title-block">
            <strong>{text.editWorkspaceTitle}</strong>
            <span>
              {source.fileName ?? source.historyId ?? text.imageAlt} · {sourceWidth}×{sourceHeight}
            </span>
          </div>
          <button className="image-edit-close-button" onClick={maybeClose} type="button">
            {text.close}
          </button>
        </header>

        <aside className="image-edit-toolbar" aria-label={text.maskEditActive}>
          <button
            aria-pressed={tool === 'brush'}
            className="mask-tool-button"
            onClick={() => setTool('brush')}
            type="button"
          >
            {text.brushTool}
          </button>
          <button
            aria-pressed={tool === 'eraser'}
            className="mask-tool-button"
            onClick={() => setTool('eraser')}
            type="button"
          >
            {text.eraserTool}
          </button>
          <label className="mask-size-control image-edit-brush-size">
            <span>{text.brushSize.replace('{size}', brushSize.toString())}</span>
            <input
              max={MASK_BRUSH_SIZE_MAX}
              min={MASK_BRUSH_SIZE_MIN}
              onChange={(event) => setBrushSize(Number(event.currentTarget.value))}
              type="range"
              value={brushSize}
            />
          </label>
          <button
            className="mask-tool-button"
            disabled={!hasPaint}
            onClick={() => {
              controllerRef.current?.clear()
              setHasPaint(false)
            }}
            type="button"
          >
            {text.clearMask}
          </button>
          <span className="image-edit-toolbar-divider" />
          <button className="mask-tool-button" onClick={() => zoomBy(0.2)} type="button">
            {text.zoomIn}
          </button>
          <button className="mask-tool-button" onClick={() => zoomBy(-0.2)} type="button">
            {text.zoomOut}
          </button>
          <button className="mask-tool-button" onClick={fitToScreen} type="button">
            {text.fitScreen}
          </button>
          <button className="mask-tool-button" onClick={setActualSize} type="button">
            {text.actualSize}
          </button>
          <span className="image-viewer-scale">{Math.round(scale * 100)}%</span>
        </aside>

        <section
          className={isPanningMode ? 'image-edit-stage image-edit-stage-panning' : 'image-edit-stage'}
          onPointerCancel={(event) => {
            if (panStartRef.current.pointerId === event.pointerId) {
              setIsPanning(false)
            }
          }}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget || isSpacePressed || event.button === 1) {
              beginPan(event)
            }
          }}
          onPointerMove={(event) => {
            if (!isPanning || panStartRef.current.pointerId !== event.pointerId) {
              return
            }

            setOffset({
              x: panStartRef.current.offsetX + event.clientX - panStartRef.current.pointerX,
              y: panStartRef.current.offsetY + event.clientY - panStartRef.current.pointerY
            })
          }}
          onPointerUp={(event) => {
            if (panStartRef.current.pointerId === event.pointerId) {
              setIsPanning(false)
            }
          }}
          onWheel={(event) => {
            event.preventDefault()
            zoomBy(event.deltaY > 0 ? -0.16 : 0.16)
          }}
          ref={stageRef}
        >
          <div className="image-edit-canvas-layer" style={imageTransformStyle}>
            <img alt={text.editingCurrentImage} draggable={false} src={source.dataUrl} />
            <ImageEditMaskCanvas
              brushSize={brushSize}
              controllerRef={controllerRef}
              isPanningMode={isPanningMode}
              onMaskPaintChange={setHasPaint}
              scale={scale}
              sourceHeight={sourceHeight}
              sourceWidth={sourceWidth}
              tool={tool}
            />
          </div>
        </section>

        <footer className="image-edit-footer">
          <div className="image-edit-prompt-block">
            <span>{text.editWorkspaceSubtitle}</span>
            <textarea
              onChange={(event) => setPrompt(event.currentTarget.value)}
              placeholder={text.promptPlaceholderMaskEdit}
              rows={2}
              value={prompt}
            />
            <p className="image-edit-meta">{workspaceMetadata}</p>
            <p className="image-edit-meta">{workspaceSizeMetadata}</p>
            <div className="message-actions" aria-label={text.editSubmitMode}>
              <button
                aria-pressed={editSubmitMode === 'compatible'}
                className="action-button"
                onClick={() => setEditSubmitMode('compatible')}
                type="button"
              >
                {text.editSubmitCompatible}
              </button>
              <button
                aria-pressed={editSubmitMode === 'original'}
                className="action-button"
                onClick={() => setEditSubmitMode('original')}
                type="button"
              >
                {text.editSubmitOriginal}
              </button>
            </div>
            <p className="image-edit-help">{editSubmitModeHint}</p>
            <p className="image-edit-help">{text.editWorkspaceHelp}</p>
            {activeError && (
              <div className="message-error image-edit-error" role="alert">
                <strong>{activeError.code ?? text.generationError}</strong>
                <span>{activeError.message}</span>
                <EditDebugDetails details={activeError.debugDetails} text={text} />
              </div>
            )}
          </div>
          <div className="image-edit-submit-actions">
            <button className="action-button" disabled={isSubmitting} onClick={maybeClose} type="button">
              {text.cancel}
            </button>
            <button
              className="generate-button image-edit-submit-button"
              disabled={isSubmitting || !hasPaint}
              onClick={submitEdit}
              type="button"
            >
              {isSubmitting ? text.submittingEdit : text.submitEdit}
            </button>
          </div>
        </footer>
        {isCloseConfirmationOpen && (
          <div className="editor-confirm-backdrop" role="presentation">
            <section className="confirm-dialog editor-confirm-dialog" role="dialog" aria-label={text.cancelEditing}>
              <div>
                <p className="eyebrow">{text.cancelEditing}</p>
                <h2>{text.cancelEditing}</h2>
                <p>{text.confirmCloseEditor}</p>
              </div>
              <div className="settings-drawer-actions">
                <button className="secondary-button" onClick={() => setIsCloseConfirmationOpen(false)} type="button">
                  {text.cancel}
                </button>
                <button className="danger-button" onClick={onClose} type="button">
                  {text.close}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

function ComposerParameterPopover({
  fixedSize,
  language,
  onClose,
  onOutputFormatChange,
  onQualityChange,
  onSizeChange,
  outputFormat,
  popover,
  quality,
  sizeMode,
  text
}: {
  fixedSize: ImageSizePreset
  language: Language
  onClose: () => void
  onOutputFormatChange: (outputFormat: ImageToolImage2OutputFormat) => void
  onQualityChange: (quality: ImageToolImage2Quality) => void
  onSizeChange: (size: ImageSizePreset) => void
  outputFormat: ImageToolImage2OutputFormat
  popover: ComposerPopoverKey
  quality: ImageToolImage2Quality
  sizeMode: ImageSizeMode
  text: (typeof copy)[Language]
}): React.JSX.Element {
  return (
    <div className={`composer-popover composer-popover-${popover}`}>
      <div className="composer-popover-header">
        <strong>{popover === 'size' ? text.size : popover === 'quality' ? text.quality : text.format}</strong>
        <button aria-label={text.close} className="popover-close-button" onClick={onClose} type="button">
          x
        </button>
      </div>
      {popover === 'size' && (
        <div className="composer-option-grid">
          {composerSizeOptions.map((option) => {
            const isSelected =
              option.value === 'auto' ? sizeMode === 'auto' : sizeMode === 'fixed' && fixedSize === option.value

            return (
              <button
                className={isSelected ? 'composer-option is-selected' : 'composer-option'}
                key={option.value}
                onClick={() => onSizeChange(option.value)}
                type="button"
              >
                <span>{option.label[language]}</span>
                <small>{option.value}</small>
              </button>
            )
          })}
        </div>
      )}
      {popover === 'quality' && (
        <div className="composer-option-row">
          {composerQualityOptions.map((option) => (
            <button
              className={quality === option ? 'composer-option is-selected' : 'composer-option'}
              key={option}
              onClick={() => onQualityChange(option)}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
      )}
      {popover === 'format' && (
        <div className="composer-option-row">
          {outputFormatOptions.map((option) => (
            <button
              className={outputFormat === option ? 'composer-option is-selected' : 'composer-option'}
              key={option}
              onClick={() => onOutputFormatChange(option)}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ImagePreview({
  alt,
  b64Json,
  imageDataUrl,
  onClick,
  onPreviewSettled,
  outputFormat,
  overlay,
  previewSelfTest,
  previewDataUrl,
  requestedSize,
  text,
  url
}: {
  alt: string
  b64Json?: string
  imageDataUrl?: string
  onClick?: () => void
  onPreviewSettled: () => void
  outputFormat?: string
  overlay?: ReactNode
  previewSelfTest?: PreviewSelfTestResult
  previewDataUrl?: string
  requestedSize?: string
  text: (typeof copy)[Language]
  url?: string
}): React.JSX.Element {
  const previewSource = useMemo(
    () => getImagePreviewSource({ b64Json, previewDataUrl, url }, outputFormat, imageDataUrl),
    [b64Json, imageDataUrl, outputFormat, previewDataUrl, url]
  )
  const [objectUrl, setObjectUrl] = useState<PreviewObjectUrlResult>({
    ok: false,
    error: 'missing_image_payload'
  })
  const [hasImageError, setHasImageError] = useState(false)
  const [imageDiagnostics, setImageDiagnostics] = useState<ImageElementDiagnostics>({
    loaded: false,
    naturalWidth: 0,
    naturalHeight: 0,
    currentSrcPrefix: 'missing'
  })

  useEffect(() => {
    setHasImageError(false)
    setImageDiagnostics({
      loaded: false,
      naturalWidth: 0,
      naturalHeight: 0,
      currentSrcPrefix: 'missing'
    })
    const nextObjectUrl = createPreviewObjectUrl({
      mimeType: previewSource.mimeType,
      source: previewSource.source,
      sourceType: previewSource.sourceType
    })

    setObjectUrl(nextObjectUrl)

    return () => {
      if (nextObjectUrl.ok) {
        nextObjectUrl.revoke?.()
      }
    }
  }, [previewSource.mimeType, previewSource.source, previewSource.sourceType])

  const hasB64Json = Boolean(b64Json)
  const hasUrl = Boolean(url)
  const hasImageDataUrl = Boolean(imageDataUrl || previewDataUrl)
  const b64JsonLength = b64Json?.length ?? 0
  const urlHost = previewSource.urlHost ?? getUrlHost(url) ?? 'none'
  const previewError = hasImageError
    ? 'image_load_error'
    : objectUrl.ok
      ? (previewSource.previewError ?? 'none')
      : objectUrl.error
  const objectUrlError = objectUrl.ok ? undefined : objectUrl.error
  const previewErrorText =
    previewSource.previewError === 'invalid_image_payload' || objectUrlError === 'invalid_preview_source'
      ? text.invalidImagePayload
      : previewSource.previewError === 'invalid_history_image_payload'
        ? text.historyImageInvalid
        : text.imageDataMissing
  const previewSrcType = objectUrl.ok ? objectUrl.srcType : 'missing'
  const previewSrcLength = objectUrl.ok ? objectUrl.src.length : 0
  const previewSrcPrefix = objectUrl.ok ? objectUrl.src.slice(0, 64) : previewSource.srcPrefix
  const previewLayout = getImagePreviewLayout({
    naturalHeight: imageDiagnostics.naturalHeight,
    naturalWidth: imageDiagnostics.naturalWidth,
    requestedSize
  })
  const previewStyle: ImagePreviewStyle = {
    '--preview-aspect-ratio': previewLayout.aspectRatioValue,
    '--preview-max-height': `${previewLayout.maxHeight}px`,
    '--preview-max-width': `${previewLayout.maxWidth}px`,
    '--preview-width': `${previewLayout.width}px`
  }
  const possibleCspBlocked =
    hasImageError &&
    previewSrcType === 'blob-url' &&
    previewSelfTest?.dataUrlLoad === 'success' &&
    previewSelfTest.blobUrlLoad === 'failed'

  return (
    <>
      <button
        className={`image-preview-frame image-preview-${previewLayout.orientation}${
          onClick ? ' image-preview-clickable' : ''
        }${overlay ? ' image-preview-has-overlay' : ''}`}
        data-zoom-label={onClick ? text.previewImage : undefined}
        disabled={!onClick && !overlay}
        onClick={onClick}
        style={previewStyle}
        type="button"
      >
        {objectUrl.ok && !hasImageError ? (
          <img
            alt={alt}
            height={imageDiagnostics.loaded ? imageDiagnostics.naturalHeight : undefined}
            onError={(event) => {
              const imageElement = event.currentTarget
              setHasImageError(true)
              setImageDiagnostics({
                loaded: false,
                naturalWidth: imageElement.naturalWidth,
                naturalHeight: imageElement.naturalHeight,
                currentSrcPrefix: imageElement.currentSrc.slice(0, 64) || 'missing'
              })
              onPreviewSettled()
            }}
            onLoad={(event) => {
              const imageElement = event.currentTarget
              setHasImageError(false)
              setImageDiagnostics({
                loaded: true,
                naturalWidth: imageElement.naturalWidth,
                naturalHeight: imageElement.naturalHeight,
                currentSrcPrefix: imageElement.currentSrc.slice(0, 64) || 'missing'
              })
              onPreviewSettled()
            }}
            src={objectUrl.src}
            width={imageDiagnostics.loaded ? imageDiagnostics.naturalWidth : undefined}
          />
        ) : (
          <div className="image-placeholder" role="status">
            {hasImageError ? text.imagePreviewFailed : previewErrorText}
          </div>
        )}
        {overlay}
      </button>
      <details className="debug-details image-debug-details">
        <summary>{text.imageDebug}</summary>
        <dl className="image-debug" aria-label={text.imageDebug}>
          <div>
            <dt>outputFormat</dt>
            <dd>{outputFormat ?? 'unknown'}</dd>
          </div>
          <div>
            <dt>requested mime type</dt>
            <dd>{previewSource.requestedMimeType}</dd>
          </div>
          <div>
            <dt>detected image type</dt>
            <dd>{previewSource.detectedType}</dd>
          </div>
          <div>
            <dt>hexPrefix</dt>
            <dd>{previewSource.hexPrefix ?? 'missing'}</dd>
          </div>
          <div>
            <dt>has b64Json</dt>
            <dd>{String(hasB64Json)}</dd>
          </div>
          <div>
            <dt>has url</dt>
            <dd>{String(hasUrl)}</dd>
          </div>
          <div>
            <dt>has imageDataUrl</dt>
            <dd>{String(hasImageDataUrl)}</dd>
          </div>
          <div>
            <dt>b64JsonLength</dt>
            <dd>{b64JsonLength}</dd>
          </div>
          <div>
            <dt>urlHost</dt>
            <dd>{urlHost}</dd>
          </div>
          <div>
            <dt>preview src type</dt>
            <dd>{previewSrcType}</dd>
          </div>
          <div>
            <dt>original source type</dt>
            <dd>{previewSource.sourceType}</dd>
          </div>
          <div>
            <dt>mimeType</dt>
            <dd>{objectUrl.ok ? (objectUrl.mimeType ?? previewSource.mimeType) : previewSource.mimeType}</dd>
          </div>
          <div>
            <dt>srcLength</dt>
            <dd>{previewSrcLength}</dd>
          </div>
          <div>
            <dt>originalSrcLength</dt>
            <dd>{previewSource.srcLength}</dd>
          </div>
          <div>
            <dt>blobSize</dt>
            <dd>{objectUrl.ok ? (objectUrl.blobSize ?? 0) : (objectUrl.blobSize ?? 0)}</dd>
          </div>
          <div>
            <dt>loaded</dt>
            <dd>{String(imageDiagnostics.loaded)}</dd>
          </div>
          <div>
            <dt>naturalWidth</dt>
            <dd>{imageDiagnostics.naturalWidth}</dd>
          </div>
          <div>
            <dt>naturalHeight</dt>
            <dd>{imageDiagnostics.naturalHeight}</dd>
          </div>
          <div>
            <dt>possibleCspBlocked</dt>
            <dd>{String(possibleCspBlocked)}</dd>
          </div>
          <div>
            <dt>previewError</dt>
            <dd>{previewError}</dd>
          </div>
          <div>
            <dt>format mismatch</dt>
            <dd>{String(previewSource.mismatch)}</dd>
          </div>
          <div className="image-debug-wide">
            <dt>srcPrefix</dt>
            <dd>{previewSrcPrefix}</dd>
          </div>
          <div className="image-debug-wide">
            <dt>currentSrcPrefix</dt>
            <dd>{imageDiagnostics.currentSrcPrefix}</dd>
          </div>
        </dl>
      </details>
    </>
  )
}

function ImageResultMessage({
  message,
  text,
  onDeleteHistory,
  onDownload,
  onEditImage,
  onOpenPreview,
  onPreviewSettled,
  previewSelfTest,
  onRegenerate,
  onSaveAsTemplate
}: {
  message: ConversationMessage
  text: (typeof copy)[Language]
  onDeleteHistory: (message: ConversationMessage) => void
  onDownload: (message: ConversationMessage) => void
  onEditImage: (message: ConversationMessage) => void
  onOpenPreview: (message: ConversationMessage) => void
  onPreviewSettled: () => void
  previewSelfTest: PreviewSelfTestResult
  onRegenerate: (message: ConversationMessage) => void
  onSaveAsTemplate: (message: ConversationMessage) => void
}): React.JSX.Element {
  const params = message.params
  const image = message.result?.ok ? message.result.images[0] : undefined
  const imagePreviewSource = getImagePreviewSource(image, params?.outputFormat, message.imageDataUrl)
  const canDownloadImage = Boolean(getImageDownloadHref(imagePreviewSource))
  const canPreviewImage = Boolean(imagePreviewSource.source)
  const canEditImage = Boolean(getImageEditingDataUrl(imagePreviewSource) || message.historyId)
  const editDebugDetails =
    params?.mode === 'image_edit' || params?.mode === 'image_reference'
      ? createSafeEditDebugDetails({
          requestSummary: message.result?.ok ? message.result.requestSummary : undefined
        })
      : undefined

  return (
    <div className="image-message">
      <ImagePreview
        alt={image?.revisedPrompt || message.prompt || text.imageAlt}
        b64Json={image?.b64Json}
        imageDataUrl={message.imageDataUrl}
        onClick={canPreviewImage ? () => onOpenPreview(message) : undefined}
        onPreviewSettled={onPreviewSettled}
        outputFormat={params?.outputFormat}
        previewSelfTest={previewSelfTest}
        previewDataUrl={image?.previewDataUrl}
        requestedSize={params?.size}
        text={text}
        url={image?.url}
      />
      {params && <p className="image-metadata">{formatImageMetadata(params, text)}</p>}
      <div className="image-actions">
        <button
          className="action-button"
          disabled={!canDownloadImage}
          onClick={() => onDownload(message)}
          type="button"
        >
          {text.saveImage}
        </button>
        <button className="action-button" disabled={!canEditImage} onClick={() => onEditImage(message)} type="button">
          {text.editImage}
        </button>
        <button
          className="action-button"
          disabled={!message.historyId}
          onClick={() => onDeleteHistory(message)}
          type="button"
        >
          {text.deleteHistory}
        </button>
        <button className="action-button" onClick={() => onRegenerate(message)} type="button">
          {text.regenerate}
        </button>
        <button className="action-button" onClick={() => onSaveAsTemplate(message)} type="button">
          {text.saveAsTemplate}
        </button>
      </div>
      <EditDebugDetails details={editDebugDetails} text={text} />
    </div>
  )
}

function ImageLightbox({
  message,
  onClose,
  onDownload,
  text
}: {
  message: ConversationMessage
  onClose: () => void
  onDownload: (message: ConversationMessage) => void
  text: (typeof copy)[Language]
}): React.JSX.Element {
  const params = message.params
  const image = message.result?.ok ? message.result.images[0] : undefined
  const imagePreviewSource = getImagePreviewSource(image, params?.outputFormat, message.imageDataUrl)
  const canDownloadImage = Boolean(getImageDownloadHref(imagePreviewSource))
  const [objectUrl, setObjectUrl] = useState<PreviewObjectUrlResult>({
    ok: false,
    error: 'missing_image_payload'
  })
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const scaleRef = useRef(1)
  const offsetRef = useRef({ x: 0, y: 0 })
  const dragStartRef = useRef({
    pointerId: -1,
    pointerX: 0,
    pointerY: 0,
    offsetX: 0,
    offsetY: 0
  })
  const clampScale = (nextScale: number): number => Math.min(12, Math.max(0.15, nextScale))
  const setViewerTransform = (nextScale: number, nextOffset: { x: number; y: number }) => {
    scaleRef.current = nextScale
    offsetRef.current = nextOffset
    setScale(nextScale)
    setOffset(nextOffset)
  }
  const setFitScale = () => {
    setViewerTransform(1, { x: 0, y: 0 })
  }
  const setActualSize = () => {
    const imageElement = imageRef.current

    if (!imageElement?.clientWidth || !imageElement?.clientHeight) {
      setViewerTransform(1, { x: 0, y: 0 })
      return
    }

    setViewerTransform(
      clampScale(
        Math.max(
          imageElement.naturalWidth / imageElement.clientWidth,
          imageElement.naturalHeight / imageElement.clientHeight,
          1
        )
      ),
      { x: 0, y: 0 }
    )
  }
  const zoomBy = (delta: number, anchor?: { clientX: number; clientY: number }) => {
    const currentScale = scaleRef.current
    const nextScale = clampScale(Number((currentScale + delta).toFixed(2)))

    if (nextScale === currentScale) {
      return
    }

    const stageElement = stageRef.current

    if (!anchor || !stageElement) {
      setViewerTransform(nextScale, offsetRef.current)
      return
    }

    const rect = stageElement.getBoundingClientRect()
    const anchorX = anchor.clientX - rect.left - rect.width / 2
    const anchorY = anchor.clientY - rect.top - rect.height / 2
    const ratio = nextScale / currentScale
    const currentOffset = offsetRef.current

    setViewerTransform(nextScale, {
      x: anchorX - (anchorX - currentOffset.x) * ratio,
      y: anchorY - (anchorY - currentOffset.y) * ratio
    })
  }
  useEffect(() => {
    const nextObjectUrl = createPreviewObjectUrl({
      mimeType: imagePreviewSource.mimeType,
      source: imagePreviewSource.source,
      sourceType: imagePreviewSource.sourceType
    })

    setObjectUrl(nextObjectUrl)
    setViewerTransform(1, { x: 0, y: 0 })

    return () => {
      if (nextObjectUrl.ok) {
        nextObjectUrl.revoke?.()
      }
    }
  }, [imagePreviewSource.mimeType, imagePreviewSource.source, imagePreviewSource.sourceType])

  const imageSource = objectUrl.ok ? objectUrl.src : undefined
  const imageStyle: ImageViewerImageStyle = {
    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
    cursor: isDragging ? 'grabbing' : 'grab'
  }

  return (
    <div className="image-lightbox" onClick={onClose} role="dialog" aria-modal="true">
      <div className="image-lightbox-panel" onClick={(event) => event.stopPropagation()}>
        <div className="image-lightbox-header">
          <div>
            <strong>{text.previewImage}</strong>
            {params && <p>{formatImageMetadata(params, text)}</p>}
          </div>
          <button className="image-lightbox-close" onClick={onClose} type="button">
            x
          </button>
        </div>
        <div
          className="image-lightbox-stage"
          ref={stageRef}
          onDoubleClick={scale === 1 ? setActualSize : setFitScale}
          onPointerDown={(event) => {
            if (!imageSource) {
              return
            }

            event.currentTarget.setPointerCapture(event.pointerId)
            dragStartRef.current = {
              pointerId: event.pointerId,
              pointerX: event.clientX,
              pointerY: event.clientY,
              offsetX: offset.x,
              offsetY: offset.y
            }
            setIsDragging(true)
          }}
          onPointerMove={(event) => {
            if (!isDragging || dragStartRef.current.pointerId !== event.pointerId) {
              return
            }

            const nextOffset = {
              x: dragStartRef.current.offsetX + event.clientX - dragStartRef.current.pointerX,
              y: dragStartRef.current.offsetY + event.clientY - dragStartRef.current.pointerY
            }
            offsetRef.current = nextOffset
            setOffset(nextOffset)
          }}
          onPointerUp={(event) => {
            if (dragStartRef.current.pointerId === event.pointerId) {
              setIsDragging(false)
            }
          }}
          onPointerCancel={(event) => {
            if (dragStartRef.current.pointerId === event.pointerId) {
              setIsDragging(false)
            }
          }}
          onWheel={(event) => {
            event.preventDefault()
            zoomBy(event.deltaY > 0 ? -0.18 : 0.18, {
              clientX: event.clientX,
              clientY: event.clientY
            })
          }}
        >
          {imageSource ? (
            <img
              alt={image?.revisedPrompt || message.prompt || text.imageAlt}
              className="image-lightbox-image"
              draggable={false}
              ref={imageRef}
              src={imageSource}
              style={imageStyle}
            />
          ) : (
            <div className="image-placeholder" role="status">
              {text.imageDataMissing}
            </div>
          )}
        </div>
        <div className="image-lightbox-actions">
          <span className="image-viewer-scale">{Math.round(scale * 100)}%</span>
          <button className="action-button" onClick={() => zoomBy(0.25)} type="button">
            {text.zoomIn}
          </button>
          <button className="action-button" onClick={() => zoomBy(-0.25)} type="button">
            {text.zoomOut}
          </button>
          <button className="action-button" onClick={setFitScale} type="button">
            {text.fitScreen}
          </button>
          <button className="action-button" onClick={setActualSize} type="button">
            {text.actualSize}
          </button>
          <button
            className="action-button"
            disabled={!canDownloadImage}
            onClick={() => onDownload(message)}
            type="button"
          >
            {text.saveImage}
          </button>
          <button className="action-button" onClick={onClose} type="button">
            {text.close}
          </button>
        </div>
      </div>
    </div>
  )
}
