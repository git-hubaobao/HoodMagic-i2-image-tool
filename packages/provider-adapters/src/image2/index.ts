import { Buffer } from 'node:buffer'
import { inflateSync } from 'node:zlib'

export type Image2ProviderConfig = {
  baseUrl: string
  apiKey: string
  endpointPath?: string
}

export type Image2GenerateRequest = {
  provider: Image2ProviderConfig
  model: string
  prompt: string
  size: string
  quality?: 'auto' | 'low' | 'medium' | 'high'
  n?: number
  outputFormat?: 'png' | 'jpeg' | 'webp'
  responseFormat?: 'url' | 'b64_json'
}

export type Image2EditImage = {
  name: string
  mimeType: string
  buffer: ArrayBuffer | Uint8Array
}

export type Image2EditSubmitMode = 'original' | 'compatible'

export type Image2EditMaskSemantic = 'transparent-edit' | 'opaque-edit'

export type Image2EditMaskColorMode = 'white' | 'transparent-black' | 'black'

export type Image2EditRequest = {
  provider: Image2ProviderConfig
  endpointPath?: string
  model: string
  prompt: string
  images: Image2EditImage[]
  mask?: Image2EditImage
  size?: string
  quality?: 'auto' | 'low' | 'medium' | 'high'
  n?: number
  outputFormat?: 'png' | 'jpeg' | 'webp'
  responseFormat?: 'url' | 'b64_json'
  sendOutputFormat?: boolean
  sendResponseFormat?: boolean
  editSubmitMode?: Image2EditSubmitMode
  maskSemantic?: Image2EditMaskSemantic
  maskColorMode?: Image2EditMaskColorMode
  originalImageWidth?: number
  originalImageHeight?: number
  submittedImageWidth?: number
  submittedImageHeight?: number
  submittedMaskWidth?: number
  submittedMaskHeight?: number
}

export type Image2GeneratedImage = {
  b64Json?: string
  url?: string
  revisedPrompt?: string
  width?: number
  height?: number
}

export type Image2GenerateResult = {
  images: Image2GeneratedImage[]
  request: {
    model: string
    size: string
    quality?: string
    outputFormat?: string
    responseFormat?: string
    n?: number
  }
  requestSummary?: Image2RequestSummary
  raw?: unknown
}

export type Image2RequestSummary = {
  mode?: 'generation' | 'edit' | 'reference'
  model: string
  size: string
  quality: string
  outputFormat: string
  responseFormat: string
  n?: number
  imageCount?: number
  referenceImageNames?: string[]
  referenceImageTotalBytes?: number
  hasMask?: boolean
  finalEndpoint?: string
  multipartFields?: string[]
  editSubmitMode?: Image2EditSubmitMode
  maskSemantic?: Image2EditMaskSemantic
  maskColorMode?: Image2EditMaskColorMode
  imageBytes?: number
  originalImageWidth?: number
  originalImageHeight?: number
  submittedImageWidth?: number
  submittedImageHeight?: number
  submittedMaskWidth?: number
  submittedMaskHeight?: number
  sourceImageFileName?: string
  sourceImageMimeType?: string
  sourceImageBytes?: number
  sourceImageWidth?: number
  sourceImageHeight?: number
  maskFileName?: string
  maskMimeType?: string
  maskBytes?: number
  maskWidth?: number
  maskHeight?: number
  maskHasTransparentPixel?: boolean
  maskHasOnlyAlpha0And255?: boolean
  otherAlphaCount?: number
}

export type Image2AdapterErrorShape = {
  code: string
  message: string
  status?: number
  upstreamType?: string
  upstreamCode?: string
  endpoint?: string
  requestSummary?: Image2RequestSummary
}

type Image2RequestBody = {
  model: string
  prompt: string
  size: string
  quality: NonNullable<Image2GenerateRequest['quality']>
  n: number
  response_format?: NonNullable<Image2GenerateRequest['responseFormat']>
  output_format?: NonNullable<Image2GenerateRequest['outputFormat']>
}

type Image2ResponseDataItem = {
  b64_json?: unknown
  b64Json?: unknown
  image?: unknown
  base64?: unknown
  content?: unknown
  url?: unknown
  revised_prompt?: unknown
  width?: unknown
  height?: unknown
}

type Image2ResponseBody = {
  data?: Image2ResponseDataItem[] | Image2ResponseDataItem
  error?: {
    type?: string
    code?: string
    message?: string
  }
}

export class Image2AdapterError extends Error implements Image2AdapterErrorShape {
  code: string
  status?: number
  upstreamType?: string
  upstreamCode?: string
  endpoint?: string
  requestSummary?: Image2RequestSummary

  constructor(error: Image2AdapterErrorShape) {
    super(error.message)
    this.name = 'Image2AdapterError'
    this.code = error.code
    this.status = error.status
    this.upstreamType = error.upstreamType
    this.upstreamCode = error.upstreamCode
    this.endpoint = error.endpoint
    this.requestSummary = error.requestSummary
  }
}

const MAX_IMAGE_EDIT_IMAGES = 15
const MAX_IMAGE_EDIT_TOTAL_BYTES = 50 * 1024 * 1024
const MAX_IMAGE_EDIT_MASK_BYTES = 4 * 1024 * 1024

const toBuffer = (buffer: ArrayBuffer | Uint8Array): Buffer => {
  if (buffer instanceof Uint8Array) {
    return Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  }

  return Buffer.from(buffer)
}

const readPngDimensions = (buffer: Buffer): { width: number; height: number } | undefined => {
  if (buffer.length < 24 || buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4e || buffer[3] !== 0x47) {
    return undefined
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  }
}

const readJpegDimensions = (buffer: Buffer): { width: number; height: number } | undefined => {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
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

  if (chunkType === 'VP8X') {
    return {
      width: buffer.readUIntLE(24, 3) + 1,
      height: buffer.readUIntLE(27, 3) + 1
    }
  }

  if (chunkType === 'VP8L' && buffer[20] === 0x2f) {
    const bits = buffer.readUInt32LE(21)

    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1
    }
  }

  if (chunkType === 'VP8 ' && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
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
          return output
      }
    }

    inputOffset += rowLength
  }

  return output
}

const readPngAlphaStats = (buffer: Buffer): { hasTransparentPixel: boolean; otherAlphaCount: number } | undefined => {
  const dimensions = readPngDimensions(buffer)

  if (!dimensions || buffer.length < 33 || buffer[24] !== 8 || buffer[25] !== 6 || buffer[28] !== 0) {
    return undefined
  }

  const idatChunks = readPngChunks(buffer, 'IDAT')

  if (idatChunks.length === 0) {
    return undefined
  }

  const pixels = unfilterPngScanlines(inflateSync(Buffer.concat(idatChunks)), dimensions.width, dimensions.height, 4)
  let hasTransparentPixel = false
  let otherAlphaCount = 0

  for (let index = 3; index < pixels.length; index += 4) {
    const alpha = pixels[index]

    hasTransparentPixel = hasTransparentPixel || alpha === 0

    if (alpha !== 0 && alpha !== 255) {
      otherAlphaCount += 1
    }
  }

  return {
    hasTransparentPixel,
    otherAlphaCount
  }
}

const trimTrailingSlashes = (value: string): string => {
  return value.trim().replace(/\/+$/, '')
}

const normalizeEndpointPath = (endpointPath?: string): string => {
  const normalizedPath = endpointPath?.trim() || '/v1/images/generations'
  return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`
}

const normalizeEditEndpointPath = (endpointPath?: string): string => {
  const normalizedPath = endpointPath?.trim() || '/v1/images/edits'
  return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`
}

const createImage2Endpoint = (baseUrl: string, endpointPath?: string): string => {
  return `${trimTrailingSlashes(baseUrl)}${normalizeEndpointPath(endpointPath)}`
}

const createImage2EditEndpoint = (baseUrl: string, endpointPath?: string): string => {
  return `${trimTrailingSlashes(baseUrl)}${normalizeEditEndpointPath(endpointPath)}`
}

export const isDataUrl = (value: unknown): value is string => {
  return typeof value === 'string' && /^data:image\/[a-z0-9.+-]+;base64,/i.test(value.trim())
}

export const isHttpUrl = (value: unknown): value is string => {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim())
}

const getBase64PayloadPrefix = (value: string): string => {
  const trimmedValue = value.trim()
  const payloadStart = isDataUrl(trimmedValue) ? trimmedValue.indexOf(',') + 1 : 0

  return trimmedValue.slice(payloadStart, payloadStart + 64).replace(/\s/g, '')
}

const decodeBase64Prefix = (value: string): Uint8Array | undefined => {
  const payloadPrefix = getBase64PayloadPrefix(value)

  if (!payloadPrefix || !/^[A-Za-z0-9+/_=-]+$/.test(payloadPrefix)) {
    return undefined
  }

  try {
    const normalizedPayload = payloadPrefix.replace(/-/g, '+').replace(/_/g, '/')
    const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '=')

    return Uint8Array.from(Buffer.from(paddedPayload, 'base64')).slice(0, 16)
  } catch {
    return undefined
  }
}

export const looksLikeBase64Image = (value: unknown): boolean => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return false
  }

  const bytes = decodeBase64Prefix(value)

  if (!bytes || bytes.length < 4) {
    return false
  }

  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  const isWebp =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50

  return isJpeg || isPng || isWebp
}

export const normalizeImagePayload = (value: unknown): Pick<Image2GeneratedImage, 'b64Json' | 'url'> | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmedValue: string = value.trim()

  if (!trimmedValue) {
    return undefined
  }

  if (isHttpUrl(trimmedValue)) {
    return {
      url: trimmedValue
    }
  }

  if (isDataUrl(trimmedValue)) {
    if (!looksLikeBase64Image(trimmedValue)) {
      return undefined
    }

    return {
      b64Json: trimmedValue
    }
  }

  if (looksLikeBase64Image(value)) {
    return {
      b64Json: value.trim().replace(/\s/g, '')
    }
  }

  return undefined
}

const readJsonResponse = async (response: Response): Promise<Image2ResponseBody> => {
  try {
    return (await response.json()) as Image2ResponseBody
  } catch {
    return {}
  }
}

const assertImage2Size = (size: unknown): string => {
  if (typeof size !== 'string' || size.trim().length === 0) {
    throw new Image2AdapterError({
      code: 'invalid_image2_size',
      message: 'Image2 request size must be a non-empty string.'
    })
  }

  return size
}

const assertNonEmptyString = (value: unknown, code: string, message: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Image2AdapterError({
      code,
      message
    })
  }

  return value.trim()
}

const assertEditImageCount = (images: readonly Image2EditImage[]): void => {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Image2AdapterError({
      code: 'missing_image2_edit_image',
      message: 'Image edit request requires at least one image.'
    })
  }

  if (images.length > MAX_IMAGE_EDIT_IMAGES) {
    throw new Image2AdapterError({
      code: 'too_many_image2_edit_images',
      message: 'Image edit request supports at most 15 images.'
    })
  }
}

const getBufferByteLength = (buffer: ArrayBuffer | Uint8Array): number => {
  return buffer instanceof Uint8Array ? buffer.byteLength : buffer.byteLength
}

const assertEditImageTotalBytes = (images: readonly Image2EditImage[], mask?: Image2EditImage): void => {
  const totalBytes = [...images, ...(mask ? [mask] : [])].reduce(
    (total, image) => total + getBufferByteLength(image.buffer),
    0
  )

  if (totalBytes > MAX_IMAGE_EDIT_TOTAL_BYTES) {
    throw new Image2AdapterError({
      code: 'image2_edit_images_too_large',
      message: 'Image edit request images must be 50MB or smaller in total.'
    })
  }
}

const assertEditMask = (mask: Image2EditImage | undefined): void => {
  if (!mask) {
    return
  }

  if (mask.mimeType !== 'image/png') {
    throw new Image2AdapterError({
      code: 'invalid_image2_edit_mask',
      message: 'Image edit mask must be an image/png file.'
    })
  }

  if (getBufferByteLength(mask.buffer) >= MAX_IMAGE_EDIT_MASK_BYTES) {
    throw new Image2AdapterError({
      code: 'image2_edit_mask_too_large',
      message: 'Image edit mask must be smaller than 4MB.'
    })
  }
}

const assertImage2N = (n: number | undefined): number => {
  const value = n ?? 1

  if (!Number.isInteger(value) || value < 1 || value > 10) {
    throw new Image2AdapterError({
      code: 'invalid_image2_n',
      message: 'Image2 request n must be an integer from 1 to 10.'
    })
  }

  return value
}

const createImage2RequestBody = (request: Image2GenerateRequest): Image2RequestBody => {
  const requestBody: Image2RequestBody = {
    model: request.model,
    prompt: request.prompt,
    size: assertImage2Size(request.size),
    quality: request.quality ?? 'auto',
    n: assertImage2N(request.n)
  }

  if (request.outputFormat) {
    requestBody.output_format = request.outputFormat
  }

  if (request.responseFormat) {
    requestBody.response_format = request.responseFormat
  }

  return requestBody
}

const createRequestSummary = (requestBody: Image2RequestBody): Image2RequestSummary => {
  return {
    mode: 'generation',
    model: requestBody.model,
    size: requestBody.size,
    quality: requestBody.quality,
    outputFormat: requestBody.output_format ?? 'not_sent',
    responseFormat: requestBody.response_format ?? 'not_sent',
    n: requestBody.n
  }
}

const createEditRequestSummary = ({
  fields,
  imageCount,
  images,
  hasMask,
  mask,
  editSubmitMode,
  maskSemantic,
  maskColorMode,
  originalImageWidth,
  originalImageHeight,
  submittedImageWidth,
  submittedImageHeight,
  submittedMaskWidth,
  submittedMaskHeight,
  model,
  n,
  outputFormat,
  quality,
  responseFormat,
  size
}: {
  fields: string[]
  imageCount: number
  images: readonly Image2EditImage[]
  hasMask?: boolean
  mask?: Image2EditImage
  editSubmitMode?: Image2EditSubmitMode
  maskSemantic?: Image2EditMaskSemantic
  maskColorMode?: Image2EditMaskColorMode
  originalImageWidth?: number
  originalImageHeight?: number
  submittedImageWidth?: number
  submittedImageHeight?: number
  submittedMaskWidth?: number
  submittedMaskHeight?: number
  model: string
  n: number
  outputFormat?: string
  quality: string
  responseFormat?: string
  size: string
}): Image2RequestSummary => {
  const sourceImage = images[0]
  const sourceImageBuffer = sourceImage ? toBuffer(sourceImage.buffer) : undefined
  const sourceImageDimensions = sourceImageBuffer ? readImageDimensions(sourceImageBuffer) : undefined
  const maskBuffer = mask ? toBuffer(mask.buffer) : undefined
  const maskDimensions = maskBuffer ? readImageDimensions(maskBuffer) : undefined
  const maskAlphaStats = maskBuffer && mask?.mimeType === 'image/png' ? readPngAlphaStats(maskBuffer) : undefined
  const imageBuffers = images.map((image) => toBuffer(image.buffer))

  return {
    mode: hasMask ? 'edit' : 'reference',
    model,
    size,
    quality,
    outputFormat: outputFormat ?? 'not_sent',
    responseFormat: responseFormat ?? 'not_sent',
    n,
    imageCount,
    referenceImageNames: images.map((image) => image.name),
    referenceImageTotalBytes: imageBuffers.reduce((total, imageBuffer) => total + imageBuffer.byteLength, 0),
    hasMask,
    multipartFields: fields,
    editSubmitMode,
    maskSemantic,
    maskColorMode,
    imageBytes: sourceImageBuffer?.byteLength,
    originalImageWidth,
    originalImageHeight,
    submittedImageWidth,
    submittedImageHeight,
    submittedMaskWidth,
    submittedMaskHeight,
    sourceImageFileName: sourceImage?.name,
    sourceImageMimeType: sourceImage?.mimeType,
    sourceImageBytes: sourceImageBuffer?.byteLength,
    sourceImageWidth: sourceImageDimensions?.width,
    sourceImageHeight: sourceImageDimensions?.height,
    maskFileName: mask?.name,
    maskMimeType: mask?.mimeType,
    maskBytes: maskBuffer?.byteLength,
    maskWidth: maskDimensions?.width,
    maskHeight: maskDimensions?.height,
    maskHasTransparentPixel: maskAlphaStats?.hasTransparentPixel,
    maskHasOnlyAlpha0And255: maskAlphaStats ? maskAlphaStats.otherAlphaCount === 0 : undefined,
    otherAlphaCount: maskAlphaStats?.otherAlphaCount
  }
}

const toAdapterError = (
  response: Response,
  responseBody: Image2ResponseBody,
  requestSummary: Image2RequestSummary,
  endpoint?: string
): Image2AdapterError => {
  return new Image2AdapterError({
    code: 'image2_upstream_error',
    message: responseBody.error?.message || `Image2 request failed with status ${response.status}.`,
    status: response.status,
    upstreamType: responseBody.error?.type,
    upstreamCode: responseBody.error?.code,
    endpoint,
    requestSummary
  })
}

const createLocalEditValidationError = (
  code: string,
  message: string,
  requestSummary: Image2RequestSummary
): Image2AdapterError => {
  return new Image2AdapterError({
    code,
    message,
    requestSummary,
    endpoint: requestSummary.finalEndpoint
  })
}

const ensureEditMaskMatchesSourceImage = (requestSummary: Image2RequestSummary): void => {
  if (!requestSummary.hasMask) {
    return
  }

  if (!requestSummary.sourceImageWidth || !requestSummary.sourceImageHeight) {
    throw createLocalEditValidationError(
      'image_dimension_parse_failed',
      'Cannot determine source image dimensions from the actual image buffer before sending image edit request.',
      requestSummary
    )
  }

  if (!requestSummary.maskWidth || !requestSummary.maskHeight) {
    throw createLocalEditValidationError(
      'mask_dimension_parse_failed',
      'Cannot determine mask dimensions from the actual mask buffer before sending image edit request.',
      requestSummary
    )
  }

  if (
    requestSummary.sourceImageWidth !== requestSummary.maskWidth ||
    requestSummary.sourceImageHeight !== requestSummary.maskHeight
  ) {
    throw createLocalEditValidationError(
      'mask_dimension_mismatch',
      `Mask size ${requestSummary.maskWidth}x${requestSummary.maskHeight} must match source image size ${requestSummary.sourceImageWidth}x${requestSummary.sourceImageHeight}.`,
      requestSummary
    )
  }
}

const normalizeImageDataItems = (data: Image2ResponseBody['data']): Image2ResponseDataItem[] | undefined => {
  if (Array.isArray(data)) {
    return data
  }

  if (typeof data === 'object' && data !== null) {
    return [data]
  }

  return undefined
}

const normalizeImages = (responseBody: Image2ResponseBody): Image2GeneratedImage[] => {
  const responseItems = normalizeImageDataItems(responseBody.data)

  if (!responseItems) {
    throw new Image2AdapterError({
      code: 'no_image_returned',
      message: 'Image2 response did not include image data.'
    })
  }

  let hasInvalidImagePayload = false
  const images: Image2GeneratedImage[] = []

  for (const item of responseItems) {
    const payloadCandidates = [item.b64_json, item.b64Json, item.image, item.base64, item.content, item.url]
    const normalizedPayload = payloadCandidates.map(normalizeImagePayload).find(Boolean)

    if (!normalizedPayload) {
      hasInvalidImagePayload =
        hasInvalidImagePayload ||
        payloadCandidates.some((candidate) => typeof candidate === 'string' && candidate.trim().length > 0)
      continue
    }

    images.push({
      ...normalizedPayload,
      revisedPrompt: typeof item.revised_prompt === 'string' ? item.revised_prompt : undefined,
      width: typeof item.width === 'number' ? item.width : undefined,
      height: typeof item.height === 'number' ? item.height : undefined
    })
  }

  if (images.length === 0) {
    if (hasInvalidImagePayload) {
      throw new Image2AdapterError({
        code: 'invalid_image_payload',
        message: 'Image2 response included image-like data, but it was not a valid image payload.'
      })
    }

    throw new Image2AdapterError({
      code: 'no_image_returned',
      message: 'Image2 response did not include b64_json or url image data.'
    })
  }

  return images
}

const appendOptionalFormField = (formData: FormData, name: string, value: string | number | undefined): void => {
  if (value !== undefined) {
    formData.append(name, String(value))
  }
}

const toBlobPart = (buffer: ArrayBuffer | Uint8Array): BlobPart => {
  if (buffer instanceof Uint8Array) {
    return buffer.slice()
  }

  return new Uint8Array(buffer)
}

const appendImageFile = (formData: FormData, fieldName: string, image: Image2EditImage): void => {
  const fileName = assertNonEmptyString(
    image.name,
    'invalid_image2_edit_image_name',
    'Image edit image name is required.'
  )
  const mimeType = assertNonEmptyString(
    image.mimeType,
    'invalid_image2_edit_image_mime_type',
    'Image edit image MIME type is required.'
  )

  formData.append(fieldName, new Blob([toBlobPart(image.buffer)], { type: mimeType }), fileName)
}

const createImage2EditFormData = (
  request: Image2EditRequest
): { formData: FormData; requestSummary: Image2RequestSummary } => {
  assertEditImageCount(request.images)
  assertEditImageTotalBytes(request.images, request.mask)
  assertEditMask(request.mask)

  const formData = new FormData()
  const model = assertNonEmptyString(
    request.model,
    'missing_image2_edit_model',
    'Image edit request model is required.'
  )
  const prompt = assertNonEmptyString(
    request.prompt,
    'missing_image2_edit_prompt',
    'Image edit request prompt is required.'
  )
  const size = request.size ? assertImage2Size(request.size) : 'auto'
  const quality = request.quality ?? 'auto'
  const n = assertImage2N(request.n)
  const outputFormat = request.sendOutputFormat === false ? undefined : request.outputFormat
  const responseFormat = request.sendResponseFormat === false ? undefined : request.responseFormat
  for (const image of request.images) {
    appendImageFile(formData, 'image', image)
  }

  if (request.mask) {
    appendImageFile(formData, 'mask', request.mask)
  }

  formData.append('prompt', prompt)
  formData.append('model', model)
  appendOptionalFormField(formData, 'size', size)
  appendOptionalFormField(formData, 'quality', quality)
  appendOptionalFormField(formData, 'n', n)
  appendOptionalFormField(formData, 'output_format', outputFormat)
  appendOptionalFormField(formData, 'response_format', responseFormat)
  const fields = [
    'image',
    ...(request.mask ? ['mask'] : []),
    'prompt',
    'model',
    'size',
    'quality',
    'n',
    ...(outputFormat ? ['output_format'] : []),
    ...(responseFormat ? ['response_format'] : [])
  ]

  return {
    formData,
    requestSummary: createEditRequestSummary({
      fields,
      imageCount: request.images.length,
      images: request.images,
      hasMask: Boolean(request.mask),
      mask: request.mask,
      editSubmitMode: request.editSubmitMode,
      maskSemantic: request.maskSemantic,
      maskColorMode: request.maskColorMode,
      originalImageWidth: request.originalImageWidth,
      originalImageHeight: request.originalImageHeight,
      submittedImageWidth: request.submittedImageWidth,
      submittedImageHeight: request.submittedImageHeight,
      submittedMaskWidth: request.submittedMaskWidth,
      submittedMaskHeight: request.submittedMaskHeight,
      model,
      n,
      outputFormat,
      quality,
      responseFormat,
      size
    })
  }
}

export const generateImageWithImage2 = async (request: Image2GenerateRequest): Promise<Image2GenerateResult> => {
  const endpoint = createImage2Endpoint(request.provider.baseUrl, request.provider.endpointPath)
  const requestBody = createImage2RequestBody(request)
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${request.provider.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  })
  const responseBody = await readJsonResponse(response)

  if (!response.ok) {
    throw toAdapterError(response, responseBody, createRequestSummary(requestBody), endpoint)
  }

  return {
    images: normalizeImages(responseBody),
    request: {
      model: requestBody.model,
      size: requestBody.size,
      quality: requestBody.quality,
      outputFormat: requestBody.output_format,
      responseFormat: requestBody.response_format,
      n: requestBody.n
    },
    raw: responseBody
  }
}

export const generateImageEditWithImage2 = async (request: Image2EditRequest): Promise<Image2GenerateResult> => {
  const endpoint = createImage2EditEndpoint(
    request.provider.baseUrl,
    request.endpointPath ?? request.provider.endpointPath
  )
  const { formData, requestSummary } = createImage2EditFormData(request)
  requestSummary.finalEndpoint = endpoint
  ensureEditMaskMatchesSourceImage(requestSummary)
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${request.provider.apiKey}`
    },
    body: formData
  })
  const responseBody = await readJsonResponse(response)

  if (!response.ok) {
    throw toAdapterError(response, responseBody, requestSummary, endpoint)
  }

  return {
    images: normalizeImages(responseBody),
    request: {
      model: requestSummary.model,
      size: requestSummary.size,
      quality: requestSummary.quality,
      outputFormat: requestSummary.outputFormat === 'not_sent' ? undefined : requestSummary.outputFormat,
      responseFormat: requestSummary.responseFormat === 'not_sent' ? undefined : requestSummary.responseFormat,
      n: requestSummary.n
    },
    requestSummary,
    raw: responseBody
  }
}
