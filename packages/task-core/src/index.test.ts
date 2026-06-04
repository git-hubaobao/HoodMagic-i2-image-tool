import { describe, expect, it } from 'vitest'

import {
  createImageEditTask,
  createImageGenerationTask,
  type ImageEditTaskRequest,
  type ImageGenerationTaskRequest,
  markTaskFailed,
  markTaskRunning,
  markTaskSucceeded
} from './index'

const request: ImageGenerationTaskRequest = {
  conversationId: 'conversation-1',
  baseUrl: 'https://api.openai.com',
  apiKey: 'secret-api-key',
  model: 'gpt-image-2',
  prompt: 'A quiet mountain lake',
  size: '3840x2160',
  quality: 'auto',
  outputFormat: 'png'
}

const editRequest: ImageEditTaskRequest = {
  ...request,
  editEndpointPath: '/v1/images/edits',
  images: [
    {
      name: 'reference.png',
      mimeType: 'image/png',
      size: 128,
      width: 3840,
      height: 2160,
      dataUrl: 'data:image/png;base64,secret-image-data',
      buffer: new Uint8Array([1, 2, 3])
    }
  ],
  mask: {
    name: 'mask.png',
    mimeType: 'image/png',
    size: 64,
    width: 3840,
    height: 2160,
    dataUrl: 'data:image/png;base64,secret-mask-data',
    buffer: new Uint8Array([4, 5, 6])
  }
}

describe('task-core image generation tasks', () => {
  it('creates a queued task without saving apiKey', () => {
    const task = createImageGenerationTask(request)

    expect(task.status).toBe('queued')
    expect(task.request).toEqual({
      conversationId: request.conversationId,
      model: request.model,
      prompt: request.prompt,
      size: request.size,
      quality: request.quality,
      outputFormat: request.outputFormat
    })
    expect('apiKey' in task.request).toBe(false)
    expect('baseUrl' in task.request).toBe(false)
  })

  it('marks a task running without mutating the original task', () => {
    const task = createImageGenerationTask(request)
    const runningTask = markTaskRunning(task)

    expect(runningTask.status).toBe('running')
    expect(runningTask.startedAt).toBeDefined()
    expect(task.status).toBe('queued')
    expect(task.startedAt).toBeUndefined()
  })

  it('marks a task succeeded without mutating the original task', () => {
    const task = createImageGenerationTask(request)
    const result = {
      images: [{ b64Json: 'image-data' }],
      request: {
        model: request.model,
        size: request.size,
        quality: request.quality,
        outputFormat: request.outputFormat
      }
    }
    const succeededTask = markTaskSucceeded(task, result)

    expect(succeededTask.status).toBe('succeeded')
    expect(succeededTask.result).toEqual(result)
    expect(succeededTask.finishedAt).toBeDefined()
    expect(task.status).toBe('queued')
    expect(task.result).toBeUndefined()
  })

  it('keeps the conversation id across task lifecycle updates', () => {
    const task = createImageGenerationTask(request)
    const runningTask = markTaskRunning(task)
    const succeededTask = markTaskSucceeded(runningTask, {
      images: [{ b64Json: 'image-data' }],
      request: {
        model: request.model,
        size: request.size,
        quality: request.quality,
        outputFormat: request.outputFormat
      }
    })

    expect(runningTask.request.conversationId).toBe(request.conversationId)
    expect(succeededTask.request.conversationId).toBe(request.conversationId)
  })

  it('marks a task failed without mutating the original task', () => {
    const task = createImageGenerationTask(request)
    const failedTask = markTaskFailed(task, {
      code: 'image2_upstream_error',
      message: 'The requested size is not supported.',
      status: 400
    })

    expect(failedTask.status).toBe('failed')
    expect(failedTask.error).toEqual({
      code: 'image2_upstream_error',
      message: 'The requested size is not supported.',
      status: 400
    })
    expect(failedTask.finishedAt).toBeDefined()
    expect(task.status).toBe('queued')
    expect(task.error).toBeUndefined()
  })

  it('creates an image edit task without saving apiKey or full reference image data', () => {
    const task = createImageEditTask(editRequest)

    expect(task.type).toBe('image_edit')
    expect(task.status).toBe('queued')
    expect(task.request).toEqual({
      model: request.model,
      prompt: request.prompt,
      size: request.size,
      quality: request.quality,
      outputFormat: request.outputFormat,
      conversationId: request.conversationId,
      editMode: 'masked_edit',
      referenceImageCount: 1,
      referenceImageNames: ['reference.png'],
      referenceImageTotalBytes: 128,
      referenceImages: [
        {
          name: 'reference.png',
          mimeType: 'image/png',
          size: 128,
          width: 3840,
          height: 2160
        }
      ],
      mask: {
        name: 'mask.png',
        mimeType: 'image/png',
        size: 64,
        width: 3840,
        height: 2160
      }
    })
    expect(JSON.stringify(task.request)).not.toContain('secret-api-key')
    expect(JSON.stringify(task.request)).not.toContain('secret-image-data')
    expect(JSON.stringify(task.request)).not.toContain('secret-mask-data')
    expect(JSON.stringify(task.request)).not.toContain('[1,2,3]')
    expect(JSON.stringify(task.request)).not.toContain('[4,5,6]')
  })

  it('creates a reference image generation task summary when no mask is provided', () => {
    const task = createImageEditTask({
      ...editRequest,
      mask: undefined
    })

    expect(task.type).toBe('image_edit')
    expect(task.request).toMatchObject({
      editMode: 'reference',
      referenceImageCount: 1,
      referenceImageNames: ['reference.png'],
      referenceImageTotalBytes: 128
    })
    expect('mask' in task.request).toBe(false)
    expect(JSON.stringify(task.request)).not.toContain('secret-image-data')
  })

  it('marks an image edit task running and succeeded', () => {
    const task = createImageEditTask(editRequest)
    const runningTask = markTaskRunning(task)
    const succeededTask = markTaskSucceeded(runningTask, {
      images: [{ b64Json: 'image-data' }],
      request: {
        model: request.model,
        size: request.size,
        quality: request.quality,
        outputFormat: request.outputFormat
      }
    })

    expect(runningTask.type).toBe('image_edit')
    expect(runningTask.status).toBe('running')
    expect(succeededTask.type).toBe('image_edit')
    expect(succeededTask.status).toBe('succeeded')
  })
})
