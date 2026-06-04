export type ModelCapability =
  | 'chat'
  | 'image_generation'
  | 'image_to_image'
  | 'image_edit'
  | 'video_generation'
  | 'image_to_video'
  | 'speech_to_text'
  | 'text_to_speech'
  | 'audio_generation'

export type ImageSizeMode = 'auto' | 'fixed'

export type ImageAspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3' | '21:9' | '9:21'

export type ImageSizePreset =
  | 'auto'
  | '1024x1024'
  | '1536x1024'
  | '1024x1536'
  | '2048x2048'
  | '2048x1152'
  | '1152x2048'
  | '3840x2160'
  | '2160x3840'

export type ImageResolvedSize = {
  mode: ImageSizeMode
  size: 'auto' | string
  width?: number
  height?: number
  is4K?: boolean
}

export type ImageSizeValidationError = {
  code: string
  message: string
}

export type ImageSizeParseResult = ImageSizeResult<{
  width: number
  height: number
}>

export type ImageSizeResolveInput = {
  mode: ImageSizeMode | string
  fixedSize?: ImageSizePreset | string
}

export type ImageSizeResult<T> = { ok: true; value: T } | { ok: false; error: ImageSizeValidationError }

export type EndpointType =
  | 'chat_completions'
  | 'responses'
  | 'image_generation'
  | 'image_edit'
  | 'video_generation'
  | 'speech_to_text'
  | 'text_to_speech'
  | 'audio_generation'

export type Provider = {
  id: string
  name: string
  baseUrl?: string
  apiKey?: string
  enabled?: boolean
}

export type Model = {
  id: string
  name: string
  providerId: string
  capabilities: ModelCapability[]
  endpointType?: EndpointType
  enabled?: boolean
}

const imageCapabilities: readonly ModelCapability[] = ['image_generation', 'image_to_image', 'image_edit']
const imageSizePattern = /^(\d+)x(\d+)$/
const fixedImageSizePresets: readonly ImageSizePreset[] = [
  '1024x1024',
  '1536x1024',
  '1024x1536',
  '2048x2048',
  '2048x1152',
  '1152x2048',
  '3840x2160',
  '2160x3840'
]
const fourKImageSizePresets: readonly ImageSizePreset[] = ['3840x2160', '2160x3840']

export const hasCapability = (model: Model, capability: ModelCapability): boolean => {
  return model.capabilities.includes(capability)
}

export const filterModelsByCapability = (models: readonly Model[], capability: ModelCapability): Model[] => {
  return models.filter((model) => hasCapability(model, capability))
}

export const isImageCapability = (capability: ModelCapability): boolean => {
  return imageCapabilities.includes(capability)
}

export const isImageModel = (model: Model): boolean => {
  return model.capabilities.some(isImageCapability)
}

export const filterImageModels = (models: readonly Model[]): Model[] => {
  return models.filter(isImageModel)
}

export const parseImageSize = (size: string): ImageSizeParseResult => {
  const match = imageSizePattern.exec(size.trim())

  if (!match) {
    return {
      ok: false,
      error: {
        code: 'invalid_image_size_format',
        message: 'Image size must use the WIDTHxHEIGHT format.'
      }
    }
  }

  return {
    ok: true,
    value: {
      width: Number(match[1]),
      height: Number(match[2])
    }
  }
}

export const validateExplicitImageSize = (width: number, height: number): ImageSizeParseResult => {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return {
      ok: false,
      error: {
        code: 'invalid_image_size_dimensions',
        message: 'Image width and height must be positive integers.'
      }
    }
  }

  if (width % 16 !== 0 || height % 16 !== 0) {
    return {
      ok: false,
      error: {
        code: 'invalid_image_size_grid',
        message: 'Image width and height must both be multiples of 16.'
      }
    }
  }

  const longestSide = Math.max(width, height)
  const shortestSide = Math.min(width, height)
  const pixelCount = width * height

  if (longestSide > 3840) {
    return {
      ok: false,
      error: {
        code: 'image_size_too_large',
        message: 'Image width and height cannot exceed 3840 on either side.'
      }
    }
  }

  if (pixelCount < 655360) {
    return {
      ok: false,
      error: {
        code: 'image_size_area_too_small',
        message: 'Image size must contain at least 655360 pixels.'
      }
    }
  }

  if (pixelCount > 8294400) {
    return {
      ok: false,
      error: {
        code: 'image_size_area_too_large',
        message: 'Image size cannot exceed 8294400 pixels.'
      }
    }
  }

  if (longestSide / shortestSide > 3) {
    return {
      ok: false,
      error: {
        code: 'image_size_aspect_ratio_too_wide',
        message: 'Image aspect ratio cannot exceed 3:1.'
      }
    }
  }

  return {
    ok: true,
    value: {
      width,
      height
    }
  }
}

export const resolveImageSize = (input: ImageSizeResolveInput): ImageSizeResult<ImageResolvedSize> => {
  if (input.mode === 'auto') {
    return {
      ok: true,
      value: {
        mode: 'auto',
        size: 'auto'
      }
    }
  }

  if (input.mode !== 'fixed') {
    return {
      ok: false,
      error: {
        code: 'invalid_image_size_mode',
        message: 'Image size mode must be auto or fixed.'
      }
    }
  }

  if (!input.fixedSize || input.fixedSize === 'auto') {
    return {
      ok: false,
      error: {
        code: 'missing_fixed_image_size',
        message: 'Fixed image size mode requires an explicit non-auto size.'
      }
    }
  }

  if (!fixedImageSizePresets.includes(input.fixedSize as ImageSizePreset)) {
    return {
      ok: false,
      error: {
        code: 'invalid_fixed_image_size_preset',
        message: 'Fixed image size must be one of the supported presets.'
      }
    }
  }

  const parsedSize = parseImageSize(input.fixedSize)

  if (!parsedSize.ok) {
    return parsedSize
  }

  const validatedSize = validateExplicitImageSize(parsedSize.value.width, parsedSize.value.height)

  if (!validatedSize.ok) {
    return validatedSize
  }

  return {
    ok: true,
    value: {
      mode: 'fixed',
      size: input.fixedSize,
      width: validatedSize.value.width,
      height: validatedSize.value.height,
      is4K: fourKImageSizePresets.includes(input.fixedSize as ImageSizePreset)
    }
  }
}
