export type TaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled'

export type TaskError = {
  code?: string
  message: string
  status?: number
  upstreamType?: string
  upstreamCode?: string
  endpoint?: string
  requestSummary?: Record<string, unknown>
}

export type ImageGenerationTaskRequest = {
  conversationId?: string
  baseUrl: string
  apiKey: string
  endpointPath?: string
  model: string
  prompt: string
  size: string
  quality?: 'auto' | 'low' | 'medium' | 'high'
  outputFormat?: 'png' | 'jpeg' | 'webp'
  n?: number
}

export type ImageEditReferenceImage = {
  name: string
  mimeType: string
  size: number
  width?: number
  height?: number
  dataUrl?: string
  buffer?: ArrayBuffer | Uint8Array
}

export type ImageEditTaskRequest = ImageGenerationTaskRequest & {
  editEndpointPath?: string
  images: ImageEditReferenceImage[]
  mask?: ImageEditReferenceImage
  editMode?: 'reference' | 'masked_edit'
}

export type ImageGenerationTaskResult = {
  images: Array<{
    b64Json?: string
    url?: string
    revisedPrompt?: string
    width?: number
    height?: number
  }>
  request: {
    model: string
    size: string
    quality?: string
    outputFormat?: string
    n?: number
  }
}

export type ImageGenerationTaskSafeRequest = {
  conversationId?: string
  model: string
  prompt: string
  size: string
  quality?: 'auto' | 'low' | 'medium' | 'high'
  outputFormat?: 'png' | 'jpeg' | 'webp'
  n?: number
}

export type ImageEditTaskSafeRequest = ImageGenerationTaskSafeRequest & {
  editMode: 'reference' | 'masked_edit'
  referenceImageCount: number
  referenceImageNames: string[]
  referenceImageTotalBytes: number
  referenceImages: Array<{
    name: string
    mimeType: string
    size: number
    width?: number
    height?: number
  }>
  mask?: {
    name: string
    mimeType: string
    size: number
    width?: number
    height?: number
  }
}

export type ImageTaskType = 'image_generation' | 'image_edit'

export type ImageGenerationTask = {
  id: string
  type: ImageTaskType
  status: TaskStatus
  request: ImageGenerationTaskSafeRequest | ImageEditTaskSafeRequest
  createdAt: number
  updatedAt: number
  startedAt?: number
  finishedAt?: number
  result?: ImageGenerationTaskResult
  error?: TaskError
}

export type TaskEvent = {
  type: 'created' | 'updated' | 'succeeded' | 'failed' | 'canceled'
  task: ImageGenerationTask
}

const createTaskId = (): string => {
  const globalCrypto = globalThis.crypto

  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    return globalCrypto.randomUUID()
  }

  const randomSegment = Math.random().toString(36).slice(2, 12)
  return `task_${Date.now().toString(36)}_${randomSegment}`
}

export const createImageGenerationTask = (request: ImageGenerationTaskRequest): ImageGenerationTask => {
  const now = Date.now()
  const safeRequest: ImageGenerationTaskSafeRequest = {
    ...(request.conversationId !== undefined ? { conversationId: request.conversationId } : {}),
    model: request.model,
    prompt: request.prompt,
    size: request.size,
    ...(request.quality !== undefined ? { quality: request.quality } : {}),
    ...(request.outputFormat !== undefined ? { outputFormat: request.outputFormat } : {}),
    ...(request.n !== undefined ? { n: request.n } : {})
  }

  return {
    id: createTaskId(),
    type: 'image_generation',
    status: 'queued',
    request: safeRequest,
    createdAt: now,
    updatedAt: now
  }
}

export const createImageEditTask = (request: ImageEditTaskRequest): ImageGenerationTask => {
  const task = createImageGenerationTask(request)
  const editMode = request.editMode ?? (request.mask ? 'masked_edit' : 'reference')
  const safeRequest: ImageEditTaskSafeRequest = {
    ...task.request,
    editMode,
    referenceImageCount: request.images.length,
    referenceImageNames: request.images.map((image) => image.name),
    referenceImageTotalBytes: request.images.reduce((total, image) => total + image.size, 0),
    referenceImages: request.images.map((image) => ({
      name: image.name,
      mimeType: image.mimeType,
      size: image.size,
      ...(image.width !== undefined ? { width: image.width } : {}),
      ...(image.height !== undefined ? { height: image.height } : {})
    })),
    ...(request.mask
      ? {
          mask: {
            name: request.mask.name,
            mimeType: request.mask.mimeType,
            size: request.mask.size,
            ...(request.mask.width !== undefined ? { width: request.mask.width } : {}),
            ...(request.mask.height !== undefined ? { height: request.mask.height } : {})
          }
        }
      : {})
  }

  return {
    ...task,
    type: 'image_edit',
    request: safeRequest
  }
}

export const markTaskRunning = (task: ImageGenerationTask): ImageGenerationTask => {
  const now = Date.now()

  return {
    ...task,
    status: 'running',
    updatedAt: now,
    startedAt: task.startedAt ?? now
  }
}

export const markTaskSucceeded = (
  task: ImageGenerationTask,
  result: ImageGenerationTaskResult
): ImageGenerationTask => {
  const now = Date.now()

  return {
    ...task,
    status: 'succeeded',
    updatedAt: now,
    finishedAt: now,
    result,
    error: undefined
  }
}

export const markTaskFailed = (task: ImageGenerationTask, error: TaskError): ImageGenerationTask => {
  const now = Date.now()

  return {
    ...task,
    status: 'failed',
    updatedAt: now,
    finishedAt: now,
    error
  }
}

export const markTaskCanceled = (task: ImageGenerationTask): ImageGenerationTask => {
  const now = Date.now()

  return {
    ...task,
    status: 'canceled',
    updatedAt: now,
    finishedAt: now
  }
}
