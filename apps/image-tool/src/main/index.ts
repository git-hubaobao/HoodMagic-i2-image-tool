import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, relative } from 'node:path'
import { inflateSync } from 'node:zlib'

import {
  generateImageEditWithImage2,
  generateImageWithImage2,
  Image2AdapterError
} from '@hoodmagic/provider-adapters/image2'
import {
  addImageHistoryItem,
  clearTaskRecords,
  createConversation,
  createDefaultImageToolSettings,
  createImageFileName,
  createImagePromptPackExport,
  createImagePromptTemplateExport,
  createProjectGroup,
  createTaskRecord,
  DEFAULT_PROMPT_TEMPLATE_CATEGORY_ID,
  ensureUniqueFilePath,
  filterTaskRecords,
  getActiveConversationId,
  getImageFileExtension,
  getImageProviderTemplate,
  type ImageHistoryItem,
  type ImageToolData,
  type ImageToolSettings,
  moveConversationToProject,
  moveConversationToTrash,
  parsePromptTemplateImportDocument,
  permanentlyDeleteConversation,
  type PromptTemplate,
  type PromptTemplateCategory,
  type PromptTemplateImportRecord,
  removeImageHistoryItem,
  removeProjectGroup,
  removePromptTemplate,
  removePromptTemplateCategory,
  renameConversation,
  renameProjectGroup,
  restoreConversation,
  sanitizeFileNamePart,
  sanitizeImageToolData,
  setActiveConversation,
  summarizeTaskUsage,
  type TaskRecord,
  type TaskRecordFilters,
  type TaskRecordType,
  updateTaskRecord,
  upsertPromptTemplate,
  upsertPromptTemplateCategory
} from '@hoodmagic/storage'
import {
  createImageEditTask,
  createImageGenerationTask,
  markTaskFailed,
  markTaskRunning,
  markTaskSucceeded,
  type TaskError,
  type TaskEvent
} from '@hoodmagic/task-core'
import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron'

import type {
  ImageToolEditImage2Request,
  ImageToolGeneratedImage,
  ImageToolGenerateImage2Failure,
  ImageToolGenerateImage2Request,
  ImageToolGenerateImage2Result,
  ImageToolHistoryItem,
  ImageToolImage2OutputFormat,
  ImageToolImage2ResponseFormat,
  ImageToolImageGenerationResult,
  ImageToolImageTask,
  ImageToolImageTaskEvent,
  ImageToolPromptTemplate,
  ImageToolPromptTemplateCategoryInput,
  ImageToolPromptTemplateExportResult,
  ImageToolPromptTemplateImportResult,
  ImageToolPromptTemplateInput,
  ImageToolReferenceImage,
  ImageToolSaveImageResultAsPromptTemplateInput,
  ImageToolSessionState,
  ImageToolTaskUsageSnapshot,
  ImageToolTestConnectionRequest,
  ImageToolTestConnectionResult,
  ImageToolUsagePriceSettings
} from '../shared/image2'

const imageTasks = new Map<string, ImageToolImageTask>()
const PRODUCT_NAME = 'HoodMagic小魔帽'
const TOOL_NAME = 'i2 生图工具'
const WINDOW_TITLE = `${PRODUCT_NAME} - ${TOOL_NAME}`

const getWindowIconPath = (): string | undefined => {
  const candidatePaths = app.isPackaged
    ? [join(process.resourcesPath, 'icon.ico'), join(process.resourcesPath, 'build', 'icon.ico')]
    : [join(app.getAppPath(), 'build', 'icon.ico'), join(__dirname, '../../build/icon.ico')]

  return candidatePaths.find((candidatePath) => existsSync(candidatePath))
}

const getImageToolDataDir = (): string => join(app.getPath('userData'), 'image-tool')

const getImageToolDataPath = (): string => join(getImageToolDataDir(), 'data.json')

const getImageToolImagesDir = (): string => join(getImageToolDataDir(), 'images')

const getPromptLibraryDir = (): string => join(getImageToolDataDir(), 'prompt-library')

const getPromptLibraryTemplatesDir = (): string => join(getPromptLibraryDir(), 'templates')

const getPromptLibraryImportsDir = (): string => join(getPromptLibraryDir(), 'imports')

const getPromptLibraryExportsDir = (): string => join(getPromptLibraryDir(), 'exports')

const getPromptLibraryAssetsDir = (): string => join(getPromptLibraryDir(), 'assets')

const normalizeEndpointPath = (endpointPath?: string): string => {
  const normalizedPath = endpointPath?.trim() || '/v1/images/generations'
  return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`
}

const normalizeEditEndpointPath = (endpointPath?: string): string => {
  const normalizedPath = endpointPath?.trim() || '/v1/images/edits'
  return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`
}

const createImage2Endpoint = (baseUrl: string, endpointPath?: string): string => {
  return `${baseUrl.trim().replace(/\/+$/, '')}${normalizeEndpointPath(endpointPath)}`
}

const createImage2EditEndpoint = (baseUrl: string, endpointPath?: string): string => {
  return `${baseUrl.trim().replace(/\/+$/, '')}${normalizeEditEndpointPath(endpointPath)}`
}

const ensureImageToolDataDir = async (): Promise<void> => {
  await mkdir(getImageToolImagesDir(), { recursive: true })
  await Promise.all([
    mkdir(getPromptLibraryTemplatesDir(), { recursive: true }),
    mkdir(getPromptLibraryImportsDir(), { recursive: true }),
    mkdir(getPromptLibraryExportsDir(), { recursive: true }),
    mkdir(getPromptLibraryAssetsDir(), { recursive: true })
  ])
}

type SupportedImageMimeType = 'image/png' | 'image/jpeg' | 'image/webp'

type DetectedImageType = 'jpeg' | 'png' | 'webp' | 'unknown'

type MaterializedImage = {
  image: ImageToolGeneratedImage
  imagePath: string
  imageFileName: string
  imageMimeType: SupportedImageMimeType
  previewDataUrl: string
}

type Image2AdapterFormatOptions = {
  outputFormat?: ImageToolImage2OutputFormat
  responseFormat?: ImageToolImage2ResponseFormat
  sendOutputFormat: boolean
  sendResponseFormat: boolean
}

type MaterializedReferenceImage = {
  name: string
  mimeType: SupportedImageMimeType
  size: number
  buffer: Buffer
  width?: number
  height?: number
  dimensionsSource?: 'buffer' | 'metadata'
}

class ImageToolMainError extends Error {
  code: string
  status?: number
  requestSummary?: Record<string, unknown>

  constructor(code: string, message: string, status?: number, requestSummary?: Record<string, unknown>) {
    super(message)
    this.name = 'ImageToolMainError'
    this.code = code
    this.status = status
    this.requestSummary = requestSummary
  }
}

const toSupportedImageMimeType = (mimeType: unknown): SupportedImageMimeType | undefined => {
  if (typeof mimeType !== 'string') {
    return undefined
  }

  const normalizedMimeType = mimeType.toLowerCase().split(';')[0]?.trim()

  if (normalizedMimeType === 'image/jpeg' || normalizedMimeType === 'image/jpg') {
    return 'image/jpeg'
  }

  if (normalizedMimeType === 'image/png') {
    return 'image/png'
  }

  if (normalizedMimeType === 'image/webp') {
    return 'image/webp'
  }

  return undefined
}

const getImageMimeType = (
  outputFormat: unknown,
  imagePath?: string,
  preferredMimeType?: unknown
): SupportedImageMimeType => {
  const normalizedPreferredMimeType = toSupportedImageMimeType(preferredMimeType)

  if (normalizedPreferredMimeType) {
    return normalizedPreferredMimeType
  }

  const extension = imagePath ? extname(imagePath).toLowerCase() : ''

  if (outputFormat === 'jpeg' || outputFormat === 'jpg') {
    return 'image/jpeg'
  }

  if (outputFormat === 'webp') {
    return 'image/webp'
  }

  if (extension === '.jpeg' || extension === '.jpg') {
    return 'image/jpeg'
  }

  if (extension === '.webp') {
    return 'image/webp'
  }

  return 'image/png'
}

const getMimeTypeFromDetectedType = (detectedType: DetectedImageType): SupportedImageMimeType | undefined => {
  if (detectedType === 'jpeg') {
    return 'image/jpeg'
  }

  if (detectedType === 'png') {
    return 'image/png'
  }

  if (detectedType === 'webp') {
    return 'image/webp'
  }

  return undefined
}

const detectImageType = (buffer: Buffer): DetectedImageType => {
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  const isPng =
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  const isWebp =
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50

  if (isJpeg) {
    return 'jpeg'
  }

  if (isPng) {
    return 'png'
  }

  if (isWebp) {
    return 'webp'
  }

  return 'unknown'
}

const readPngDimensions = (buffer: Buffer): { width: number; height: number } | undefined => {
  if (buffer.length < 24 || detectImageType(buffer) !== 'png') {
    return undefined
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  }
}

const readJpegDimensions = (buffer: Buffer): { width: number; height: number } | undefined => {
  if (buffer.length < 4 || detectImageType(buffer) !== 'jpeg') {
    return undefined
  }

  let offset = 2

  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1
      continue
    }

    const marker = buffer[offset + 1]
    const length = buffer.readUInt16BE(offset + 2)

    if (length < 2) {
      return undefined
    }

    if (
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xce ||
      marker === 0xcf
    ) {
      return {
        width: buffer.readUInt16BE(offset + 7),
        height: buffer.readUInt16BE(offset + 5)
      }
    }

    offset += 2 + length
  }

  return undefined
}

const readWebpDimensions = (buffer: Buffer): { width: number; height: number } | undefined => {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
    return undefined
  }

  const chunkType = buffer.toString('ascii', 12, 16)

  if (chunkType === 'VP8X' && buffer.length >= 30) {
    return {
      width: buffer.readUIntLE(24, 3) + 1,
      height: buffer.readUIntLE(27, 3) + 1
    }
  }

  if (chunkType === 'VP8L' && buffer.length >= 25 && buffer[20] === 0x2f) {
    const bits = buffer.readUInt32LE(21)

    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1
    }
  }

  if (
    chunkType === 'VP8 ' &&
    buffer.length >= 30 &&
    buffer[23] === 0x9d &&
    buffer[24] === 0x01 &&
    buffer[25] === 0x2a
  ) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff
    }
  }

  return undefined
}

const readImageDimensions = (buffer: Buffer): { width: number; height: number } | undefined => {
  return readPngDimensions(buffer) ?? readJpegDimensions(buffer) ?? readWebpDimensions(buffer)
}

const getDeclaredImageDimensions = (image: ImageToolReferenceImage): { width: number; height: number } | undefined => {
  if (
    typeof image.width === 'number' &&
    Number.isFinite(image.width) &&
    image.width > 0 &&
    typeof image.height === 'number' &&
    Number.isFinite(image.height) &&
    image.height > 0
  ) {
    return {
      width: Math.round(image.width),
      height: Math.round(image.height)
    }
  }

  return undefined
}

const readPngChunks = (buffer: Buffer, type: string): Buffer[] => {
  const chunks: Buffer[] = []
  let offset = 8

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const chunkType = buffer.toString('ascii', offset + 4, offset + 8)
    const dataStart = offset + 8
    const dataEnd = dataStart + length

    if (dataEnd + 4 > buffer.length) {
      break
    }

    if (chunkType === type) {
      chunks.push(buffer.subarray(dataStart, dataEnd))
    }

    offset = dataEnd + 4
  }

  return chunks
}

const paethPredictor = (left: number, up: number, upperLeft: number): number => {
  const prediction = left + up - upperLeft
  const leftDistance = Math.abs(prediction - left)
  const upDistance = Math.abs(prediction - up)
  const upperLeftDistance = Math.abs(prediction - upperLeft)

  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) {
    return left
  }

  return upDistance <= upperLeftDistance ? up : upperLeft
}

const unfilterPngScanlines = (inflated: Buffer, width: number, height: number, bytesPerPixel: number): Buffer => {
  const rowLength = width * bytesPerPixel
  const output = Buffer.alloc(rowLength * height)
  let inputOffset = 0

  for (let y = 0; y < height; y += 1) {
    const filterType = inflated[inputOffset]
    inputOffset += 1
    const rowOffset = y * rowLength
    const previousRowOffset = rowOffset - rowLength

    for (let x = 0; x < rowLength; x += 1) {
      const raw = inflated[inputOffset + x]
      const left = x >= bytesPerPixel ? output[rowOffset + x - bytesPerPixel] : 0
      const up = y > 0 ? output[previousRowOffset + x] : 0
      const upperLeft = y > 0 && x >= bytesPerPixel ? output[previousRowOffset + x - bytesPerPixel] : 0

      switch (filterType) {
        case 0:
          output[rowOffset + x] = raw
          break
        case 1:
          output[rowOffset + x] = (raw + left) & 0xff
          break
        case 2:
          output[rowOffset + x] = (raw + up) & 0xff
          break
        case 3:
          output[rowOffset + x] = (raw + Math.floor((left + up) / 2)) & 0xff
          break
        case 4:
          output[rowOffset + x] = (raw + paethPredictor(left, up, upperLeft)) & 0xff
          break
        default:
          throw new ImageToolMainError('invalid_mask_image', `Unsupported PNG filter type ${filterType}.`)
      }
    }

    inputOffset += rowLength
  }

  return output
}

const readPngAlphaStats = (
  buffer: Buffer
):
  | { hasTransparentPixel: boolean; otherAlphaCount: number; alpha0Count: number; alpha255Count: number }
  | undefined => {
  const dimensions = readPngDimensions(buffer)

  if (!dimensions || buffer.length < 33) {
    return undefined
  }

  const bitDepth = buffer[24]
  const colorType = buffer[25]
  const compression = buffer[26]
  const filter = buffer[27]
  const interlace = buffer[28]

  if (bitDepth !== 8 || colorType !== 6 || compression !== 0 || filter !== 0 || interlace !== 0) {
    return undefined
  }

  const idatChunks = readPngChunks(buffer, 'IDAT')

  if (idatChunks.length === 0) {
    return undefined
  }

  const pixels = unfilterPngScanlines(inflateSync(Buffer.concat(idatChunks)), dimensions.width, dimensions.height, 4)
  let alpha0Count = 0
  let alpha255Count = 0
  let otherAlphaCount = 0

  for (let index = 3; index < pixels.length; index += 4) {
    const alpha = pixels[index]

    if (alpha === 0) {
      alpha0Count += 1
    } else if (alpha === 255) {
      alpha255Count += 1
    } else {
      otherAlphaCount += 1
    }
  }

  return {
    hasTransparentPixel: alpha0Count > 0,
    otherAlphaCount,
    alpha0Count,
    alpha255Count
  }
}

const isDataImageBase64Url = (value: string): boolean => {
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(value.trim())
}

const isHttpUrl = (value: unknown): value is string => {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim())
}

const decodeBase64ImagePayload = (value: string): { buffer: Buffer; mimeType?: SupportedImageMimeType } => {
  const trimmedValue = value.trim()
  const mimeType = isDataImageBase64Url(trimmedValue)
    ? toSupportedImageMimeType(trimmedValue.match(/^data:(image\/[a-z0-9.+-]+);base64,/i)?.[1])
    : undefined
  const payloadStart = isDataImageBase64Url(trimmedValue) ? trimmedValue.indexOf(',') + 1 : 0
  const payload = trimmedValue.slice(payloadStart).replace(/\s/g, '')

  if (!payload) {
    throw new ImageToolMainError('invalid_image_payload', 'Image payload is empty.')
  }

  return {
    buffer: Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64'),
    mimeType
  }
}

const materializeReferenceImage = (image: ImageToolReferenceImage): MaterializedReferenceImage => {
  if (!isNonEmptyString(image.name)) {
    throw new ImageToolMainError('invalid_reference_image', 'Reference image name is required.')
  }

  if (!isDataImageBase64Url(image.dataUrl)) {
    throw new ImageToolMainError('invalid_reference_image', 'Reference image must be a base64 image data URL.')
  }

  const { buffer, mimeType: payloadMimeType } = decodeBase64ImagePayload(image.dataUrl)
  const detectedMimeType = getMimeTypeFromDetectedType(detectImageType(buffer))
  const declaredMimeType = toSupportedImageMimeType(image.mimeType ?? image.fileType)
  const mimeType = detectedMimeType ?? declaredMimeType ?? payloadMimeType
  const parsedDimensions = readImageDimensions(buffer)
  const declaredDimensions = getDeclaredImageDimensions(image)

  if (!mimeType) {
    throw new ImageToolMainError('invalid_reference_image', 'Reference image must be JPEG, PNG, or WEBP.')
  }

  return {
    name: image.name,
    mimeType,
    size: image.size,
    buffer,
    ...(parsedDimensions ?? declaredDimensions),
    ...(parsedDimensions
      ? { dimensionsSource: 'buffer' as const }
      : declaredDimensions
        ? { dimensionsSource: 'metadata' as const }
        : {})
  }
}

const materializeReferenceImages = (images: readonly ImageToolReferenceImage[]): MaterializedReferenceImage[] => {
  if (images.length === 0) {
    throw new ImageToolMainError('missing_reference_image', 'Image edit mode requires at least one reference image.')
  }

  if (images.length > 15) {
    throw new ImageToolMainError('too_many_reference_images', 'Image edit mode supports at most 15 reference images.')
  }

  const materializedImages = images.map(materializeReferenceImage)
  const totalBytes = materializedImages.reduce((total, image) => total + image.buffer.byteLength, 0)

  if (totalBytes > 50 * 1024 * 1024) {
    throw new ImageToolMainError('reference_images_too_large', 'Reference images must be 50MB or smaller in total.')
  }

  return materializedImages
}

const materializeMaskImage = (mask: ImageToolReferenceImage | undefined): MaterializedReferenceImage | undefined => {
  if (!mask) {
    return undefined
  }

  const materializedMask = materializeReferenceImage(mask)

  if (materializedMask.mimeType !== 'image/png') {
    throw new ImageToolMainError('invalid_mask_image', 'Mask image must be a PNG file.')
  }

  if (materializedMask.buffer.byteLength >= 4 * 1024 * 1024) {
    throw new ImageToolMainError('mask_image_too_large', 'Mask image must be smaller than 4MB.')
  }

  return materializedMask
}

const createImageEditSafetySummary = ({
  endpoint,
  images,
  mask,
  request
}: {
  endpoint: string
  images: MaterializedReferenceImage[]
  mask: MaterializedReferenceImage | undefined
  request?: ImageToolEditImage2Request
}): Record<string, unknown> => {
  const image = images[0]

  if (!image) {
    throw new ImageToolMainError('missing_reference_image', 'Image edit mode requires at least one reference image.')
  }

  const maskAlphaStats = mask?.mimeType === 'image/png' ? readPngAlphaStats(mask.buffer) : undefined
  const multipartFields = [
    'image',
    ...(mask ? ['mask'] : []),
    'prompt',
    'model',
    'size',
    'quality',
    'n',
    ...(request?.sendOutputFormat && request.outputFormat ? ['output_format'] : []),
    ...(request?.sendResponseFormat && request.responseFormat ? ['response_format'] : [])
  ]

  return {
    mode: mask ? 'edit' : 'reference',
    finalEndpoint: endpoint,
    referenceImageCount: images.length,
    referenceImageNames: images.map((referenceImage) => referenceImage.name),
    referenceImageTotalBytes: images.reduce((total, referenceImage) => total + referenceImage.buffer.byteLength, 0),
    editSubmitMode: request?.editSubmitMode,
    maskSemantic: request?.maskSemantic,
    maskColorMode: request?.maskColorMode,
    imageBytes: image.buffer.byteLength,
    originalImageWidth: request?.originalImageWidth,
    originalImageHeight: request?.originalImageHeight,
    submittedImageWidth: request?.submittedImageWidth,
    submittedImageHeight: request?.submittedImageHeight,
    submittedMaskWidth: request?.submittedMaskWidth,
    submittedMaskHeight: request?.submittedMaskHeight,
    sourceImageFileName: image.name,
    sourceImageMimeType: image.mimeType,
    sourceImageBytes: image.buffer.byteLength,
    sourceImageWidth: image.width,
    sourceImageHeight: image.height,
    sourceImageDimensionsSource: image.dimensionsSource,
    maskFileName: mask?.name,
    maskMimeType: mask?.mimeType,
    maskBytes: mask?.buffer.byteLength,
    maskWidth: mask?.width,
    maskHeight: mask?.height,
    maskDimensionsSource: mask?.dimensionsSource,
    maskHasTransparentPixel: maskAlphaStats?.hasTransparentPixel,
    maskHasOnlyAlpha0And255: maskAlphaStats ? maskAlphaStats.otherAlphaCount === 0 : undefined,
    maskAlpha0Count: maskAlphaStats?.alpha0Count,
    maskAlpha255Count: maskAlphaStats?.alpha255Count,
    otherAlphaCount: maskAlphaStats?.otherAlphaCount,
    multipartFields
  }
}

const ensureMaskMatchesSourceImage = (
  image: MaterializedReferenceImage,
  mask: MaterializedReferenceImage | undefined,
  requestSummary?: Record<string, unknown>
): void => {
  if (!mask) {
    return
  }

  if (!image.width || !image.height || image.dimensionsSource !== 'buffer') {
    throw new ImageToolMainError(
      'image_dimension_parse_failed',
      'Cannot determine source image dimensions from the actual image buffer before sending image edit request.',
      undefined,
      requestSummary
    )
  }

  if (!mask.width || !mask.height || mask.dimensionsSource !== 'buffer') {
    throw new ImageToolMainError(
      'mask_dimension_parse_failed',
      'Cannot determine mask dimensions from the actual mask buffer before sending image edit request.',
      undefined,
      requestSummary
    )
  }

  if (image.width !== mask.width || image.height !== mask.height) {
    throw new ImageToolMainError(
      'mask_dimension_mismatch',
      `Mask size ${mask.width}x${mask.height} must match source image size ${image.width}x${image.height}.`,
      undefined,
      requestSummary
    )
  }
}

const readImagePayload = async (
  image: ImageToolGeneratedImage | undefined
): Promise<{ buffer: Buffer; mimeType?: SupportedImageMimeType }> => {
  const payload = image?.b64Json ?? image?.previewDataUrl

  if (payload) {
    if (isHttpUrl(payload)) {
      return readImageUrl(payload)
    }

    return decodeBase64ImagePayload(payload)
  }

  if (image?.url) {
    if (isDataImageBase64Url(image.url)) {
      return decodeBase64ImagePayload(image.url)
    }

    if (isHttpUrl(image.url)) {
      return readImageUrl(image.url)
    }
  }

  throw new ImageToolMainError('missing_image_payload', 'Image2 response did not include previewable image data.')
}

const readImageUrl = async (url: string): Promise<{ buffer: Buffer; mimeType?: SupportedImageMimeType }> => {
  let response: Response

  try {
    response = await fetch(url)
  } catch (error) {
    throw new ImageToolMainError(
      'download_failed',
      error instanceof Error ? `Failed to download generated image: ${error.message}` : 'Failed to download image.'
    )
  }

  if (!response.ok) {
    throw new ImageToolMainError(
      'download_failed',
      `Failed to download generated image with status ${response.status}.`,
      response.status
    )
  }

  const buffer = Buffer.from(await response.arrayBuffer())

  return {
    buffer,
    mimeType: toSupportedImageMimeType(response.headers.get('content-type'))
  }
}

const readImageToolData = async (): Promise<ImageToolData> => {
  await ensureImageToolDataDir()

  try {
    const rawData = await readFile(getImageToolDataPath(), 'utf8')
    return sanitizeImageToolData(JSON.parse(rawData))
  } catch {
    return sanitizeImageToolData(undefined)
  }
}

const writeImageToolData = async (data: ImageToolData): Promise<ImageToolData> => {
  await ensureImageToolDataDir()
  const sanitizedData = sanitizeImageToolData(data)
  await writeFile(getImageToolDataPath(), `${JSON.stringify(sanitizedData, null, 2)}\n`, 'utf8')
  return sanitizedData
}

const toSessionState = (data: ImageToolData): ImageToolSessionState => ({
  projects: data.projects,
  conversations: data.conversations,
  activeConversationId: data.activeConversationId,
  trashRetentionDays: data.trashRetentionDays
})

const toUsageSnapshot = (data: ImageToolData, filters: TaskRecordFilters = {}): ImageToolTaskUsageSnapshot => {
  const records = filterTaskRecords(data.taskRecords, filters)

  return {
    records,
    stats: summarizeTaskUsage(records)
  }
}

const updateTaskUsageData = async (
  updater: (data: ImageToolData) => ImageToolData | Promise<ImageToolData>
): Promise<ImageToolData> => {
  const data = await readImageToolData()
  const nextData = await updater(data)
  return writeImageToolData(nextData)
}

const resolveWritableConversationData = (
  data: ImageToolData,
  conversationId?: string
): { conversationId: string; data: ImageToolData } => {
  if (
    conversationId &&
    data.conversations.some((conversation) => conversation.id === conversationId && !conversation.deletedAt)
  ) {
    return { conversationId, data }
  }

  const activeConversationId = getActiveConversationId(data)

  if (activeConversationId) {
    return { conversationId: activeConversationId, data }
  }

  const nextData = createConversation(data, { projectId: null })
  const createdConversationId = nextData.activeConversationId ?? nextData.conversations[0]?.id

  if (!createdConversationId) {
    throw new Error('No writable conversation is available.')
  }

  return { conversationId: createdConversationId, data: nextData }
}

const saveImageBuffer = async ({
  buffer,
  createdAt,
  taskId,
  model,
  size,
  outputFormat,
  mimeType
}: {
  buffer: Buffer
  createdAt: number
  taskId: string
  model: string
  size: string
  outputFormat?: string
  mimeType: SupportedImageMimeType
}): Promise<{ imagePath: string; imageFileName: string }> => {
  await ensureImageToolDataDir()
  const fileName = createImageFileName({
    createdAt,
    taskId,
    model,
    size,
    outputFormat,
    mimeType
  })
  const imagePath = ensureUniqueFilePath(getImageToolImagesDir(), fileName)

  await writeFile(imagePath, buffer)

  return {
    imagePath,
    imageFileName: basename(imagePath)
  }
}

const isPathInside = (targetPath: string, parentPath: string): boolean => {
  const relativePath = relative(parentPath, targetPath)
  return Boolean(relativePath) && !relativePath.startsWith('..') && !relativePath.includes(':')
}

const createPromptLibraryId = (prefix: string): string => {
  const globalCrypto = globalThis.crypto

  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    return globalCrypto.randomUUID()
  }

  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

const getPromptAssetPath = (assetId: string): string => join(getPromptLibraryAssetsDir(), basename(assetId))

const isPromptTemplateImportFile = (fileName: string): boolean => {
  const normalizedFileName = fileName.toLowerCase()
  return (
    normalizedFileName.endsWith('.json') ||
    normalizedFileName.endsWith('.image-prompt-template.json') ||
    normalizedFileName.endsWith('.image-prompt-pack.json')
  )
}

const createDataUrlHash = (dataUrl?: string): string => {
  return createHash('sha256')
    .update(dataUrl ?? '')
    .digest('hex')
}

const createTemplateFingerprint = (
  template: Pick<PromptTemplate, 'title' | 'prompt'>,
  previewDataUrl?: string
): string => {
  return createHash('sha256')
    .update(`${template.title.trim().toLowerCase()}\n${template.prompt.trim()}\n${createDataUrlHash(previewDataUrl)}`)
    .digest('hex')
}

const readPromptTemplatePreview = async (template: PromptTemplate): Promise<string | undefined> => {
  if (!template.previewAssetId) {
    return undefined
  }

  const assetPath = getPromptAssetPath(template.previewAssetId)

  if (!isPathInside(assetPath, getPromptLibraryAssetsDir())) {
    return undefined
  }

  try {
    const imageBuffer = await readFile(assetPath)
    const detectedMimeType = getMimeTypeFromDetectedType(detectImageType(imageBuffer))

    if (!detectedMimeType) {
      return undefined
    }

    return `data:${detectedMimeType};base64,${imageBuffer.toString('base64')}`
  } catch {
    return undefined
  }
}

const toPublicPromptTemplate = async (template: PromptTemplate): Promise<ImageToolPromptTemplate> => {
  const previewDataUrl = await readPromptTemplatePreview(template)

  return {
    ...template,
    ...(previewDataUrl ? { previewDataUrl } : {})
  }
}

const removePromptTemplatePreviewAsset = async (assetId?: string): Promise<void> => {
  if (!assetId) {
    return
  }

  const assetPath = getPromptAssetPath(assetId)

  if (!isPathInside(assetPath, getPromptLibraryAssetsDir())) {
    return
  }

  await rm(assetPath, { force: true })
}

const promptTemplatePreviewImageExtensions = ['.png', '.jpg', '.jpeg', '.webp'] as const

const isPromptTemplatePreviewImageFile = (fileName: string): boolean => {
  return promptTemplatePreviewImageExtensions.includes(
    extname(fileName).toLowerCase() as (typeof promptTemplatePreviewImageExtensions)[number]
  )
}

const isValidPromptTemplatePreviewBuffer = (buffer: Buffer): boolean => {
  return Boolean(getMimeTypeFromDetectedType(detectImageType(buffer)))
}

const savePromptTemplatePreviewAssetBuffer = async (
  buffer: Buffer,
  templateId: string,
  sourceFileName: string,
  preferredMimeType?: SupportedImageMimeType
): Promise<string> => {
  const detectedMimeType = getMimeTypeFromDetectedType(detectImageType(buffer))
  const mimeType = detectedMimeType ?? preferredMimeType

  if (!mimeType) {
    throw new ImageToolMainError('invalid_preview_image', 'Preview image must be a valid JPEG, PNG, or WEBP image.')
  }

  const parsedSourceName = basename(sourceFileName, extname(sourceFileName))
  const extension = getImageFileExtension(undefined, mimeType)
  const fileName = `${sanitizeFileNamePart(templateId)}-${sanitizeFileNamePart(parsedSourceName)}.${extension}`
  const assetPath = ensureUniqueFilePath(getPromptLibraryAssetsDir(), fileName)

  await writeFile(assetPath, buffer)

  return basename(assetPath)
}

const savePromptTemplatePreviewAsset = async (
  dataUrl: string | undefined,
  templateId: string
): Promise<string | undefined> => {
  if (!dataUrl) {
    return undefined
  }

  const { buffer, mimeType: payloadMimeType } = decodeBase64ImagePayload(dataUrl)
  const detectedMimeType = getMimeTypeFromDetectedType(detectImageType(buffer))
  const mimeType = detectedMimeType ?? payloadMimeType

  if (!mimeType) {
    throw new ImageToolMainError('invalid_preview_image', 'Preview image must be a valid JPEG, PNG, or WEBP image.')
  }

  return savePromptTemplatePreviewAssetBuffer(
    buffer,
    templateId,
    `${templateId}.${getImageFileExtension(undefined, mimeType)}`,
    mimeType
  )
}

const getPromptTemplatePreviewReference = (record: PromptTemplateImportRecord): string | undefined => {
  const previewImage = record.previewImage
  const reference = [previewImage?.fileName, previewImage?.path, previewImage?.assetId, record.previewImageFile].find(
    (value) => typeof value === 'string' && value.trim()
  )

  return typeof reference === 'string' ? reference.trim() : undefined
}

const getImportFileStem = (fileName: string | undefined): string | undefined => {
  if (!fileName) {
    return undefined
  }

  return basename(fileName)
    .replace(/\.image-prompt-template\.json$/i, '')
    .replace(/\.image-prompt-pack\.json$/i, '')
    .replace(/\.json$/i, '')
}

const getPromptTemplatePreviewMatchStems = (
  record: PromptTemplateImportRecord,
  fileName: string | undefined
): string[] => {
  const stems = [record.id, record.title, getImportFileStem(fileName)]
  const uniqueStems = new Set<string>()

  for (const stem of stems) {
    if (typeof stem !== 'string' || !stem.trim()) {
      continue
    }

    uniqueStems.add(stem.trim().toLowerCase())
    uniqueStems.add(sanitizeFileNamePart(stem).toLowerCase())
  }

  return [...uniqueStems]
}

const getUniquePromptTemplatePreviewDirs = (sourceDir?: string): string[] => {
  const dirs = [getPromptLibraryAssetsDir(), getPromptLibraryImportsDir(), sourceDir].filter((dir): dir is string =>
    Boolean(dir)
  )
  const uniqueDirs = new Set<string>()

  for (const dir of dirs) {
    uniqueDirs.add(dir)
  }

  return [...uniqueDirs]
}

const getPromptTemplatePreviewReferenceCandidates = (reference: string, sourceDir?: string): string[] => {
  const candidatePaths: string[] = []
  const allowedDirs = getUniquePromptTemplatePreviewDirs(sourceDir)

  if (isAbsolute(reference)) {
    for (const dir of allowedDirs) {
      if (isPathInside(reference, dir)) {
        candidatePaths.push(reference)
        break
      }
    }

    return candidatePaths
  }

  const referenceFileName = basename(reference)

  for (const dir of allowedDirs) {
    const directPath = join(dir, reference)

    if (isPathInside(directPath, dir)) {
      candidatePaths.push(directPath)
    }

    const assetLikePath = join(dir, referenceFileName)

    if (assetLikePath !== directPath && isPathInside(assetLikePath, dir)) {
      candidatePaths.push(assetLikePath)
    }
  }

  return candidatePaths
}

const readPromptTemplatePreviewFile = async (filePath: string): Promise<Buffer | undefined> => {
  if (!isPromptTemplatePreviewImageFile(filePath) || !existsSync(filePath)) {
    return undefined
  }

  try {
    const buffer = await readFile(filePath)
    return isValidPromptTemplatePreviewBuffer(buffer) ? buffer : undefined
  } catch {
    return undefined
  }
}

const findPromptTemplatePreviewFileByStem = async (
  record: PromptTemplateImportRecord,
  fileName: string | undefined,
  sourceDir?: string
): Promise<string | undefined> => {
  const matchStems = new Set(getPromptTemplatePreviewMatchStems(record, fileName))

  if (matchStems.size === 0) {
    return undefined
  }

  for (const dir of getUniquePromptTemplatePreviewDirs(sourceDir)) {
    try {
      const fileNames = await readdir(dir)

      for (const candidateFileName of fileNames) {
        if (!isPromptTemplatePreviewImageFile(candidateFileName)) {
          continue
        }

        const candidateStem = basename(candidateFileName, extname(candidateFileName)).toLowerCase()

        if (!matchStems.has(candidateStem)) {
          continue
        }

        const candidatePath = join(dir, candidateFileName)

        if (!isPathInside(candidatePath, dir) || !(await readPromptTemplatePreviewFile(candidatePath))) {
          continue
        }

        return candidatePath
      }
    } catch {
      continue
    }
  }

  return undefined
}

const resolvePromptTemplatePreviewFile = async (
  record: PromptTemplateImportRecord,
  fileName: string | undefined,
  sourceDir?: string
): Promise<string | undefined> => {
  const reference = getPromptTemplatePreviewReference(record)

  if (reference) {
    for (const candidatePath of getPromptTemplatePreviewReferenceCandidates(reference, sourceDir)) {
      if (await readPromptTemplatePreviewFile(candidatePath)) {
        return candidatePath
      }
    }
  }

  return findPromptTemplatePreviewFileByStem(record, fileName, sourceDir)
}

const savePromptTemplatePreviewAssetFromFile = async (
  filePath: string,
  templateId: string
): Promise<string | undefined> => {
  const buffer = await readPromptTemplatePreviewFile(filePath)

  if (!buffer) {
    return undefined
  }

  if (isPathInside(filePath, getPromptLibraryAssetsDir())) {
    return basename(filePath)
  }

  return savePromptTemplatePreviewAssetBuffer(buffer, templateId, basename(filePath))
}

const savePromptTemplatePreviewAssetForRecord = async (
  record: PromptTemplateImportRecord,
  templateId: string,
  fileName?: string,
  sourceDir?: string
): Promise<string | undefined> => {
  const previewDataUrl = record.previewImage?.dataUrl

  if (previewDataUrl) {
    return savePromptTemplatePreviewAsset(previewDataUrl, templateId)
  }

  const previewFilePath = await resolvePromptTemplatePreviewFile(record, fileName, sourceDir)

  return previewFilePath ? savePromptTemplatePreviewAssetFromFile(previewFilePath, templateId) : undefined
}

const getCategoryPath = (
  categories: readonly PromptTemplateCategory[],
  categoryId: string | null | undefined
): string[] => {
  if (!categoryId || categoryId === DEFAULT_PROMPT_TEMPLATE_CATEGORY_ID) {
    return []
  }

  const categoriesById = new Map(categories.map((category) => [category.id, category]))
  const path: string[] = []
  let currentCategory = categoriesById.get(categoryId)
  const visitedCategoryIds = new Set<string>()

  while (currentCategory && !visitedCategoryIds.has(currentCategory.id)) {
    visitedCategoryIds.add(currentCategory.id)
    path.unshift(currentCategory.name)
    currentCategory = currentCategory.parentId ? categoriesById.get(currentCategory.parentId) : undefined
  }

  return path
}

const ensurePromptTemplateCategoryPath = (
  data: ImageToolData,
  categoryPath: readonly string[] | undefined
): { data: ImageToolData; categoryId: string } => {
  let nextData = sanitizeImageToolData(data)
  let parentId: string | null = null
  let categoryId = DEFAULT_PROMPT_TEMPLATE_CATEGORY_ID

  for (const categoryName of categoryPath ?? []) {
    const name = categoryName.trim()

    if (!name) {
      continue
    }

    const existingCategory = nextData.promptTemplateCategories.find(
      (category) => category.name === name && (category.parentId ?? null) === parentId
    )

    if (existingCategory) {
      categoryId = existingCategory.id
      parentId = existingCategory.id
      continue
    }

    categoryId = createPromptLibraryId('prompt-category')
    nextData = upsertPromptTemplateCategory(nextData, {
      id: categoryId,
      name,
      parentId
    })
    parentId = categoryId
  }

  return {
    data: nextData,
    categoryId
  }
}

const toPromptTemplateImportRecord = async (
  template: PromptTemplate,
  categories: readonly PromptTemplateCategory[]
): Promise<PromptTemplateImportRecord> => {
  const previewDataUrl = await readPromptTemplatePreview(template)

  return {
    title: template.title,
    ...(template.description ? { description: template.description } : {}),
    categoryPath: getCategoryPath(categories, template.categoryId),
    templateType: template.templateType,
    prompt: template.prompt,
    ...(template.variables ? { variables: template.variables } : {}),
    ...(template.tags ? { tags: template.tags } : {}),
    ...(template.recommendedParams ? { recommendedParams: template.recommendedParams } : {}),
    ...(typeof template.isFavorite === 'boolean' ? { isFavorite: template.isFavorite } : {}),
    ...(previewDataUrl
      ? {
          previewImage: {
            mimeType: previewDataUrl.slice(5, previewDataUrl.indexOf(';')),
            dataUrl: previewDataUrl
          }
        }
      : {}),
    createdAt: template.createdAt,
    updatedAt: template.updatedAt
  }
}

const createExportFileName = (name: string, extension: '.image-prompt-template.json' | '.image-prompt-pack.json') => {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
  return `${sanitizeFileNamePart(name)}-${timestamp}${extension}`
}

const writePromptTemplateExport = async (
  fileName: string,
  document: unknown
): Promise<ImageToolPromptTemplateExportResult> => {
  await ensureImageToolDataDir()
  const filePath = ensureUniqueFilePath(getPromptLibraryExportsDir(), fileName)

  await writeFile(filePath, `${JSON.stringify(document, null, 2)}\n`, 'utf8')

  return {
    filePath,
    fileName: basename(filePath)
  }
}

const escapeCsvField = (value: unknown): string => {
  const text = String(value ?? '')

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

const createTaskUsageCsv = (data: ImageToolData, filters: TaskRecordFilters): string => {
  const records = filterTaskRecords(data.taskRecords, filters)
  const header = ['time', 'apiTemplate', 'type', 'status', 'model', 'size', 'imageCount', 'unitPrice', 'cost']
  const getRecordCost = (record: TaskRecord): number => {
    if (record.status === 'failed' || record.status === 'canceled') {
      return 0
    }
    return record.estimatedCost
  }

  const rows = records.map((record) => [
    record.createdAt,
    record.providerTemplateName,
    record.taskType,
    record.status,
    record.model,
    record.size ?? '',
    record.status === 'succeeded' ? record.successfulImageCount : record.requestedImageCount,
    record.unitPrice.toFixed(4),
    getRecordCost(record).toFixed(2)
  ])

  return [header, ...rows].map((row) => row.map(escapeCsvField).join(',')).join('\n')
}

const readHistoryImageDataUrl = async (data: ImageToolData, id: string): Promise<string | undefined> => {
  const item = data.history.find((historyItem) => historyItem.id === id)

  if (!item?.imagePath || !isPathInside(item.imagePath, getImageToolImagesDir())) {
    return undefined
  }

  try {
    const imageBuffer = await readFile(item.imagePath)
    const detectedMimeType = getMimeTypeFromDetectedType(detectImageType(imageBuffer))
    const mimeType = getImageMimeType(item.outputFormat, item.imagePath, item.imageMimeType ?? detectedMimeType)

    if (!detectedMimeType) {
      return undefined
    }

    return `data:${mimeType};base64,${imageBuffer.toString('base64')}`
  } catch {
    return undefined
  }
}

const savePromptTemplateFromInput = async (
  input: ImageToolPromptTemplateInput,
  previewDataUrlOverride?: string
): Promise<ImageToolPromptTemplate> => {
  const data = await readImageToolData()
  const templateId = input.id ?? createPromptLibraryId('prompt-template')
  const existingTemplate = data.promptTemplates.find((template) => template.id === templateId)
  const nextPreviewDataUrl = previewDataUrlOverride ?? input.previewImageDataUrl
  let previewAssetId = existingTemplate?.previewAssetId

  if (input.removePreview || nextPreviewDataUrl) {
    await removePromptTemplatePreviewAsset(existingTemplate?.previewAssetId)
    previewAssetId = nextPreviewDataUrl
      ? await savePromptTemplatePreviewAsset(nextPreviewDataUrl, templateId)
      : undefined
  }

  const nextData = await writeImageToolData(
    upsertPromptTemplate(data, {
      ...input,
      id: templateId,
      categoryId: input.categoryId ?? existingTemplate?.categoryId ?? DEFAULT_PROMPT_TEMPLATE_CATEGORY_ID,
      previewAssetId,
      source: input.source ?? existingTemplate?.source ?? 'user'
    })
  )
  const savedTemplate = nextData.promptTemplates.find((template) => template.id === templateId)

  if (!savedTemplate) {
    throw new ImageToolMainError('save_prompt_template_failed', 'Failed to save prompt template.')
  }

  return toPublicPromptTemplate(savedTemplate)
}

const importPromptTemplateRecords = async (
  records: readonly PromptTemplateImportRecord[],
  fileName?: string,
  sourceDir?: string
): Promise<ImageToolPromptTemplateImportResult> => {
  let data = await readImageToolData()
  const errors: ImageToolPromptTemplateImportResult['errors'] = []
  let imported = 0
  let skipped = 0
  let updated = 0
  const knownTemplatesByFingerprint = new Map<string, PromptTemplate>()

  for (const template of data.promptTemplates) {
    knownTemplatesByFingerprint.set(
      createTemplateFingerprint(template, await readPromptTemplatePreview(template)),
      template
    )
    knownTemplatesByFingerprint.set(createTemplateFingerprint(template, undefined), template)
  }

  for (const record of records) {
    try {
      const previewDataUrl = record.previewImage?.dataUrl
      const fingerprint = createTemplateFingerprint(record, previewDataUrl)
      const existingTemplate =
        knownTemplatesByFingerprint.get(fingerprint) ??
        knownTemplatesByFingerprint.get(createTemplateFingerprint(record, undefined))

      if (existingTemplate) {
        if (!existingTemplate.previewAssetId) {
          const previewAssetId = await savePromptTemplatePreviewAssetForRecord(
            record,
            existingTemplate.id,
            fileName,
            sourceDir
          )

          if (previewAssetId) {
            data = upsertPromptTemplate(data, {
              ...existingTemplate,
              previewAssetId
            })
            const updatedTemplate = data.promptTemplates.find((template) => template.id === existingTemplate.id)

            if (updatedTemplate) {
              knownTemplatesByFingerprint.set(fingerprint, updatedTemplate)
              knownTemplatesByFingerprint.set(createTemplateFingerprint(updatedTemplate, undefined), updatedTemplate)
            }

            updated += 1
          }
        }

        skipped += 1
        continue
      }

      const categoryResult = ensurePromptTemplateCategoryPath(data, record.categoryPath)
      const templateId = createPromptLibraryId('prompt-template')
      const previewAssetId = await savePromptTemplatePreviewAssetForRecord(record, templateId, fileName, sourceDir)

      data = upsertPromptTemplate(categoryResult.data, {
        id: templateId,
        categoryId: categoryResult.categoryId,
        title: record.title,
        ...(record.description ? { description: record.description } : {}),
        templateType: record.templateType,
        prompt: record.prompt,
        ...(record.variables ? { variables: record.variables } : {}),
        ...(record.tags ? { tags: record.tags } : {}),
        ...(record.recommendedParams ? { recommendedParams: record.recommendedParams } : {}),
        ...(previewAssetId ? { previewAssetId } : {}),
        ...(typeof record.isFavorite === 'boolean' ? { isFavorite: record.isFavorite } : {}),
        source: 'imported'
      })
      const importedTemplate = data.promptTemplates.find((template) => template.id === templateId)

      if (importedTemplate) {
        knownTemplatesByFingerprint.set(fingerprint, importedTemplate)
        knownTemplatesByFingerprint.set(createTemplateFingerprint(importedTemplate, undefined), importedTemplate)
      }

      imported += 1
    } catch (error) {
      errors.push({
        fileName,
        reason: error instanceof Error ? error.message : 'Failed to import prompt template.'
      })
    }
  }

  await writeImageToolData(data)

  return {
    imported,
    skipped,
    updated,
    errors
  }
}

const importPromptTemplateFileAtPath = async (filePath: string): Promise<ImageToolPromptTemplateImportResult> => {
  const fileName = basename(filePath)

  if (!isAbsolute(filePath) || !isPromptTemplateImportFile(fileName)) {
    return {
      imported: 0,
      skipped: 0,
      updated: 0,
      errors: [{ fileName, reason: 'Unsupported prompt template file.' }]
    }
  }

  try {
    const rawDocument = await readFile(filePath, 'utf8')
    const parsedDocument = parsePromptTemplateImportDocument(JSON.parse(rawDocument))
    return importPromptTemplateRecords(parsedDocument.templates, fileName, dirname(filePath))
  } catch (error) {
    return {
      imported: 0,
      skipped: 0,
      updated: 0,
      errors: [
        {
          fileName,
          reason: error instanceof Error ? error.message : 'Failed to import prompt template file.'
        }
      ]
    }
  }
}

const importPromptTemplateFileContent = async (
  fileNameInput: string,
  rawDocument: string
): Promise<ImageToolPromptTemplateImportResult> => {
  const fileName = basename(fileNameInput)

  if (!isPromptTemplateImportFile(fileName)) {
    return {
      imported: 0,
      skipped: 0,
      updated: 0,
      errors: [{ fileName, reason: 'Unsupported prompt template file.' }]
    }
  }

  try {
    const parsedDocument = parsePromptTemplateImportDocument(JSON.parse(rawDocument))
    return importPromptTemplateRecords(parsedDocument.templates, fileName)
  } catch (error) {
    return {
      imported: 0,
      skipped: 0,
      updated: 0,
      errors: [
        {
          fileName,
          reason: error instanceof Error ? error.message : 'Failed to import prompt template file.'
        }
      ]
    }
  }
}

const getCategoryAndDescendantIds = (
  categories: readonly PromptTemplateCategory[],
  categoryId: string
): Set<string> => {
  const categoryIds = new Set<string>([categoryId])
  let didFindChild = true

  while (didFindChild) {
    didFindChild = false

    for (const category of categories) {
      if (category.parentId && categoryIds.has(category.parentId) && !categoryIds.has(category.id)) {
        categoryIds.add(category.id)
        didFindChild = true
      }
    }
  }

  return categoryIds
}

const removeHistoryImage = async (imagePath?: string): Promise<void> => {
  if (!imagePath || !isPathInside(imagePath, getImageToolImagesDir())) {
    return
  }

  await rm(imagePath, { force: true })
}

const createHistoryId = (): string => {
  const globalCrypto = globalThis.crypto

  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    return globalCrypto.randomUUID()
  }

  return `history_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

const createImageToolError = (
  code: string,
  message: string,
  details?: Omit<ImageToolGenerateImage2Failure['error'], 'code' | 'message'>
): ImageToolGenerateImage2Failure => {
  return {
    ok: false,
    error: {
      code,
      message,
      ...details
    }
  }
}

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === 'string' && value.trim().length > 0
}

const sanitizeErrorMessage = (message: string, apiKey: string): string => {
  if (!apiKey) {
    return message
  }

  return message.split(apiKey).join('[redacted]')
}

const createTestRequestSummary = (request: ImageToolTestConnectionRequest) => {
  return {
    model: request.model.trim(),
    size: request.size,
    quality: request.quality ?? 'auto',
    outputFormat: request.sendOutputFormat ? (request.outputFormat ?? 'not_sent') : 'not_sent',
    responseFormat: request.sendResponseFormat ? (request.responseFormat ?? 'not_sent') : 'not_sent'
  }
}

const getAdapterOutputFormat = (request: Image2AdapterFormatOptions): ImageToolImage2OutputFormat | undefined => {
  return request.sendOutputFormat ? (request.outputFormat ?? 'png') : undefined
}

const getAdapterResponseFormat = (request: Image2AdapterFormatOptions): ImageToolImage2ResponseFormat | undefined => {
  return request.sendResponseFormat ? request.responseFormat : undefined
}

const emitTaskEvent = (event: ImageToolImageTaskEvent): void => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('image-tool:image-task-event', event)
  }
}

const saveTask = (task: ImageToolImageTask, eventType: TaskEvent['type']): ImageToolImageTask => {
  imageTasks.set(task.id, task)
  emitTaskEvent({
    type: eventType,
    task
  })
  return task
}

const getTaskRecordType = (request: ImageToolGenerateImage2Request | ImageToolEditImage2Request): TaskRecordType => {
  if ('images' in request) {
    return request.editMode === 'masked_edit' || request.mask ? 'image_edit' : 'image_to_image'
  }

  return 'text_to_image'
}

const resolveTaskProviderSnapshot = (
  data: ImageToolData,
  request: ImageToolGenerateImage2Request | ImageToolEditImage2Request
): { providerTemplateId: string; providerTemplateName: string } => {
  const providerTemplateId = request.providerTemplateId ?? data.settings.providerTemplateId
  const providerTemplate = getImageProviderTemplate(providerTemplateId, data.settings.customProviderTemplates)

  return {
    providerTemplateId,
    providerTemplateName: request.providerTemplateName?.trim() || providerTemplate.name
  }
}

const createQueuedTaskUsageRecord = async (
  task: ImageToolImageTask,
  request: ImageToolGenerateImage2Request | ImageToolEditImage2Request
): Promise<void> => {
  try {
    await updateTaskUsageData((data) => {
      const providerSnapshot = resolveTaskProviderSnapshot(data, request)
      const conversation = task.request.conversationId
        ? data.conversations.find((item) => item.id === task.request.conversationId)
        : undefined

      return createTaskRecord(data, {
        taskId: task.id,
        providerTemplateId: providerSnapshot.providerTemplateId,
        providerTemplateName: providerSnapshot.providerTemplateName,
        model: task.request.model,
        taskType: getTaskRecordType(request),
        conversationId: task.request.conversationId,
        projectId: request.projectId ?? conversation?.projectId,
        prompt: task.request.prompt,
        requestedImageCount: task.request.n ?? request.n ?? 1,
        size: task.request.size,
        quality: task.request.quality ?? request.quality,
        outputFormat: task.request.outputFormat ?? request.outputFormat,
        createdAt: new Date(task.createdAt).toISOString()
      })
    })
  } catch (error) {
    console.warn('[image-tool] failed to create task usage record', error)
  }
}

const markTaskUsageRunning = async (task: ImageToolImageTask): Promise<void> => {
  try {
    await updateTaskUsageData((data) =>
      updateTaskRecord(data, task.id, {
        status: 'running',
        startedAt: new Date(task.startedAt ?? Date.now()).toISOString(),
        updatedAt: new Date(task.updatedAt).toISOString()
      })
    )
  } catch (error) {
    console.warn('[image-tool] failed to mark task usage running', error)
  }
}

const markTaskUsageSucceeded = async (task: ImageToolImageTask, successfulImageCount?: number): Promise<void> => {
  try {
    await updateTaskUsageData((data) =>
      updateTaskRecord(data, task.id, {
        status: 'succeeded',
        successfulImageCount: successfulImageCount ?? task.result?.images.length ?? 0,
        completedAt: new Date(task.finishedAt ?? Date.now()).toISOString(),
        updatedAt: new Date(task.updatedAt).toISOString()
      })
    )
  } catch (error) {
    console.warn('[image-tool] failed to mark task usage succeeded', error)
  }
}

const markTaskUsageFailed = async (task: ImageToolImageTask): Promise<void> => {
  try {
    await updateTaskUsageData((data) =>
      updateTaskRecord(data, task.id, {
        status: 'failed',
        errorCode: task.error?.code,
        errorMessage: task.error?.message,
        completedAt: new Date(task.finishedAt ?? Date.now()).toISOString(),
        updatedAt: new Date(task.updatedAt).toISOString()
      })
    )
  } catch (error) {
    console.warn('[image-tool] failed to mark task usage failed', error)
  }
}

const toTaskError = (error: unknown, apiKey: string): TaskError => {
  if (error instanceof Image2AdapterError) {
    return {
      code: error.code,
      message: sanitizeErrorMessage(error.message, apiKey),
      status: error.status,
      upstreamType: error.upstreamType,
      upstreamCode: error.upstreamCode,
      endpoint: error.endpoint,
      requestSummary: error.requestSummary as Record<string, unknown> | undefined
    }
  }

  if (error instanceof ImageToolMainError) {
    return {
      code: error.code,
      message: sanitizeErrorMessage(error.message, apiKey),
      status: error.status,
      requestSummary: error.requestSummary
    }
  }

  return {
    code: 'image2_generation_failed',
    message: error instanceof Error ? sanitizeErrorMessage(error.message, apiKey) : 'Image2 generation failed.'
  }
}

const toPublicHistoryItem = (item: ImageHistoryItem): ImageToolHistoryItem => {
  return {
    id: item.id,
    conversationId: item.conversationId,
    taskId: item.taskId,
    ...(item.mode ? { mode: item.mode } : {}),
    prompt: item.prompt,
    model: item.model,
    size: item.size,
    ...(item.quality ? { quality: item.quality } : {}),
    ...(item.outputFormat ? { outputFormat: item.outputFormat } : {}),
    ...(item.imageDataUrl ? { imageDataUrl: item.imageDataUrl } : {}),
    ...(item.imageMimeType ? { imageMimeType: item.imageMimeType } : {}),
    ...(item.imageFileName ? { imageFileName: item.imageFileName } : {}),
    ...(item.referenceImages ? { referenceImages: item.referenceImages } : {}),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    ...(item.error ? { error: item.error } : {})
  }
}

const materializeGeneratedImage = async ({
  image,
  createdAt,
  taskId,
  model,
  size,
  outputFormat
}: {
  image: ImageToolGeneratedImage | undefined
  createdAt: number
  taskId: string
  model: string
  size: string
  outputFormat?: string
}): Promise<MaterializedImage> => {
  const { buffer, mimeType: payloadMimeType } = await readImagePayload(image)
  const detectedType = detectImageType(buffer)
  const detectedMimeType = getMimeTypeFromDetectedType(detectedType)

  if (!detectedMimeType) {
    throw new ImageToolMainError('invalid_image_payload', 'Generated image payload is not a valid JPEG, PNG, or WEBP.')
  }

  const imageMimeType = getImageMimeType(outputFormat, undefined, detectedMimeType ?? payloadMimeType)
  const { imagePath, imageFileName } = await saveImageBuffer({
    buffer,
    createdAt,
    taskId,
    model,
    size,
    outputFormat: getImageFileExtension(outputFormat, imageMimeType),
    mimeType: imageMimeType
  })
  const previewDataUrl = `data:${imageMimeType};base64,${buffer.toString('base64')}`

  return {
    image: {
      ...image,
      previewDataUrl
    },
    imagePath,
    imageFileName,
    imageMimeType,
    previewDataUrl
  }
}

const persistSucceededTaskHistory = async ({
  mode = 'image_generation',
  referenceImages,
  task,
  result,
  request
}: {
  mode?: 'image_generation' | 'image_reference' | 'image_edit'
  referenceImages?: Array<{
    name: string
    mimeType: string
    size: number
  }>
  task: ImageToolImageTask
  result: ImageToolImageGenerationResult
  request: ImageToolGenerateImage2Request | ImageToolEditImage2Request
}): Promise<void> => {
  const now = Date.now()
  const historyId = result.historyId ?? createHistoryId()
  const data = await readImageToolData()
  const writable = resolveWritableConversationData(data, request.conversationId ?? task.request.conversationId)

  await writeImageToolData(
    addImageHistoryItem(writable.data, {
      id: historyId,
      conversationId: writable.conversationId,
      taskId: task.id,
      mode,
      prompt: task.request.prompt,
      model: task.request.model,
      size: task.request.size,
      quality: task.request.quality ?? request.quality,
      outputFormat: result.request.outputFormat ?? request.outputFormat ?? 'png',
      ...(result.imageFileName ? { imagePath: join(getImageToolImagesDir(), result.imageFileName) } : {}),
      ...(result.imageMimeType ? { imageMimeType: result.imageMimeType } : {}),
      ...(result.imageFileName ? { imageFileName: result.imageFileName } : {}),
      ...(referenceImages && referenceImages.length > 0 ? { referenceImages } : {}),
      createdAt: task.finishedAt ?? now,
      updatedAt: task.finishedAt ?? now
    })
  )
}

const executeImageTask = async (taskId: string, request: ImageToolGenerateImage2Request): Promise<void> => {
  const queuedTask = imageTasks.get(taskId)

  if (!queuedTask) {
    return
  }

  const runningTask = saveTask(markTaskRunning(queuedTask), 'updated')
  await markTaskUsageRunning(runningTask)

  try {
    const result = await generateImageWithImage2({
      provider: {
        baseUrl: request.baseUrl.trim(),
        apiKey: request.apiKey,
        endpointPath: request.endpointPath
      },
      model: request.model.trim(),
      prompt: request.prompt.trim(),
      size: request.size,
      quality: request.quality ?? 'auto',
      outputFormat: getAdapterOutputFormat(request),
      responseFormat: getAdapterResponseFormat(request)
    })
    const historyId = createHistoryId()
    const createdAt = Date.now()
    const materializedImage = await materializeGeneratedImage({
      image: result.images[0],
      createdAt,
      taskId: runningTask.id,
      model: result.request.model,
      size: result.request.size,
      outputFormat: result.request.outputFormat ?? request.outputFormat ?? 'png'
    })
    const taskResult: ImageToolImageGenerationResult = {
      images: [
        {
          ...result.images[0],
          previewDataUrl: materializedImage.previewDataUrl
        }
      ],
      request: result.request,
      historyId,
      previewDataUrl: materializedImage.previewDataUrl,
      imageMimeType: materializedImage.imageMimeType,
      imageFileName: materializedImage.imageFileName
    }
    const succeededTask: ImageToolImageTask = {
      ...markTaskSucceeded(runningTask, taskResult),
      result: taskResult
    }

    await persistSucceededTaskHistory({
      task: succeededTask,
      result: taskResult,
      request
    })
    await markTaskUsageSucceeded(succeededTask)
    saveTask(succeededTask, 'succeeded')
  } catch (error) {
    const failedTask = markTaskFailed(runningTask, toTaskError(error, request.apiKey))
    await markTaskUsageFailed(failedTask)
    saveTask(failedTask, 'failed')
  }
}

const executeImageEditTask = async (taskId: string, request: ImageToolEditImage2Request): Promise<void> => {
  const queuedTask = imageTasks.get(taskId)

  if (!queuedTask) {
    return
  }

  const runningTask = saveTask(markTaskRunning(queuedTask), 'updated')
  await markTaskUsageRunning(runningTask)

  try {
    const referenceImages = materializeReferenceImages(request.images)
    const mask = materializeMaskImage(request.mask)
    const endpoint = createImage2EditEndpoint(request.baseUrl, request.editEndpointPath)
    const requestSummary = createImageEditSafetySummary({
      endpoint,
      images: referenceImages,
      mask,
      request
    })

    ensureMaskMatchesSourceImage(referenceImages[0], mask, requestSummary)
    const result = await generateImageEditWithImage2({
      provider: {
        baseUrl: request.baseUrl.trim(),
        apiKey: request.apiKey
      },
      endpointPath: request.editEndpointPath,
      model: request.model.trim(),
      prompt: request.prompt.trim(),
      images: referenceImages.map((image) => ({
        name: image.name,
        mimeType: image.mimeType,
        buffer: image.buffer
      })),
      ...(mask
        ? {
            mask: {
              name: mask.name,
              mimeType: mask.mimeType,
              buffer: mask.buffer
            }
          }
        : {}),
      size: request.size,
      quality: request.quality ?? 'auto',
      n: request.n ?? 1,
      outputFormat: getAdapterOutputFormat(request),
      responseFormat: getAdapterResponseFormat(request),
      sendOutputFormat: request.sendOutputFormat,
      sendResponseFormat: request.sendResponseFormat,
      editSubmitMode: request.editSubmitMode,
      maskSemantic: request.maskSemantic,
      maskColorMode: request.maskColorMode,
      originalImageWidth: request.originalImageWidth,
      originalImageHeight: request.originalImageHeight,
      submittedImageWidth: request.submittedImageWidth,
      submittedImageHeight: request.submittedImageHeight,
      submittedMaskWidth: request.submittedMaskWidth,
      submittedMaskHeight: request.submittedMaskHeight
    })
    const historyId = createHistoryId()
    const createdAt = Date.now()
    const materializedImage = await materializeGeneratedImage({
      image: result.images[0],
      createdAt,
      taskId: runningTask.id,
      model: result.request.model,
      size: result.request.size,
      outputFormat: result.request.outputFormat ?? request.outputFormat ?? 'png'
    })
    const taskResult: ImageToolImageGenerationResult = {
      images: [
        {
          ...result.images[0],
          previewDataUrl: materializedImage.previewDataUrl
        }
      ],
      request: result.request,
      historyId,
      previewDataUrl: materializedImage.previewDataUrl,
      imageMimeType: materializedImage.imageMimeType,
      imageFileName: materializedImage.imageFileName,
      requestSummary: result.requestSummary ?? requestSummary
    }
    const succeededTask: ImageToolImageTask = {
      ...markTaskSucceeded(runningTask, taskResult),
      result: taskResult
    }

    await persistSucceededTaskHistory({
      mode: mask ? 'image_edit' : 'image_reference',
      referenceImages: referenceImages.map((image) => ({
        name: image.name,
        mimeType: image.mimeType,
        size: image.size,
        ...(image.width !== undefined ? { width: image.width } : {}),
        ...(image.height !== undefined ? { height: image.height } : {})
      })),
      task: succeededTask,
      result: taskResult,
      request
    })
    await markTaskUsageSucceeded(succeededTask)
    saveTask(succeededTask, 'succeeded')
  } catch (error) {
    const failedTask = markTaskFailed(runningTask, toTaskError(error, request.apiKey))
    await markTaskUsageFailed(failedTask)
    saveTask(failedTask, 'failed')
  }
}

const registerImageToolIpc = (): void => {
  ipcMain.handle(
    'image-tool:generate-image2',
    async (_event, request: ImageToolGenerateImage2Request): Promise<ImageToolGenerateImage2Result> => {
      if (!request || typeof request !== 'object') {
        return createImageToolError('invalid_request', 'Image2 request is required.')
      }

      if (!isNonEmptyString(request.baseUrl)) {
        return createImageToolError('missing_base_url', 'Base URL is required.')
      }

      if (!isNonEmptyString(request.apiKey)) {
        return createImageToolError('missing_api_key', 'API key is required.')
      }

      if (!isNonEmptyString(request.model)) {
        return createImageToolError('missing_model', 'Model is required.')
      }

      if (!isNonEmptyString(request.prompt)) {
        return createImageToolError('missing_prompt', 'Prompt is required.')
      }

      if (!isNonEmptyString(request.size)) {
        return createImageToolError('missing_size', 'Resolved image size is required.')
      }

      const task = createImageGenerationTask(request)
      await createQueuedTaskUsageRecord(task, request)
      const runningTask = markTaskRunning(task)
      await markTaskUsageRunning(runningTask)

      try {
        const result = await generateImageWithImage2({
          provider: {
            baseUrl: request.baseUrl.trim(),
            apiKey: request.apiKey,
            endpointPath: request.endpointPath
          },
          model: request.model.trim(),
          prompt: request.prompt.trim(),
          size: request.size,
          quality: request.quality ?? 'auto',
          outputFormat: getAdapterOutputFormat(request),
          responseFormat: getAdapterResponseFormat(request)
        })
        const historyId = createHistoryId()
        const createdAt = Date.now()
        const materializedImage = await materializeGeneratedImage({
          image: result.images[0],
          createdAt,
          taskId: historyId,
          model: result.request.model,
          size: result.request.size,
          outputFormat: result.request.outputFormat ?? request.outputFormat ?? 'png'
        })
        const data = await readImageToolData()
        const writable = resolveWritableConversationData(data, request.conversationId)

        await writeImageToolData(
          addImageHistoryItem(writable.data, {
            id: historyId,
            conversationId: writable.conversationId,
            taskId: historyId,
            mode: 'image_generation',
            prompt: request.prompt.trim(),
            model: result.request.model,
            size: result.request.size,
            quality: result.request.quality ?? request.quality,
            outputFormat: result.request.outputFormat ?? request.outputFormat ?? 'png',
            ...(materializedImage.imageFileName
              ? { imagePath: join(getImageToolImagesDir(), materializedImage.imageFileName) }
              : {}),
            imageMimeType: materializedImage.imageMimeType,
            imageFileName: materializedImage.imageFileName,
            createdAt,
            updatedAt: createdAt
          })
        )

        const taskResult: ImageToolImageGenerationResult = {
          images: [
            {
              ...result.images[0],
              previewDataUrl: materializedImage.previewDataUrl
            }
          ],
          request: result.request,
          historyId,
          previewDataUrl: materializedImage.previewDataUrl,
          imageMimeType: materializedImage.imageMimeType,
          imageFileName: materializedImage.imageFileName
        }
        const succeededTask: ImageToolImageTask = {
          ...markTaskSucceeded(runningTask, taskResult),
          result: taskResult
        }

        await markTaskUsageSucceeded(succeededTask, result.images.length)

        return {
          ok: true,
          images: [
            {
              ...result.images[0],
              previewDataUrl: materializedImage.previewDataUrl
            }
          ],
          request: result.request,
          historyId,
          previewDataUrl: materializedImage.previewDataUrl,
          imageMimeType: materializedImage.imageMimeType,
          imageFileName: materializedImage.imageFileName
        }
      } catch (error) {
        if (error instanceof Image2AdapterError) {
          await markTaskUsageFailed(markTaskFailed(runningTask, toTaskError(error, request.apiKey)))
          return createImageToolError(error.code, sanitizeErrorMessage(error.message, request.apiKey), {
            status: error.status,
            upstreamType: error.upstreamType,
            upstreamCode: error.upstreamCode,
            endpoint: error.endpoint,
            requestSummary: error.requestSummary as Record<string, unknown> | undefined
          })
        }

        if (error instanceof ImageToolMainError) {
          await markTaskUsageFailed(markTaskFailed(runningTask, toTaskError(error, request.apiKey)))
          return createImageToolError(error.code, sanitizeErrorMessage(error.message, request.apiKey), {
            status: error.status
          })
        }

        await markTaskUsageFailed(markTaskFailed(runningTask, toTaskError(error, request.apiKey)))
        return createImageToolError(
          'image2_generation_failed',
          error instanceof Error ? sanitizeErrorMessage(error.message, request.apiKey) : 'Image2 generation failed.'
        )
      }
    }
  )

  ipcMain.handle(
    'image-tool:test-image2-connection',
    async (_event, request: ImageToolTestConnectionRequest): Promise<ImageToolTestConnectionResult> => {
      if (!request || typeof request !== 'object') {
        return {
          ok: false,
          status: 'failed',
          code: 'invalid_request',
          message: 'Image2 test request is required.'
        }
      }

      if (!isNonEmptyString(request.baseUrl)) {
        return {
          ok: false,
          status: 'failed',
          code: 'missing_base_url',
          message: 'Base URL is required.'
        }
      }

      const endpoint = createImage2Endpoint(request.baseUrl, request.endpointPath)
      const requestSummary = createTestRequestSummary(request)

      if (!isNonEmptyString(request.apiKey)) {
        return {
          ok: false,
          status: 'failed',
          endpoint,
          code: 'missing_api_key',
          message: 'API key is required.',
          requestSummary
        }
      }

      if (!isNonEmptyString(request.model)) {
        return {
          ok: false,
          status: 'failed',
          endpoint,
          code: 'missing_model',
          message: 'Model is required.',
          requestSummary
        }
      }

      if (!isNonEmptyString(request.size)) {
        return {
          ok: false,
          status: 'failed',
          endpoint,
          code: 'missing_size',
          message: 'Resolved image size is required.',
          requestSummary
        }
      }

      try {
        const result = await generateImageWithImage2({
          provider: {
            baseUrl: request.baseUrl.trim(),
            apiKey: request.apiKey,
            endpointPath: request.endpointPath
          },
          model: request.model.trim(),
          prompt: 'test image',
          size: request.size,
          quality: request.quality ?? 'auto',
          outputFormat: getAdapterOutputFormat(request),
          responseFormat: getAdapterResponseFormat(request)
        })
        const firstImage = result.images[0]

        return {
          ok: true,
          status: 'success',
          endpoint,
          model: result.request.model,
          size: result.request.size,
          hasUrl: Boolean(firstImage?.url),
          hasB64Json: Boolean(firstImage?.b64Json),
          requestSummary: {
            ...requestSummary,
            outputFormat: result.request.outputFormat ?? requestSummary.outputFormat,
            responseFormat: result.request.responseFormat ?? requestSummary.responseFormat
          }
        }
      } catch (error) {
        if (error instanceof Image2AdapterError) {
          return {
            ok: false,
            status: 'failed',
            endpoint,
            code: error.code,
            message: sanitizeErrorMessage(error.message, request.apiKey),
            httpStatus: error.status,
            upstreamCode: error.upstreamCode,
            upstreamType: error.upstreamType,
            requestSummary: error.requestSummary ?? requestSummary
          }
        }

        return {
          ok: false,
          status: 'failed',
          endpoint,
          code: 'image2_connection_test_failed',
          message:
            error instanceof Error
              ? sanitizeErrorMessage(error.message, request.apiKey)
              : 'Image2 connection test failed.',
          requestSummary
        }
      }
    }
  )

  ipcMain.handle(
    'image-tool:create-image2-task',
    async (_event, request: ImageToolGenerateImage2Request): Promise<ImageToolImageTask> => {
      if (!request || typeof request !== 'object') {
        throw new Error('Image2 request is required.')
      }

      if (!isNonEmptyString(request.baseUrl)) {
        throw new Error('Base URL is required.')
      }

      if (!isNonEmptyString(request.apiKey)) {
        throw new Error('API key is required.')
      }

      if (!isNonEmptyString(request.model)) {
        throw new Error('Model is required.')
      }

      if (!isNonEmptyString(request.prompt)) {
        throw new Error('Prompt is required.')
      }

      if (!isNonEmptyString(request.size)) {
        throw new Error('Resolved image size is required.')
      }

      const data = await readImageToolData()
      const writable = resolveWritableConversationData(data, request.conversationId)
      if (writable.data !== data) {
        await writeImageToolData(writable.data)
      }
      const executionRequest: ImageToolGenerateImage2Request = {
        ...request,
        conversationId: writable.conversationId,
        baseUrl: request.baseUrl.trim(),
        endpointPath: normalizeEndpointPath(request.endpointPath),
        model: request.model.trim(),
        prompt: request.prompt.trim(),
        sendOutputFormat: Boolean(request.sendOutputFormat),
        sendResponseFormat: Boolean(request.sendResponseFormat)
      }

      const task = createImageGenerationTask(executionRequest)
      saveTask(task, 'created')
      await createQueuedTaskUsageRecord(task, executionRequest)
      void executeImageTask(task.id, executionRequest)
      return task
    }
  )

  ipcMain.handle(
    'image-tool:create-image-edit-task',
    async (_event, request: ImageToolEditImage2Request): Promise<ImageToolImageTask> => {
      if (!request || typeof request !== 'object') {
        throw new Error('Image edit request is required.')
      }

      if (!isNonEmptyString(request.baseUrl)) {
        throw new Error('Base URL is required.')
      }

      if (!isNonEmptyString(request.apiKey)) {
        throw new Error('API key is required.')
      }

      if (!isNonEmptyString(request.model)) {
        throw new Error('Model is required.')
      }

      if (!isNonEmptyString(request.prompt)) {
        throw new Error('Prompt is required.')
      }

      if (!isNonEmptyString(request.size)) {
        throw new Error('Resolved image size is required.')
      }

      if (!Array.isArray(request.images) || request.images.length === 0) {
        throw new Error('Image edit mode requires at least one reference image.')
      }

      if (request.images.length > 15) {
        throw new Error('Image edit mode supports at most 15 reference images.')
      }

      const data = await readImageToolData()
      const writable = resolveWritableConversationData(data, request.conversationId)
      if (writable.data !== data) {
        await writeImageToolData(writable.data)
      }
      const executionRequest: ImageToolEditImage2Request = {
        ...request,
        conversationId: writable.conversationId,
        baseUrl: request.baseUrl.trim(),
        endpointPath: normalizeEndpointPath(request.endpointPath),
        editEndpointPath: normalizeEditEndpointPath(request.editEndpointPath),
        model: request.model.trim(),
        prompt: request.prompt.trim(),
        sendOutputFormat: Boolean(request.sendOutputFormat),
        sendResponseFormat: Boolean(request.sendResponseFormat),
        n: request.n ?? 1
      }
      const referenceImages = materializeReferenceImages(executionRequest.images)
      const mask = materializeMaskImage(executionRequest.mask)
      const requestSummary = createImageEditSafetySummary({
        endpoint: createImage2EditEndpoint(executionRequest.baseUrl, executionRequest.editEndpointPath),
        images: referenceImages,
        mask,
        request: executionRequest
      })

      ensureMaskMatchesSourceImage(referenceImages[0], mask, requestSummary)
      const task = createImageEditTask({
        ...executionRequest,
        editMode: mask ? 'masked_edit' : 'reference',
        images: referenceImages.map((image) => ({
          name: image.name,
          mimeType: image.mimeType,
          size: image.size,
          ...(image.width !== undefined ? { width: image.width } : {}),
          ...(image.height !== undefined ? { height: image.height } : {})
        })),
        ...(mask
          ? {
              mask: {
                name: mask.name,
                mimeType: mask.mimeType,
                size: mask.size,
                ...(mask.width !== undefined ? { width: mask.width } : {}),
                ...(mask.height !== undefined ? { height: mask.height } : {})
              }
            }
          : {})
      })

      saveTask(task, 'created')
      await createQueuedTaskUsageRecord(task, executionRequest)
      void executeImageEditTask(task.id, executionRequest)
      return task
    }
  )

  ipcMain.handle('image-tool:get-image-task', (_event, taskId: string): ImageToolImageTask | undefined => {
    return imageTasks.get(taskId)
  })

  ipcMain.handle('image-tool:list-image-tasks', (): ImageToolImageTask[] => {
    return Array.from(imageTasks.values())
  })

  ipcMain.handle(
    'image-tool:list-task-usage',
    async (_event, filters?: TaskRecordFilters): Promise<ImageToolTaskUsageSnapshot> => {
      const data = await readImageToolData()
      return toUsageSnapshot(data, filters)
    }
  )

  ipcMain.handle(
    'image-tool:save-usage-price-settings',
    async (_event, settings: ImageToolUsagePriceSettings): Promise<ImageToolSettings> => {
      const data = await readImageToolData()
      const sanitizedData = sanitizeImageToolData({
        ...data,
        settings: {
          ...data.settings,
          defaultUnitPrice: settings.defaultUnitPrice,
          currency: settings.currency,
          providerUnitPrices: settings.providerUnitPrices
        }
      })

      await writeImageToolData(sanitizedData)
      return sanitizedData.settings
    }
  )

  ipcMain.handle('image-tool:clear-task-usage', async (): Promise<ImageToolTaskUsageSnapshot> => {
    const nextData = await writeImageToolData(clearTaskRecords(await readImageToolData()))
    return toUsageSnapshot(nextData)
  })

  ipcMain.handle(
    'image-tool:export-task-usage-csv',
    async (_event, filters?: TaskRecordFilters): Promise<ImageToolPromptTemplateExportResult> => {
      await ensureImageToolDataDir()
      const data = await readImageToolData()
      const timestamp = new Date()
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}Z$/, 'Z')
      const fileName = `task-usage-${timestamp}.csv`
      const filePath = ensureUniqueFilePath(getPromptLibraryExportsDir(), fileName)

      await writeFile(filePath, `${createTaskUsageCsv(data, filters ?? {})}\n`, 'utf8')

      return {
        filePath,
        fileName: basename(filePath)
      }
    }
  )

  ipcMain.handle('image-tool:get-session-state', async (): Promise<ImageToolSessionState> => {
    const data = await writeImageToolData(await readImageToolData())
    return toSessionState(data)
  })

  ipcMain.handle(
    'image-tool:create-conversation',
    async (_event, projectId?: string | null): Promise<ImageToolSessionState> => {
      const data = await readImageToolData()
      const nextData = await writeImageToolData(createConversation(data, { projectId }))
      return toSessionState(nextData)
    }
  )

  ipcMain.handle(
    'image-tool:set-active-conversation',
    async (_event, conversationId: string): Promise<ImageToolSessionState> => {
      const data = await readImageToolData()
      const nextData = await writeImageToolData(setActiveConversation(data, conversationId))
      return toSessionState(nextData)
    }
  )

  ipcMain.handle(
    'image-tool:rename-conversation',
    async (_event, conversationId: string, title: string): Promise<ImageToolSessionState> => {
      const data = await readImageToolData()
      const nextData = await writeImageToolData(renameConversation(data, conversationId, title))
      return toSessionState(nextData)
    }
  )

  ipcMain.handle(
    'image-tool:move-conversation-to-project',
    async (_event, conversationId: string, projectId: string | null): Promise<ImageToolSessionState> => {
      const data = await readImageToolData()
      const nextData = await writeImageToolData(moveConversationToProject(data, conversationId, projectId))
      return toSessionState(nextData)
    }
  )

  ipcMain.handle(
    'image-tool:delete-conversation',
    async (_event, conversationId: string): Promise<ImageToolSessionState> => {
      const data = await readImageToolData()
      const nextData = await writeImageToolData(moveConversationToTrash(data, conversationId))
      return toSessionState(nextData)
    }
  )

  ipcMain.handle(
    'image-tool:restore-conversation',
    async (_event, conversationId: string): Promise<ImageToolSessionState> => {
      const data = await readImageToolData()
      const nextData = await writeImageToolData(restoreConversation(data, conversationId))
      return toSessionState(nextData)
    }
  )

  ipcMain.handle(
    'image-tool:permanently-delete-conversation',
    async (_event, conversationId: string): Promise<ImageToolSessionState> => {
      const data = await readImageToolData()
      const imagePaths = data.history
        .filter((item) => item.conversationId === conversationId)
        .map((item) => item.imagePath)

      const nextData = await writeImageToolData(permanentlyDeleteConversation(data, conversationId))

      for (const imagePath of imagePaths) {
        await removeHistoryImage(imagePath)
      }

      return toSessionState(nextData)
    }
  )

  ipcMain.handle('image-tool:create-project', async (_event, name: string): Promise<ImageToolSessionState> => {
    const data = await readImageToolData()
    const nextData = await writeImageToolData(createProjectGroup(data, name))
    return toSessionState(nextData)
  })

  ipcMain.handle(
    'image-tool:rename-project',
    async (_event, projectId: string, name: string): Promise<ImageToolSessionState> => {
      const data = await readImageToolData()
      const nextData = await writeImageToolData(renameProjectGroup(data, projectId, name))
      return toSessionState(nextData)
    }
  )

  ipcMain.handle('image-tool:delete-project', async (_event, projectId: string): Promise<ImageToolSessionState> => {
    const data = await readImageToolData()
    const nextData = await writeImageToolData(removeProjectGroup(data, projectId))
    return toSessionState(nextData)
  })

  ipcMain.handle('image-tool:get-settings', async (): Promise<ImageToolSettings> => {
    const data = await readImageToolData()
    return data.settings
  })

  ipcMain.handle(
    'image-tool:save-settings',
    async (_event, settings: ImageToolSettings): Promise<ImageToolSettings> => {
      const data = await readImageToolData()
      const settingsRecord = { ...settings } as Record<string, unknown>
      delete settingsRecord.apiKey
      const sanitizedData = sanitizeImageToolData({
        ...data,
        settings: {
          ...createDefaultImageToolSettings(),
          ...settingsRecord,
          saveApiKey: Boolean(settings?.saveApiKey)
        }
      })

      await writeImageToolData(sanitizedData)
      return sanitizedData.settings
    }
  )

  ipcMain.handle(
    'image-tool:list-history',
    async (_event, conversationId?: string): Promise<ImageToolHistoryItem[]> => {
      const data = await readImageToolData()
      const history = conversationId
        ? data.history.filter((item) => item.conversationId === conversationId)
        : data.history

      return history.map(toPublicHistoryItem)
    }
  )

  ipcMain.handle('image-tool:delete-history-item', async (_event, id: string): Promise<void> => {
    const data = await readImageToolData()
    const item = data.history.find((historyItem) => historyItem.id === id)

    await removeHistoryImage(item?.imagePath)
    await writeImageToolData(removeImageHistoryItem(data, id))
  })

  ipcMain.handle('image-tool:read-history-image', async (_event, id: string): Promise<string | undefined> => {
    const data = await readImageToolData()
    return readHistoryImageDataUrl(data, id)
  })

  ipcMain.handle('image-tool:list-prompt-templates', async (): Promise<ImageToolPromptTemplate[]> => {
    const data = await readImageToolData()
    return Promise.all(data.promptTemplates.map((template) => toPublicPromptTemplate(template)))
  })

  ipcMain.handle('image-tool:save-prompt-template', async (_event, input: ImageToolPromptTemplateInput) => {
    return savePromptTemplateFromInput(input)
  })

  ipcMain.handle('image-tool:delete-prompt-template', async (_event, templateId: string): Promise<void> => {
    const data = await readImageToolData()
    const template = data.promptTemplates.find((item) => item.id === templateId)

    await removePromptTemplatePreviewAsset(template?.previewAssetId)
    await writeImageToolData(removePromptTemplate(data, templateId))
  })

  ipcMain.handle('image-tool:delete-prompt-templates', async (_event, templateIds: string[]): Promise<number> => {
    const data = await readImageToolData()
    const templateIdsToDelete = new Set(templateIds.filter((templateId) => typeof templateId === 'string'))
    const templatesToDelete = data.promptTemplates.filter((template) => templateIdsToDelete.has(template.id))

    await Promise.all(templatesToDelete.map((template) => removePromptTemplatePreviewAsset(template.previewAssetId)))
    await writeImageToolData({
      ...data,
      promptTemplates: data.promptTemplates.filter((template) => !templateIdsToDelete.has(template.id))
    })

    return templatesToDelete.length
  })

  ipcMain.handle(
    'image-tool:move-prompt-templates-to-category',
    async (_event, templateIds: string[], categoryId: string | null): Promise<number> => {
      const data = await readImageToolData()
      const templateIdsToMove = new Set(templateIds.filter((templateId) => typeof templateId === 'string'))
      const targetCategoryId = categoryId || DEFAULT_PROMPT_TEMPLATE_CATEGORY_ID

      if (
        targetCategoryId !== DEFAULT_PROMPT_TEMPLATE_CATEGORY_ID &&
        !data.promptTemplateCategories.some((category) => category.id === targetCategoryId)
      ) {
        throw new ImageToolMainError('prompt_template_category_not_found', 'Prompt template category was not found.')
      }

      const now = new Date().toISOString()
      let movedCount = 0

      await writeImageToolData({
        ...data,
        promptTemplates: data.promptTemplates.map((template) => {
          if (!templateIdsToMove.has(template.id)) {
            return template
          }

          movedCount += 1

          return {
            ...template,
            categoryId: targetCategoryId,
            updatedAt: now
          }
        })
      })

      return movedCount
    }
  )

  ipcMain.handle('image-tool:list-prompt-template-categories', async (): Promise<PromptTemplateCategory[]> => {
    const data = await readImageToolData()
    return data.promptTemplateCategories
  })

  ipcMain.handle(
    'image-tool:save-prompt-template-category',
    async (_event, category: ImageToolPromptTemplateCategoryInput): Promise<PromptTemplateCategory> => {
      const data = await readImageToolData()
      const nextData = await writeImageToolData(upsertPromptTemplateCategory(data, category))
      const savedCategory =
        nextData.promptTemplateCategories.find((item) => item.id === category.id) ??
        nextData.promptTemplateCategories.find((item) => item.name === category.name)

      if (!savedCategory) {
        throw new ImageToolMainError('save_prompt_template_category_failed', 'Failed to save prompt template category.')
      }

      return savedCategory
    }
  )

  ipcMain.handle('image-tool:delete-prompt-template-category', async (_event, categoryId: string): Promise<void> => {
    const data = await readImageToolData()
    await writeImageToolData(removePromptTemplateCategory(data, categoryId))
  })

  ipcMain.handle(
    'image-tool:import-prompt-template-file',
    async (_event, filePath: string): Promise<ImageToolPromptTemplateImportResult> => {
      return importPromptTemplateFileAtPath(filePath)
    }
  )

  ipcMain.handle(
    'image-tool:import-prompt-template-file-content',
    async (_event, fileName: string, rawDocument: string): Promise<ImageToolPromptTemplateImportResult> => {
      return importPromptTemplateFileContent(fileName, rawDocument)
    }
  )

  ipcMain.handle('image-tool:scan-prompt-template-imports', async (): Promise<ImageToolPromptTemplateImportResult> => {
    await ensureImageToolDataDir()

    const fileNames = await readdir(getPromptLibraryImportsDir())
    const importFileNames = fileNames.filter(isPromptTemplateImportFile)
    const totalResult: ImageToolPromptTemplateImportResult = {
      imported: 0,
      skipped: 0,
      updated: 0,
      errors: []
    }

    for (const fileName of importFileNames) {
      const result = await importPromptTemplateFileAtPath(join(getPromptLibraryImportsDir(), fileName))
      totalResult.imported += result.imported
      totalResult.skipped += result.skipped
      totalResult.updated = (totalResult.updated ?? 0) + (result.updated ?? 0)
      totalResult.errors.push(...result.errors)
    }

    return totalResult
  })

  ipcMain.handle(
    'image-tool:export-prompt-template',
    async (_event, templateId: string): Promise<ImageToolPromptTemplateExportResult> => {
      const data = await readImageToolData()
      const template = data.promptTemplates.find((item) => item.id === templateId)

      if (!template) {
        throw new ImageToolMainError('prompt_template_not_found', 'Prompt template was not found.')
      }

      const exportRecord = await toPromptTemplateImportRecord(template, data.promptTemplateCategories)
      return writePromptTemplateExport(
        createExportFileName(template.title, '.image-prompt-template.json'),
        createImagePromptTemplateExport(exportRecord)
      )
    }
  )

  ipcMain.handle(
    'image-tool:export-prompt-templates',
    async (_event, templateIds: string[]): Promise<ImageToolPromptTemplateExportResult> => {
      const data = await readImageToolData()
      const templateIdsToExport = new Set(templateIds.filter((templateId) => typeof templateId === 'string'))
      const templates = await Promise.all(
        data.promptTemplates
          .filter((template) => templateIdsToExport.has(template.id))
          .map((template) => toPromptTemplateImportRecord(template, data.promptTemplateCategories))
      )

      if (templates.length === 0) {
        throw new ImageToolMainError('prompt_template_not_found', 'Prompt template was not found.')
      }

      return writePromptTemplateExport(
        createExportFileName('selected-prompt-templates', '.image-prompt-pack.json'),
        createImagePromptPackExport({
          name: 'Selected prompt templates',
          templates
        })
      )
    }
  )

  ipcMain.handle(
    'image-tool:export-prompt-template-category',
    async (_event, categoryId: string): Promise<ImageToolPromptTemplateExportResult> => {
      const data = await readImageToolData()
      const category = data.promptTemplateCategories.find((item) => item.id === categoryId)

      if (!category) {
        throw new ImageToolMainError('prompt_template_category_not_found', 'Prompt template category was not found.')
      }

      const categoryIds = getCategoryAndDescendantIds(data.promptTemplateCategories, categoryId)
      const templates = await Promise.all(
        data.promptTemplates
          .filter((template) => template.categoryId && categoryIds.has(template.categoryId))
          .map((template) => toPromptTemplateImportRecord(template, data.promptTemplateCategories))
      )

      return writePromptTemplateExport(
        createExportFileName(category.name, '.image-prompt-pack.json'),
        createImagePromptPackExport({
          name: category.name,
          templates
        })
      )
    }
  )

  ipcMain.handle('image-tool:export-all-prompt-templates', async (): Promise<ImageToolPromptTemplateExportResult> => {
    const data = await readImageToolData()
    const templates = await Promise.all(
      data.promptTemplates.map((template) => toPromptTemplateImportRecord(template, data.promptTemplateCategories))
    )

    return writePromptTemplateExport(
      createExportFileName('all-prompt-templates', '.image-prompt-pack.json'),
      createImagePromptPackExport({
        name: 'All prompt templates',
        templates
      })
    )
  })

  ipcMain.handle('image-tool:open-prompt-template-folder', async (): Promise<string> => {
    await ensureImageToolDataDir()
    await shell.openPath(getPromptLibraryDir())
    return getPromptLibraryDir()
  })

  ipcMain.handle(
    'image-tool:save-image-result-as-prompt-template',
    async (_event, input: ImageToolSaveImageResultAsPromptTemplateInput): Promise<ImageToolPromptTemplate> => {
      const data = await readImageToolData()
      const previewDataUrl =
        input.previewImageDataUrl ??
        input.imageDataUrl ??
        (input.historyId ? await readHistoryImageDataUrl(data, input.historyId) : undefined)

      return savePromptTemplateFromInput(input, previewDataUrl)
    }
  )
}

const createWindow = (): void => {
  const preloadPath = join(__dirname, '../preload/index.js')
  const isDev = Boolean(process.env.ELECTRON_RENDERER_URL)
  const windowIconPath = getWindowIconPath()

  console.info(`[image-tool main] preload path: ${preloadPath}`)
  console.info(`[image-tool main] preload exists: ${existsSync(preloadPath)}`)
  console.info(`[image-tool main] is dev: ${isDev}`)

  const mainWindow = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 720,
    minHeight: 480,
    icon: windowIconPath,
    title: WINDOW_TITLE,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.removeMenu()
  mainWindow.setAutoHideMenuBar(true)
  mainWindow.setMenuBarVisibility(false)
  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault()
    mainWindow.setTitle(WINDOW_TITLE)
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
    return
  }

  void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}

void app.whenReady().then(() => {
  registerImageToolIpc()
  Menu.setApplicationMenu(null)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
