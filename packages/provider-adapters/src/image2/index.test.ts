import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  generateImageEditWithImage2,
  generateImageWithImage2,
  Image2AdapterError,
  type Image2EditRequest,
  type Image2GenerateRequest
} from './index'

const jpegBase64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2w=='
const jpegDataUrl = `data:image/jpeg;base64,${jpegBase64}`

const baseRequest: Image2GenerateRequest = {
  provider: {
    baseUrl: 'https://api.openai.com',
    apiKey: 'test-api-key'
  },
  model: 'gpt-image-2',
  prompt: 'A quiet mountain lake',
  size: '3840x2160'
}

const createPngHeader = (width: number, height: number): Uint8Array => {
  const bytes = new Uint8Array(33)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  bytes.set([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52], 8)
  new DataView(bytes.buffer).setUint32(16, width)
  new DataView(bytes.buffer).setUint32(20, height)
  bytes.set([0x08, 0x06, 0x00, 0x00, 0x00], 24)
  return bytes
}

const pngBytes = createPngHeader(3840, 2160)
const maskBytes = createPngHeader(3840, 2160)

const baseEditRequest: Image2EditRequest = {
  provider: {
    baseUrl: 'https://api.openai.com',
    apiKey: 'test-api-key'
  },
  model: 'gpt-image-2',
  prompt: 'Make this cyberpunk while preserving the subject composition.',
  images: [
    {
      name: 'reference.png',
      mimeType: 'image/png',
      buffer: pngBytes
    }
  ],
  size: '1024x1024',
  quality: 'low',
  outputFormat: 'png',
  responseFormat: 'b64_json',
  sendOutputFormat: true,
  sendResponseFormat: true
}

const baseEditMask = {
  name: 'mask.png',
  mimeType: 'image/png',
  buffer: maskBytes
} satisfies Image2EditRequest['mask']

const createJsonResponse = (body: unknown, status = 200): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

const mockFetchResponse = (body: unknown, status = 200) => {
  const fetchMock = vi.fn().mockResolvedValue(createJsonResponse(body, status))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const readRequestBody = (fetchMock: ReturnType<typeof mockFetchResponse>) => {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit
  return JSON.parse(String(init.body)) as Record<string, unknown>
}

const readFormDataBody = (fetchMock: ReturnType<typeof mockFetchResponse>) => {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit
  return init.body as FormData
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('generateImageWithImage2', () => {
  it('passes 3840x2160 through to request body.size', async () => {
    const fetchMock = mockFetchResponse({ data: [{ b64_json: jpegBase64 }] })

    await generateImageWithImage2({
      ...baseRequest,
      size: '3840x2160'
    })

    expect(readRequestBody(fetchMock).size).toBe('3840x2160')
  })

  it('does not send response_format by default', async () => {
    const fetchMock = mockFetchResponse({ data: [{ b64_json: jpegBase64 }] })

    await generateImageWithImage2(baseRequest)

    expect(readRequestBody(fetchMock)).not.toHaveProperty('response_format')
  })

  it('sends response_format only when responseFormat is b64_json', async () => {
    const fetchMock = mockFetchResponse({ data: [{ b64_json: jpegBase64 }] })

    await generateImageWithImage2({
      ...baseRequest,
      responseFormat: 'b64_json'
    })

    expect(readRequestBody(fetchMock).response_format).toBe('b64_json')
  })

  it('sends response_format only when responseFormat is url', async () => {
    const fetchMock = mockFetchResponse({ data: [{ url: 'https://cdn.example.com/image.jpeg' }] })

    await generateImageWithImage2({
      ...baseRequest,
      responseFormat: 'url'
    })

    expect(readRequestBody(fetchMock).response_format).toBe('url')
  })

  it('does not send output_format when outputFormat is omitted', async () => {
    const fetchMock = mockFetchResponse({ data: [{ b64_json: jpegBase64 }] })

    await generateImageWithImage2(baseRequest)

    expect(readRequestBody(fetchMock)).not.toHaveProperty('output_format')
  })

  it('sends output_format only when outputFormat is provided', async () => {
    const fetchMock = mockFetchResponse({ data: [{ b64_json: jpegBase64 }] })

    await generateImageWithImage2({
      ...baseRequest,
      outputFormat: 'jpeg'
    })

    expect(readRequestBody(fetchMock).output_format).toBe('jpeg')
  })

  it('passes 2160x3840 through to request body.size', async () => {
    const fetchMock = mockFetchResponse({ data: [{ b64_json: jpegBase64 }] })

    await generateImageWithImage2({
      ...baseRequest,
      size: '2160x3840'
    })

    expect(readRequestBody(fetchMock).size).toBe('2160x3840')
  })

  it('fails on empty size without falling back to 1024x1024', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      generateImageWithImage2({
        ...baseRequest,
        size: ''
      })
    ).rejects.toMatchObject({
      code: 'invalid_image2_size'
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not create a double slash endpoint when baseUrl ends with a slash', async () => {
    const fetchMock = mockFetchResponse({ data: [{ b64_json: jpegBase64 }] })

    await generateImageWithImage2({
      ...baseRequest,
      provider: {
        ...baseRequest.provider,
        baseUrl: 'https://api.openai.com/'
      }
    })

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.openai.com/v1/images/generations')
  })

  it('uses provider endpointPath when provided', async () => {
    const fetchMock = mockFetchResponse({ data: [{ b64_json: jpegBase64 }] })

    await generateImageWithImage2({
      ...baseRequest,
      provider: {
        ...baseRequest.provider,
        baseUrl: 'https://api.openai.com/',
        endpointPath: '/images/generations'
      },
      size: '3840x2160'
    })

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.openai.com/images/generations')
    expect(readRequestBody(fetchMock)).toMatchObject({
      size: '3840x2160'
    })
    expect(readRequestBody(fetchMock)).not.toHaveProperty('output_format')
    expect(readRequestBody(fetchMock)).not.toHaveProperty('response_format')
  })

  it('throws a structured adapter error for upstream non-2xx responses', async () => {
    mockFetchResponse(
      {
        error: {
          type: 'invalid_request_error',
          code: 'invalid_size',
          message: 'The requested size is not supported.'
        }
      },
      400
    )

    await expect(generateImageWithImage2(baseRequest)).rejects.toMatchObject({
      code: 'image2_upstream_error',
      message: 'The requested size is not supported.',
      status: 400,
      upstreamType: 'invalid_request_error',
      upstreamCode: 'invalid_size',
      requestSummary: {
        model: 'gpt-image-2',
        size: '3840x2160',
        quality: 'auto',
        outputFormat: 'not_sent',
        responseFormat: 'not_sent'
      }
    })
  })

  it('does not leak apiKey in upstream error requestSummary', async () => {
    mockFetchResponse(
      {
        error: {
          message: "Unknown parameter: 'response_format'."
        }
      },
      400
    )

    try {
      await generateImageWithImage2(baseRequest)
      throw new Error('Expected generateImageWithImage2 to fail.')
    } catch (error) {
      expect(error).toBeInstanceOf(Image2AdapterError)
      expect(error).toMatchObject({
        requestSummary: {
          responseFormat: 'not_sent'
        }
      })
      expect(JSON.stringify(error)).not.toContain(baseRequest.provider.apiKey)
    }
  })

  it('throws no_image_returned when upstream returns no image payload', async () => {
    mockFetchResponse({ data: [{}] })

    try {
      await generateImageWithImage2(baseRequest)
      throw new Error('Expected generateImageWithImage2 to fail.')
    } catch (error) {
      expect(error).toBeInstanceOf(Image2AdapterError)
      expect(error).toMatchObject({
        code: 'no_image_returned'
      })
    }
  })

  it('normalizes b64_json JPEG base64 as b64Json', async () => {
    mockFetchResponse({ data: [{ b64_json: jpegBase64 }] })

    const result = await generateImageWithImage2(baseRequest)

    expect(result.images[0]?.b64Json).toBe(jpegBase64)
    expect(result.images[0]?.url).toBeUndefined()
  })

  it('normalizes image data URLs as b64Json', async () => {
    mockFetchResponse({ data: [{ image: jpegDataUrl }] })

    const result = await generateImageWithImage2(baseRequest)

    expect(result.images[0]?.b64Json).toBe(jpegDataUrl)
    expect(result.images[0]?.url).toBeUndefined()
  })

  it('normalizes HTTPS URLs as url', async () => {
    mockFetchResponse({ data: [{ url: 'https://cdn.example.com/image.jpeg' }] })

    const result = await generateImageWithImage2(baseRequest)

    expect(result.images[0]?.url).toBe('https://cdn.example.com/image.jpeg')
    expect(result.images[0]?.b64Json).toBeUndefined()
  })

  it('rejects plain text image payloads without treating them as b64Json', async () => {
    mockFetchResponse({ data: [{ b64_json: 'this is not image base64' }] })

    await expect(generateImageWithImage2(baseRequest)).rejects.toMatchObject({
      code: 'invalid_image_payload'
    })
  })

  it('rejects JSON text image payloads without treating them as b64Json', async () => {
    mockFetchResponse({ data: [{ b64_json: '{"error":"not an image"}' }] })

    await expect(generateImageWithImage2(baseRequest)).rejects.toMatchObject({
      code: 'invalid_image_payload'
    })
  })
})

describe('generateImageEditWithImage2', () => {
  it('uses the edits endpoint and multipart form data', async () => {
    const fetchMock = mockFetchResponse({ data: [{ b64_json: jpegBase64 }] })

    await generateImageEditWithImage2(baseEditRequest)

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.openai.com/v1/images/edits')
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(init.headers).toEqual({
      Authorization: 'Bearer test-api-key'
    })
    expect(init.body).toBeInstanceOf(FormData)
  })

  it('appends image, prompt, model, size, quality, and n fields', async () => {
    const fetchMock = mockFetchResponse({ data: [{ b64_json: jpegBase64 }] })

    await generateImageEditWithImage2({
      ...baseEditRequest,
      n: 2
    })

    const formData = readFormDataBody(fetchMock)
    expect(formData.get('image')).toBeInstanceOf(File)
    expect(formData.get('prompt')).toBe(baseEditRequest.prompt)
    expect(formData.get('model')).toBe('gpt-image-2')
    expect(formData.get('size')).toBe('1024x1024')
    expect(formData.get('quality')).toBe('low')
    expect(formData.get('n')).toBe('2')
  })

  it('appends image, mask, prompt, and model fields for inpainting edits', async () => {
    const fetchMock = mockFetchResponse({ data: [{ b64_json: jpegBase64 }] })

    const result = await generateImageEditWithImage2({
      ...baseEditRequest,
      mask: baseEditMask
    })

    const formData = readFormDataBody(fetchMock)
    expect(formData.get('image')).toBeInstanceOf(File)
    expect(formData.get('mask')).toBeInstanceOf(File)
    expect(formData.get('prompt')).toBe(baseEditRequest.prompt)
    expect(formData.get('model')).toBe('gpt-image-2')
    expect(Array.from(formData.keys()).sort()).toEqual([
      'image',
      'mask',
      'model',
      'n',
      'output_format',
      'prompt',
      'quality',
      'response_format',
      'size'
    ])
    expect(result.requestSummary).toMatchObject({
      mode: 'edit',
      hasMask: true
    })
  })

  it('supports multiple image files with repeated image fields', async () => {
    const fetchMock = mockFetchResponse({ data: [{ b64_json: jpegBase64 }] })

    await generateImageEditWithImage2({
      ...baseEditRequest,
      images: [
        baseEditRequest.images[0],
        {
          name: 'second.png',
          mimeType: 'image/png',
          buffer: pngBytes
        }
      ]
    })

    const formData = readFormDataBody(fetchMock)
    expect(formData.getAll('image')).toHaveLength(2)
    expect(formData.getAll('image').every((item) => item instanceof File)).toBe(true)
    expect(formData.get('image[]')).toBeNull()
  })

  it('sends output_format for edit requests when enabled', async () => {
    const fetchMock = mockFetchResponse({ data: [{ b64_json: jpegBase64 }] })

    await generateImageEditWithImage2({
      ...baseEditRequest,
      sendOutputFormat: true
    })

    expect(readFormDataBody(fetchMock).get('output_format')).toBe('png')
  })

  it('sends response_format for edit requests when enabled', async () => {
    const fetchMock = mockFetchResponse({ data: [{ b64_json: jpegBase64 }] })

    await generateImageEditWithImage2({
      ...baseEditRequest,
      sendResponseFormat: true,
      responseFormat: 'b64_json'
    })

    expect(readFormDataBody(fetchMock).get('response_format')).toBe('b64_json')
  })

  it('omits optional format fields for edit requests when disabled', async () => {
    const fetchMock = mockFetchResponse({ data: [{ b64_json: jpegBase64 }] })

    await generateImageEditWithImage2({
      ...baseEditRequest,
      sendOutputFormat: false,
      sendResponseFormat: false
    })

    expect(readFormDataBody(fetchMock).get('output_format')).toBeNull()
    expect(readFormDataBody(fetchMock).get('response_format')).toBeNull()
  })

  it('passes 3840x2160 through without downgrading', async () => {
    const fetchMock = mockFetchResponse({ data: [{ b64_json: jpegBase64 }] })

    await generateImageEditWithImage2({
      ...baseEditRequest,
      size: '3840x2160'
    })

    expect(readFormDataBody(fetchMock).get('size')).toBe('3840x2160')
  })

  it('includes edit submit compatibility metadata in summaries', async () => {
    mockFetchResponse({ data: [{ b64_json: jpegBase64 }] })

    const result = await generateImageEditWithImage2({
      ...baseEditRequest,
      images: [
        {
          ...baseEditRequest.images[0],
          buffer: createPngHeader(1536, 864)
        }
      ],
      mask: {
        ...baseEditMask,
        buffer: createPngHeader(1536, 864)
      },
      size: 'auto',
      quality: 'low',
      editSubmitMode: 'compatible',
      maskSemantic: 'transparent-edit',
      maskColorMode: 'white',
      originalImageWidth: 3840,
      originalImageHeight: 2160,
      submittedImageWidth: 1536,
      submittedImageHeight: 864,
      submittedMaskWidth: 1536,
      submittedMaskHeight: 864
    })

    expect(result.requestSummary).toMatchObject({
      editSubmitMode: 'compatible',
      maskSemantic: 'transparent-edit',
      maskColorMode: 'white',
      imageBytes: 33,
      originalImageWidth: 3840,
      originalImageHeight: 2160,
      submittedImageWidth: 1536,
      submittedImageHeight: 864,
      submittedMaskWidth: 1536,
      submittedMaskHeight: 864,
      sourceImageWidth: 1536,
      sourceImageHeight: 864,
      maskWidth: 1536,
      maskHeight: 864
    })
  })

  it('rejects a non-png mask', async () => {
    await expect(
      generateImageEditWithImage2({
        ...baseEditRequest,
        mask: {
          ...baseEditMask,
          mimeType: 'image/jpeg'
        }
      })
    ).rejects.toMatchObject({
      code: 'invalid_image2_edit_mask'
    })
  })

  it('rejects a mask that is 4MB or larger', async () => {
    await expect(
      generateImageEditWithImage2({
        ...baseEditRequest,
        mask: {
          ...baseEditMask,
          buffer: new Uint8Array(4 * 1024 * 1024)
        }
      })
    ).rejects.toMatchObject({
      code: 'image2_edit_mask_too_large'
    })
  })

  it('normalizes b64_json edit responses', async () => {
    mockFetchResponse({ data: [{ b64_json: jpegBase64 }] })

    const result = await generateImageEditWithImage2(baseEditRequest)

    expect(result.images[0]?.b64Json).toBe(jpegBase64)
    expect(result.request).toMatchObject({
      model: 'gpt-image-2',
      size: '1024x1024',
      quality: 'low',
      n: 1
    })
    expect(result.request.outputFormat).toBe('png')
    expect(result.request.responseFormat).toBe('b64_json')
    expect(result.requestSummary).toMatchObject({
      mode: 'reference',
      finalEndpoint: 'https://api.openai.com/v1/images/edits',
      multipartFields: ['image', 'prompt', 'model', 'size', 'quality', 'n', 'output_format', 'response_format'],
      referenceImageNames: ['reference.png'],
      referenceImageTotalBytes: pngBytes.byteLength,
      sourceImageMimeType: 'image/png',
      sourceImageWidth: 3840,
      sourceImageHeight: 2160
    })
  })

  it('rejects a source image whose dimensions cannot be parsed before sending', async () => {
    const fetchMock = mockFetchResponse({ data: [{ b64_json: jpegBase64 }] })

    await expect(
      generateImageEditWithImage2({
        ...baseEditRequest,
        images: [
          {
            ...baseEditRequest.images[0],
            buffer: new Uint8Array([1, 2, 3])
          }
        ],
        mask: baseEditMask
      })
    ).rejects.toMatchObject({
      code: 'image_dimension_parse_failed',
      endpoint: 'https://api.openai.com/v1/images/edits',
      requestSummary: {
        sourceImageWidth: undefined,
        maskWidth: 3840,
        maskHeight: 2160
      }
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a mask whose dimensions cannot be parsed before sending', async () => {
    const fetchMock = mockFetchResponse({ data: [{ b64_json: jpegBase64 }] })

    await expect(
      generateImageEditWithImage2({
        ...baseEditRequest,
        mask: {
          ...baseEditMask,
          buffer: new Uint8Array([0x89, 0x50, 0x4e, 0x47])
        }
      })
    ).rejects.toMatchObject({
      code: 'mask_dimension_parse_failed',
      endpoint: 'https://api.openai.com/v1/images/edits',
      requestSummary: {
        sourceImageWidth: 3840,
        sourceImageHeight: 2160,
        maskWidth: undefined
      }
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects mismatched source and mask dimensions before sending', async () => {
    const fetchMock = mockFetchResponse({ data: [{ b64_json: jpegBase64 }] })

    await expect(
      generateImageEditWithImage2({
        ...baseEditRequest,
        mask: {
          ...baseEditMask,
          buffer: createPngHeader(1920, 1080)
        }
      })
    ).rejects.toMatchObject({
      code: 'mask_dimension_mismatch',
      endpoint: 'https://api.openai.com/v1/images/edits',
      requestSummary: {
        sourceImageWidth: 3840,
        sourceImageHeight: 2160,
        maskWidth: 1920,
        maskHeight: 1080
      }
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('normalizes object-shaped b64_json edit responses', async () => {
    mockFetchResponse({ data: { b64_json: jpegBase64 } })

    const result = await generateImageEditWithImage2(baseEditRequest)

    expect(result.images[0]?.b64Json).toBe(jpegBase64)
  })

  it('normalizes URL edit responses', async () => {
    mockFetchResponse({ data: [{ url: 'https://cdn.example.com/edited.png' }] })

    const result = await generateImageEditWithImage2({
      ...baseEditRequest,
      responseFormat: 'url'
    })

    expect(result.images[0]?.url).toBe('https://cdn.example.com/edited.png')
    expect(result.images[0]?.b64Json).toBeUndefined()
  })

  it('throws a structured upstream error without leaking apiKey', async () => {
    mockFetchResponse(
      {
        error: {
          type: 'invalid_request_error',
          code: 'invalid_image',
          message: 'The image field is invalid.'
        }
      },
      400
    )

    try {
      await generateImageEditWithImage2(baseEditRequest)
      throw new Error('Expected generateImageEditWithImage2 to fail.')
    } catch (error) {
      expect(error).toBeInstanceOf(Image2AdapterError)
      expect(error).toMatchObject({
        code: 'image2_upstream_error',
        status: 400,
        upstreamType: 'invalid_request_error',
        upstreamCode: 'invalid_image',
        endpoint: 'https://api.openai.com/v1/images/edits',
        requestSummary: {
          mode: 'reference',
          model: 'gpt-image-2',
          size: '1024x1024',
          quality: 'low',
          outputFormat: 'png',
          responseFormat: 'b64_json',
          n: 1,
          imageCount: 1,
          referenceImageNames: ['reference.png'],
          referenceImageTotalBytes: pngBytes.byteLength,
          finalEndpoint: 'https://api.openai.com/v1/images/edits',
          multipartFields: ['image', 'prompt', 'model', 'size', 'quality', 'n', 'output_format', 'response_format'],
          sourceImageFileName: 'reference.png',
          sourceImageMimeType: 'image/png',
          sourceImageBytes: pngBytes.byteLength,
          sourceImageWidth: 3840,
          sourceImageHeight: 2160
        }
      })
      expect(JSON.stringify(error)).not.toContain(baseEditRequest.provider.apiKey)
    }
  })
})
