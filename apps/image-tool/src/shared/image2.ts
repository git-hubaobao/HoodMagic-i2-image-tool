import type {
  Conversation,
  ImageHistoryItem,
  ImageProviderTemplate as StorageImageProviderTemplate,
  ImageToolSettings,
  ProjectGroup,
  PromptTemplate,
  PromptTemplateCategory,
  PromptTemplateRecommendedParams,
  PromptTemplateType,
  PromptTemplateVariable,
  TaskRecord,
  TaskRecordFilters,
  TaskUsageStats,
  UsageCurrency
} from '@hoodmagic/storage'
import type {
  ImageEditTaskRequest,
  ImageGenerationTask,
  ImageGenerationTaskRequest,
  ImageGenerationTaskResult,
  TaskEvent,
  TaskStatus
} from '@hoodmagic/task-core'

export type ImageToolImage2Quality = 'auto' | 'low' | 'medium' | 'high'

export type ImageToolImage2OutputFormat = 'png' | 'jpeg' | 'webp'

export type ImageToolImage2ResponseFormat = 'url' | 'b64_json'

export type ImageToolEditSubmitMode = 'original' | 'compatible'

export type ImageToolEditMaskSemantic = 'transparent-edit' | 'opaque-edit'

export type ImageToolEditMaskColorMode = 'white' | 'transparent-black' | 'black'

export type ImageToolEditSubmitMetadata = {
  editSubmitMode?: ImageToolEditSubmitMode
  maskSemantic?: ImageToolEditMaskSemantic
  maskColorMode?: ImageToolEditMaskColorMode
  originalImageWidth?: number
  originalImageHeight?: number
  submittedImageWidth?: number
  submittedImageHeight?: number
  submittedMaskWidth?: number
  submittedMaskHeight?: number
}

export type ImageToolDebugDetails = {
  mode?: 'generation' | 'reference' | 'edit'
  upstreamMessage?: string
  status?: number
  upstreamType?: string
  upstreamCode?: string
  endpoint?: string
  editSubmitMode?: ImageToolEditSubmitMode
  originalImageWidth?: number
  originalImageHeight?: number
  submittedImageWidth?: number
  submittedImageHeight?: number
  submittedMaskWidth?: number
  submittedMaskHeight?: number
  maskBytes?: number
  maskHasOnlyAlpha0And255?: boolean
  multipartFields?: string[]
  referenceImageCount?: number
  referenceImageNames?: string[]
  referenceImageTotalBytes?: number
}

export type ImageProviderTemplate = StorageImageProviderTemplate & { notes?: string }

export const builtInImageProviderTemplates: readonly ImageProviderTemplate[] = [
  {
    id: 'compatible-default',
    name: 'Compatible API',
    description: 'Works with standard Images API or compatible proxies.',
    defaultBaseUrl: 'https://api.openai.com',
    endpointPath: '/v1/images/generations',
    editEndpointPath: '/v1/images/edits',
    model: 'gpt-image-2',
    sendResponseFormat: false,
    sendOutputFormat: true
  }
]

export const imageProviderTemplates = builtInImageProviderTemplates

export const protectedImageProviderTemplateIds = new Set(['compatible-default'])

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
    builtInImageProviderTemplates[0]
  )
}

export type ImageToolGenerateImage2Request = ImageGenerationTaskRequest & {
  endpointPath: string
  sendOutputFormat: boolean
  sendResponseFormat: boolean
  responseFormat?: ImageToolImage2ResponseFormat
  providerTemplateId?: string
  providerTemplateName?: string
  projectId?: string | null
}

export type ImageToolReferenceImage = {
  id: string
  name: string
  dataUrl: string
  mimeType: string
  fileType?: string
  size: number
  width?: number
  height?: number
}

export type ImageToolReferenceImageMetadata = Pick<ImageToolReferenceImage, 'name' | 'mimeType' | 'size'>

export type ImageToolEditImage2Request = Omit<ImageEditTaskRequest, 'images'> & {
  editEndpointPath: string
  sendOutputFormat: boolean
  sendResponseFormat: boolean
  responseFormat?: ImageToolImage2ResponseFormat
  providerTemplateId?: string
  providerTemplateName?: string
  projectId?: string | null
  images: ImageToolReferenceImage[]
  mask?: ImageToolReferenceImage
} & ImageToolEditSubmitMetadata

export type ImageToolTestConnectionRequest = Pick<
  ImageToolGenerateImage2Request,
  | 'baseUrl'
  | 'apiKey'
  | 'model'
  | 'size'
  | 'quality'
  | 'outputFormat'
  | 'endpointPath'
  | 'sendOutputFormat'
  | 'sendResponseFormat'
  | 'responseFormat'
>

export type ImageToolConnectionRequestSummary = {
  model: string
  size: string
  quality: string
  outputFormat: string
  responseFormat: string
}

export type ImageToolTestConnectionResult =
  | {
      ok: true
      status: 'success'
      endpoint: string
      model: string
      size: string
      hasUrl: boolean
      hasB64Json: boolean
      requestSummary: ImageToolConnectionRequestSummary
    }
  | {
      ok: false
      status: 'failed'
      endpoint?: string
      code: string
      message: string
      httpStatus?: number
      upstreamCode?: string
      upstreamType?: string
      requestSummary?: ImageToolConnectionRequestSummary
    }

export type ImageToolGeneratedImage = {
  b64Json?: string
  url?: string
  previewDataUrl?: string
  historyId?: string
  imageMimeType?: string
  imageFileName?: string
  revisedPrompt?: string
  width?: number
  height?: number
}

export type ImageToolImageGenerationResult = Omit<ImageGenerationTaskResult, 'images'> & {
  images: ImageToolGeneratedImage[]
  historyId?: string
  previewDataUrl?: string
  imageMimeType?: string
  imageFileName?: string
  requestSummary?: Record<string, unknown>
}

export type ImageToolGenerateImage2Result =
  | {
      ok: true
      images: ImageToolGeneratedImage[]
      request: ImageGenerationTaskResult['request']
      historyId?: string
      previewDataUrl?: string
      imageMimeType?: string
      imageFileName?: string
      requestSummary?: Record<string, unknown>
    }
  | {
      ok: false
      error: {
        code: string
        message: string
        status?: number
        upstreamType?: string
        upstreamCode?: string
        endpoint?: string
        requestSummary?: Record<string, unknown>
      }
    }

export type ImageToolGenerateImage2Failure = Extract<ImageToolGenerateImage2Result, { ok: false }>

export type ImageToolTaskStatus = TaskStatus

export type ImageToolImageTask = Omit<ImageGenerationTask, 'result'> & {
  result?: ImageToolImageGenerationResult
}

export type ImageToolImageTaskEvent = Omit<TaskEvent, 'task'> & {
  task: ImageToolImageTask
}

export type ImageToolImageTaskEventCallback = (event: ImageToolImageTaskEvent) => void

export type ImageToolPersistedSettings = ImageToolSettings

export type ImageToolTaskRecord = TaskRecord

export type ImageToolTaskRecordFilters = TaskRecordFilters

export type ImageToolTaskUsageStats = TaskUsageStats

export type ImageToolUsageCurrency = UsageCurrency

export type ImageToolTaskUsageSnapshot = {
  records: ImageToolTaskRecord[]
  stats: ImageToolTaskUsageStats
}

export type ImageToolUsagePriceSettings = {
  defaultUnitPrice: number
  currency: ImageToolUsageCurrency
  providerUnitPrices: Record<string, number>
}

export type ImageToolProjectGroup = ProjectGroup

export type ImageToolConversation = Conversation

export type ImageToolSessionState = {
  projects: ImageToolProjectGroup[]
  conversations: ImageToolConversation[]
  activeConversationId?: string
  trashRetentionDays?: number
}

export type ImageToolHistoryItem = Omit<ImageHistoryItem, 'imagePath'>

export type ImageToolPromptTemplateType = PromptTemplateType

export type ImageToolPromptTemplateVariable = PromptTemplateVariable

export type ImageToolPromptTemplateRecommendedParams = PromptTemplateRecommendedParams

export type ImageToolPromptTemplateCategory = PromptTemplateCategory

export type ImageToolPromptTemplate = PromptTemplate & {
  previewDataUrl?: string
}

export type ImageToolPromptTemplateCategoryInput = Partial<PromptTemplateCategory> & {
  name: string
}

export type ImageToolPromptTemplateInput = Partial<Omit<PromptTemplate, 'createdAt' | 'updatedAt' | 'previewAssetId'>> &
  Pick<PromptTemplate, 'title' | 'templateType' | 'prompt'> & {
    previewImageDataUrl?: string
    removePreview?: boolean
  }

export type ImageToolSaveImageResultAsPromptTemplateInput = ImageToolPromptTemplateInput & {
  historyId?: string
  imageDataUrl?: string
}

export type ImageToolPromptTemplateImportError = {
  fileName?: string
  reason: string
}

export type ImageToolPromptTemplateImportResult = {
  imported: number
  skipped: number
  updated?: number
  errors: ImageToolPromptTemplateImportError[]
}

export type ImageToolPromptTemplateExportResult = {
  filePath: string
  fileName: string
}

export type ConversationParams = {
  mode?: 'image_generation' | 'image_reference' | 'image_edit'
  model: string
  size: string
  quality: ImageToolImage2Quality
  outputFormat: ImageToolImage2OutputFormat
  n?: number
}

export type ConversationMessage = {
  id: string
  conversationId?: string
  role: 'user' | 'assistant'
  kind: 'prompt' | 'generating' | 'image_result' | 'error'
  createdAt: number
  prompt?: string
  params?: ConversationParams
  referenceImages?: ImageToolReferenceImage[]
  result?: ImageToolGenerateImage2Result
  historyId?: string
  imageDataUrl?: string
  imageFileName?: string
  error?: {
    code?: string
    message: string
    debugDetails?: ImageToolDebugDetails
  }
  relatedMessageId?: string
  taskId?: string
  status?: ImageToolTaskStatus
}
