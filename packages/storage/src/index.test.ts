import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  addImageHistoryItem,
  builtInImageProviderTemplates,
  COMPATIBLE_PROVIDER_TEMPLATE_ID,
  createConversation,
  createDefaultImageToolData,
  createDefaultImageToolSettings,
  createImageFileName,
  createImagePromptPackExport,
  createImagePromptTemplateExport,
  createProjectGroup,
  DEFAULT_CONVERSATION_ID,
  DEFAULT_PROJECT_ID,
  DEFAULT_PROMPT_TEMPLATE_CATEGORY_ID,
  ensureUniqueFilePath,
  getImageFileExtension,
  getImageProviderTemplates,
  type ImageHistoryItem,
  moveConversationToProject,
  moveConversationToTrash,
  parsePromptTemplateImportDocument,
  permanentlyDeleteConversation,
  removeCustomProviderTemplate,
  removeImageHistoryItem,
  removeProjectGroup,
  removePromptTemplate,
  removePromptTemplateCategory,
  renameConversation,
  renderPromptTemplatePrompt,
  restoreConversation,
  sanitizeFileNamePart,
  sanitizeImageToolData,
  setImageProviderCredential,
  updateImageHistoryItem,
  upsertCustomProviderTemplate,
  upsertPromptTemplate,
  upsertPromptTemplateCategory
} from './index'

const historyItem: ImageHistoryItem = {
  id: 'history-1',
  conversationId: DEFAULT_CONVERSATION_ID,
  taskId: 'task-1',
  prompt: 'A quiet mountain lake',
  model: 'gpt-image-2',
  size: '3840x2160',
  quality: 'auto',
  outputFormat: 'png',
  createdAt: 1,
  updatedAt: 1
}

describe('storage image-tool data helpers', () => {
  it('creates default settings without apiKey', () => {
    const settings = createDefaultImageToolSettings()

    expect('apiKey' in settings).toBe(false)
    expect(settings.model).toBe('gpt-image-2')
    expect(settings.appearanceTheme).toBe('dark')
    expect(settings.saveApiKey).toBe(false)
    expect(settings.providerTemplateId).toBe(COMPATIBLE_PROVIDER_TEMPLATE_ID)
    expect(settings.baseUrl).toBe('https://api.openai.com')
    expect(settings.endpointPath).toBe('/v1/images/generations')
    expect(settings.editEndpointPath).toBe('/v1/images/edits')
    expect(settings.sendOutputFormat).toBe(true)
    expect(settings.sendResponseFormat).toBe(false)
    expect(settings.providerCredentials).toEqual({})
    expect(settings.customProviderTemplates).toEqual([])
  })

  it('exposes only the compatible built-in provider template', () => {
    expect(builtInImageProviderTemplates).toEqual([
      expect.objectContaining({
        id: COMPATIBLE_PROVIDER_TEMPLATE_ID,
        name: 'Compatible API',
        description: 'Works with standard Images API or compatible proxies.'
      })
    ])

    const builtInDisplayText = builtInImageProviderTemplates
      .map((template) => `${template.name} ${template.description ?? ''}`)
      .join('\n')

    expect(builtInImageProviderTemplates.map((template) => template.id)).not.toEqual(
      expect.arrayContaining(['openai-standard', 'hubaobao', 'jiekou-highway', 'jiekou-original', 'custom'])
    )
    expect(builtInDisplayText).not.toMatch(/OpenAI|ChatGPT|胡爆爆|jiekou|highwayapi|自定义/)
  })

  it('combines the compatible built-in with user-created templates only', () => {
    const userTemplate = {
      id: 'custom-team-gateway',
      name: 'Team Gateway',
      defaultBaseUrl: 'https://api.openai.com',
      endpointPath: '/images/generations',
      editEndpointPath: '/v1/images/edits',
      model: 'gpt-image-2',
      sendOutputFormat: false,
      sendResponseFormat: false
    }

    expect(getImageProviderTemplates([userTemplate]).map((template) => template.id)).toEqual([
      COMPATIBLE_PROVIDER_TEMPLATE_ID,
      'custom-team-gateway'
    ])
  })

  it('defaults missing appearance theme to dark for legacy data', () => {
    const data = sanitizeImageToolData({
      settings: {
        model: 'custom-image-model'
      }
    })

    expect(data.settings.appearanceTheme).toBe('dark')
  })

  it('keeps a saved light appearance theme', () => {
    const data = sanitizeImageToolData({
      settings: {
        appearanceTheme: 'light'
      }
    })

    expect(data.settings.appearanceTheme).toBe('light')
  })

  it('falls back to dark for unsupported appearance theme values', () => {
    const data = sanitizeImageToolData({
      settings: {
        appearanceTheme: 'sepia'
      }
    })

    expect(data.settings.appearanceTheme).toBe('dark')
  })

  it('sanitizes appearance theme without touching provider and template data', () => {
    const data = sanitizeImageToolData({
      settings: {
        appearanceTheme: 'light',
        providerTemplateId: 'custom-fluxhub',
        baseUrl: 'https://api.openai.com',
        endpointPath: '/images/generations',
        editEndpointPath: '/images/edits',
        providerCredentials: {
          'custom-fluxhub': {
            apiKey: 'fluxhub-key'
          }
        },
        customProviderTemplates: [
          {
            id: 'custom-fluxhub',
            name: 'FluxHub',
            defaultBaseUrl: 'https://api.openai.com',
            endpointPath: '/images/generations',
            editEndpointPath: '/images/edits',
            model: 'gpt-image-2',
            sendOutputFormat: false,
            sendResponseFormat: false
          }
        ]
      },
      promptTemplates: [
        {
          id: 'prompt-template-1',
          categoryId: DEFAULT_PROMPT_TEMPLATE_CATEGORY_ID,
          title: 'Template',
          templateType: 'text_to_image',
          prompt: 'A warm studio portrait',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        }
      ]
    })

    expect(data.settings.appearanceTheme).toBe('light')
    expect(data.settings.providerTemplateId).toBe('custom-fluxhub')
    expect(data.settings.providerCredentials['custom-fluxhub']?.apiKey).toBe('fluxhub-key')
    expect(data.settings.customProviderTemplates).toHaveLength(1)
    expect(data.promptTemplates).toHaveLength(1)
  })

  it('adds history without mutating original data', () => {
    const data = createConversation(createDefaultImageToolData())
    const conversationId = data.activeConversationId ?? ''
    const nextData = addImageHistoryItem(data, historyItem)

    expect(nextData.history).toEqual([{ ...historyItem, conversationId }])
    expect(nextData.conversations[0]?.imageCount).toBe(0)
    expect(nextData.conversations[0]?.messageCount).toBe(2)
    expect(data.history).toEqual([])
  })

  it('starts empty without creating a default project or conversation', () => {
    const data = createDefaultImageToolData()

    expect(data.projects).toEqual([])
    expect(data.conversations).toEqual([])
    expect(data.activeConversationId).toBeUndefined()
  })

  it('sanitizes empty data without creating a default project or conversation', () => {
    const data = sanitizeImageToolData({})

    expect(data.projects).toEqual([])
    expect(data.conversations).toEqual([])
    expect(data.activeConversationId).toBeUndefined()
  })

  it('migrates legacy history into an ungrouped conversation', () => {
    const data = sanitizeImageToolData({
      settings: {
        model: 'custom-image-model'
      },
      history: [
        {
          id: 'legacy-history',
          taskId: 'legacy-task',
          prompt: 'A preserved image',
          model: 'gpt-image-2',
          size: '1024x1024',
          createdAt: 1,
          updatedAt: 2
        }
      ]
    })

    expect(data.projects).toEqual([])
    expect(data.conversations).toEqual([
      expect.objectContaining({
        id: DEFAULT_CONVERSATION_ID,
        projectId: null
      })
    ])
    expect(data.activeConversationId).toBe(DEFAULT_CONVERSATION_ID)
    expect(data.history[0]?.conversationId).toBe(DEFAULT_CONVERSATION_ID)
  })

  it('initializes the prompt template library with Uncategorized only', () => {
    const data = createDefaultImageToolData()

    expect(data.promptTemplateCategories).toEqual([
      expect.objectContaining({
        id: DEFAULT_PROMPT_TEMPLATE_CATEGORY_ID,
        name: '未分类',
        parentId: null
      })
    ])
    expect(data.promptTemplates).toEqual([])
  })

  it('creates and renames prompt template categories', () => {
    const data = upsertPromptTemplateCategory(createDefaultImageToolData(), { name: 'Products' })
    const category = data.promptTemplateCategories.find((item) => item.name === 'Products')
    const renamedData = upsertPromptTemplateCategory(data, { ...category!, name: 'Campaigns' })

    expect(category).toBeDefined()
    expect(
      renamedData.promptTemplateCategories.some((item) => item.id === category?.id && item.name === 'Campaigns')
    ).toBe(true)
  })

  it('moves templates to Uncategorized when deleting a category', () => {
    const data = upsertPromptTemplateCategory(createDefaultImageToolData(), {
      id: 'category-products',
      name: 'Products'
    })
    const dataWithTemplate = upsertPromptTemplate(data, {
      id: 'template-product',
      categoryId: 'category-products',
      title: 'Product hero',
      templateType: 'text_to_image',
      prompt: 'Create a product hero image.'
    })
    const nextData = removePromptTemplateCategory(dataWithTemplate, 'category-products')

    expect(nextData.promptTemplateCategories.some((category) => category.id === 'category-products')).toBe(false)
    expect(nextData.promptTemplates[0]?.categoryId).toBe(DEFAULT_PROMPT_TEMPLATE_CATEGORY_ID)
  })

  it('creates edits and deletes prompt templates', () => {
    const data = upsertPromptTemplate(createDefaultImageToolData(), {
      id: 'template-1',
      title: 'Product hero',
      templateType: 'text_to_image',
      prompt: 'Create a product hero image.'
    })
    const editedData = upsertPromptTemplate(data, {
      id: 'template-1',
      title: 'Product closeup',
      templateType: 'image_to_image',
      prompt: 'Transform this reference into a closeup.'
    })
    const deletedData = removePromptTemplate(editedData, 'template-1')

    expect(data.promptTemplates[0]).toMatchObject({
      title: 'Product hero',
      templateType: 'text_to_image'
    })
    expect(editedData.promptTemplates[0]).toMatchObject({
      title: 'Product closeup',
      templateType: 'image_to_image'
    })
    expect(deletedData.promptTemplates).toEqual([])
  })

  it('renders prompt template variables with defaults and user values', () => {
    const data = upsertPromptTemplate(createDefaultImageToolData(), {
      id: 'template-vars',
      title: 'Variable template',
      templateType: 'text_to_image',
      prompt: 'Create {productName} in {style} style for {audience}.',
      variables: [
        { key: 'productName', label: 'Product', required: true },
        { key: 'style', label: 'Style', defaultValue: 'clean commercial' },
        { key: 'audience', label: 'Audience' }
      ]
    })

    expect(renderPromptTemplatePrompt(data.promptTemplates[0], { productName: 'headphones' })).toBe(
      'Create headphones in clean commercial style for {audience}.'
    )
  })

  it('validates single prompt template imports', () => {
    const parsedDocument = parsePromptTemplateImportDocument({
      schemaVersion: 1,
      kind: 'image-prompt-template',
      template: {
        id: 'external-id',
        title: 'Cyber product',
        categoryPath: ['Products', 'Electronics'],
        templateType: 'text_to_image',
        prompt: 'Create {productName}.',
        variables: [{ key: 'productName', label: 'Product', required: true }],
        tags: ['commerce'],
        recommendedParams: {
          size: '3840x2160',
          quality: 'high',
          outputFormat: 'jpeg'
        },
        previewImage: {
          mimeType: 'image/jpeg',
          dataUrl: 'data:image/jpeg;base64,AAAA'
        }
      }
    })

    expect(parsedDocument.kind).toBe('image-prompt-template')
    expect(parsedDocument.templates[0]).toMatchObject({
      title: 'Cyber product',
      templateType: 'text_to_image',
      categoryPath: ['Products', 'Electronics']
    })
  })

  it('validates prompt template pack imports', () => {
    const parsedDocument = parsePromptTemplateImportDocument({
      schemaVersion: 1,
      kind: 'image-prompt-pack',
      name: 'Commerce pack',
      templates: [
        {
          title: 'Reference remix',
          templateType: 'image_to_image',
          prompt: 'Use the reference image and make it editorial.'
        }
      ]
    })

    expect(parsedDocument.kind).toBe('image-prompt-pack')
    expect(parsedDocument.templates[0]?.templateType).toBe('image_to_image')
  })

  it('exports a self-contained single prompt template without credentials or paths', () => {
    const document = createImagePromptTemplateExport({
      title: 'Exported',
      categoryPath: ['Products'],
      templateType: 'text_to_image',
      prompt: 'Create a product image.',
      previewImage: {
        mimeType: 'image/png',
        dataUrl: 'data:image/png;base64,AAAA'
      }
    })
    const serializedDocument = JSON.stringify(document)

    expect(document.kind).toBe('image-prompt-template')
    expect(serializedDocument).toContain('data:image/png;base64,AAAA')
    expect(serializedDocument).not.toContain('apiKey')
    expect(serializedDocument).not.toContain('C:\\')
  })

  it('exports a self-contained prompt template pack without history or task data', () => {
    const document = createImagePromptPackExport({
      name: 'All templates',
      templates: [
        {
          title: 'Pack item',
          templateType: 'text_to_image',
          prompt: 'Create a pack item.'
        }
      ]
    })
    const serializedDocument = JSON.stringify(document)

    expect(document.kind).toBe('image-prompt-pack')
    expect(document.templates).toHaveLength(1)
    expect(serializedDocument).not.toContain('conversationId')
    expect(serializedDocument).not.toContain('taskId')
  })

  it('creates and renames conversations', () => {
    const data = createConversation(createDefaultImageToolData(), {
      title: 'New chat'
    })
    const conversationId = data.activeConversationId ?? ''
    const renamedData = renameConversation(data, conversationId, 'Campaign concept')

    expect(data.conversations[0]?.title).toBe('New chat')
    expect(renamedData.conversations.find((conversation) => conversation.id === conversationId)?.title).toBe(
      'Campaign concept'
    )
  })

  it('creates projects and moves conversations into them', () => {
    const data = createConversation(createProjectGroup(createDefaultImageToolData(), 'Client A'))
    const project = data.projects.find((item) => item.id !== DEFAULT_PROJECT_ID)
    const movedData = moveConversationToProject(data, data.activeConversationId ?? '', project?.id ?? '')

    expect(project?.name).toBe('Client A')
    expect(
      movedData.conversations.find((conversation) => conversation.id === data.activeConversationId)?.projectId
    ).toBe(project?.id)
  })

  it('keeps newly created projects when sanitizing data', () => {
    const data = createProjectGroup(createDefaultImageToolData(), 'New project')
    const project = data.projects.find((item) => item.id !== DEFAULT_PROJECT_ID)
    const sanitizedData = sanitizeImageToolData(data)

    expect(project).toBeDefined()
    expect(sanitizedData.projects.some((item) => item.id === project?.id && item.name === 'New project')).toBe(true)
  })

  it('moves project conversations to trash when deleting a project', () => {
    const dataWithProject = createProjectGroup(createProjectGroup(createDefaultImageToolData(), 'Temporary'), 'Keep')
    const project = dataWithProject.projects.find((item) => item.name === 'Temporary')
    const projectToKeep = dataWithProject.projects.find((item) => item.name === 'Keep')
    const dataWithNewConversation = createConversation(dataWithProject)
    const dataWithConversation = moveConversationToProject(
      dataWithNewConversation,
      dataWithNewConversation.activeConversationId ?? DEFAULT_CONVERSATION_ID,
      project?.id ?? ''
    )
    const nextData = removeProjectGroup(dataWithConversation, project?.id ?? '')

    expect(nextData.projects.some((item) => item.id === project?.id)).toBe(false)
    expect(nextData.projects.some((item) => item.id === projectToKeep?.id)).toBe(true)
    expect(
      nextData.conversations.find((conversation) => conversation.projectId === project?.id)?.deletedAt
    ).toBeTruthy()
    expect(nextData.activeConversationId).not.toBe(dataWithConversation.activeConversationId)
  })

  it('moves conversations to trash and restores them', () => {
    const data = createConversation(createDefaultImageToolData())
    const conversationId = data.activeConversationId ?? ''
    const trashedData = moveConversationToTrash(data, conversationId)
    const restoredData = restoreConversation(trashedData, conversationId)

    expect(trashedData.conversations.find((conversation) => conversation.id === conversationId)?.deletedAt).toBeTruthy()
    expect(trashedData.activeConversationId).not.toBe(conversationId)
    expect(restoredData.conversations.find((conversation) => conversation.id === conversationId)?.deletedAt).toBeNull()
    expect(restoredData.activeConversationId).toBe(conversationId)
  })

  it('permanently deletes conversations and their history only', () => {
    const data = createConversation(createDefaultImageToolData(), { title: 'A' })
    const conversationAId = data.activeConversationId ?? ''
    const dataWithConversationB = createConversation(data, { title: 'B' })
    const conversationBId = dataWithConversationB.activeConversationId ?? ''
    const dataWithHistory = addImageHistoryItem(
      addImageHistoryItem(dataWithConversationB, {
        ...historyItem,
        id: 'history-a',
        conversationId: conversationAId
      }),
      {
        ...historyItem,
        id: 'history-b',
        conversationId: conversationBId
      }
    )
    const nextData = permanentlyDeleteConversation(dataWithHistory, conversationAId)

    expect(nextData.conversations.some((conversation) => conversation.id === conversationAId)).toBe(false)
    expect(nextData.history.map((item) => item.id)).toEqual(['history-b'])
    expect(nextData.conversations.some((conversation) => conversation.id === conversationBId)).toBe(true)
  })

  it('keeps histories isolated by conversation', () => {
    const data = createConversation(createDefaultImageToolData(), { title: 'A' })
    const conversationAId = data.activeConversationId ?? ''
    const dataWithConversationB = createConversation(data, { title: 'B' })
    const conversationBId = dataWithConversationB.activeConversationId ?? ''
    const nextData = addImageHistoryItem(
      addImageHistoryItem(dataWithConversationB, {
        ...historyItem,
        id: 'history-a',
        conversationId: conversationAId
      }),
      {
        ...historyItem,
        id: 'history-b',
        conversationId: conversationBId
      }
    )

    expect(nextData.history.filter((item) => item.conversationId === conversationAId).map((item) => item.id)).toEqual([
      'history-a'
    ])
    expect(nextData.history.filter((item) => item.conversationId === conversationBId).map((item) => item.id)).toEqual([
      'history-b'
    ])
  })

  it('repairs missing active conversation id', () => {
    const data = sanitizeImageToolData({
      projects: [
        {
          id: DEFAULT_PROJECT_ID,
          name: '默认项目',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          sortOrder: 0,
          isDefault: true
        }
      ],
      conversations: [
        {
          id: 'conversation-a',
          projectId: DEFAULT_PROJECT_ID,
          title: 'A',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z'
        }
      ],
      activeConversationId: 'missing'
    })

    expect(data.activeConversationId).toBe('conversation-a')
    expect(data.projects[0]?.isDefault).toBeUndefined()
  })

  it('keeps invalid active conversation empty when there are no conversations', () => {
    const data = sanitizeImageToolData({
      activeConversationId: 'missing'
    })

    expect(data.activeConversationId).toBeUndefined()
    expect(data.conversations).toEqual([])
  })

  it('sanitizes reference history metadata without keeping reference image payloads', () => {
    const data = sanitizeImageToolData({
      history: [
        {
          id: 'history-edit',
          taskId: 'task-edit',
          mode: 'image_reference',
          prompt: 'Edit this image',
          model: 'gpt-image-2',
          size: '1024x1024',
          referenceImages: [
            {
              name: 'reference.png',
              mimeType: 'image/png',
              size: 128,
              dataUrl: 'data:image/png;base64,secret-image-data'
            }
          ]
        }
      ]
    })

    expect(data.history[0]).toMatchObject({
      mode: 'image_reference',
      referenceImages: [
        {
          name: 'reference.png',
          mimeType: 'image/png',
          size: 128
        }
      ]
    })
    expect(JSON.stringify(data.history[0])).not.toContain('secret-image-data')
  })

  it('updates history without mutating original data', () => {
    const data = addImageHistoryItem(createDefaultImageToolData(), historyItem)
    const nextData = updateImageHistoryItem(data, historyItem.id, {
      imagePath: 'images/history-1.png',
      updatedAt: 2
    })

    expect(nextData.history[0]?.imagePath).toBe('images/history-1.png')
    expect(data.history[0]?.imagePath).toBeUndefined()
  })

  it('removes history by id', () => {
    const data = addImageHistoryItem(createDefaultImageToolData(), historyItem)
    const nextData = removeImageHistoryItem(data, historyItem.id)

    expect(nextData.history).toEqual([])
  })

  it('sanitizes partial data', () => {
    const data = sanitizeImageToolData({
      settings: {
        model: 'custom-image-model',
        quality: 'not-supported'
      },
      history: [
        {
          id: 'history-2',
          taskId: 'task-2',
          prompt: 'A city at dusk',
          model: 'gpt-image-2',
          size: '2160x3840'
        },
        {
          id: 'broken'
        }
      ]
    })

    expect(data.version).toBe(1)
    expect(data.settings.model).toBe('custom-image-model')
    expect(data.settings.quality).toBe('auto')
    expect(data.settings.providerTemplateId).toBe(COMPATIBLE_PROVIDER_TEMPLATE_ID)
    expect(data.settings.endpointPath).toBe('/v1/images/generations')
    expect(data.settings.editEndpointPath).toBe('/v1/images/edits')
    expect(data.settings.sendOutputFormat).toBe(true)
    expect(data.settings.sendResponseFormat).toBe(false)
    expect(data.settings.providerCredentials).toEqual({})
    expect(data.settings.customProviderTemplates).toEqual([])
    expect(data.history).toHaveLength(1)
    expect(data.history[0]?.size).toBe('2160x3840')
  })

  it('migrates a legacy global apiKey to the compatible provider credential', () => {
    const data = sanitizeImageToolData({
      settings: {
        providerTemplateId: COMPATIBLE_PROVIDER_TEMPLATE_ID,
        apiKey: 'legacy-key'
      }
    })

    expect(data.settings.providerTemplateId).toBe(COMPATIBLE_PROVIDER_TEMPLATE_ID)
    expect(data.settings.providerCredentials).toEqual({
      [COMPATIBLE_PROVIDER_TEMPLATE_ID]: {
        apiKey: 'legacy-key'
      }
    })
    expect('apiKey' in data.settings).toBe(false)
  })

  it('keeps provider credentials isolated by template id', () => {
    const data = sanitizeImageToolData({
      settings: {
        providerTemplateId: COMPATIBLE_PROVIDER_TEMPLATE_ID,
        providerCredentials: {
          [COMPATIBLE_PROVIDER_TEMPLATE_ID]: {
            apiKey: 'compatible-key'
          },
          'custom-fluxhub': {
            apiKey: 'fluxhub-key'
          }
        },
        customProviderTemplates: [
          {
            id: 'custom-fluxhub',
            name: 'FluxHub',
            defaultBaseUrl: 'https://api.openai.com',
            endpointPath: '/images/generations',
            editEndpointPath: '/v1/images/edits',
            model: 'gpt-image-2',
            sendOutputFormat: false,
            sendResponseFormat: false
          }
        ]
      }
    })

    expect(data.settings.providerCredentials[COMPATIBLE_PROVIDER_TEMPLATE_ID]?.apiKey).toBe('compatible-key')
    expect(data.settings.providerCredentials['custom-fluxhub']?.apiKey).toBe('fluxhub-key')
  })

  it('sets and clears a single provider credential without touching others', () => {
    const data = sanitizeImageToolData({
      settings: {
        providerCredentials: {
          [COMPATIBLE_PROVIDER_TEMPLATE_ID]: {
            apiKey: 'compatible-key'
          }
        }
      }
    })
    const withCustomCredential = setImageProviderCredential(data, 'custom-fluxhub', {
      apiKey: 'fluxhub-key'
    })
    const clearedCustomCredential = setImageProviderCredential(withCustomCredential, 'custom-fluxhub', {
      apiKey: ''
    })

    expect(withCustomCredential.settings.providerCredentials[COMPATIBLE_PROVIDER_TEMPLATE_ID]?.apiKey).toBe(
      'compatible-key'
    )
    expect(withCustomCredential.settings.providerCredentials['custom-fluxhub']?.apiKey).toBe('fluxhub-key')
    expect(clearedCustomCredential.settings.providerCredentials[COMPATIBLE_PROVIDER_TEMPLATE_ID]?.apiKey).toBe(
      'compatible-key'
    )
    expect(clearedCustomCredential.settings.providerCredentials['custom-fluxhub']).toBeUndefined()
  })

  it('does not fall back to another template credential when current template has no key', () => {
    const data = sanitizeImageToolData({
      settings: {
        providerTemplateId: 'custom-fluxhub',
        customProviderTemplates: [
          {
            id: 'custom-fluxhub',
            name: 'FluxHub',
            defaultBaseUrl: 'https://api.openai.com',
            endpointPath: '/images/generations',
            editEndpointPath: '/v1/images/edits',
            model: 'gpt-image-2',
            sendOutputFormat: false,
            sendResponseFormat: false
          }
        ],
        providerCredentials: {
          [COMPATIBLE_PROVIDER_TEMPLATE_ID]: {
            apiKey: 'compatible-key'
          }
        }
      }
    })

    expect(data.settings.providerCredentials[data.settings.providerTemplateId]).toBeUndefined()
    expect(data.settings.providerCredentials[COMPATIBLE_PROVIDER_TEMPLATE_ID]?.apiKey).toBe('compatible-key')
  })

  it('migrates the old official-compatible template id and preserves its credential', () => {
    const data = sanitizeImageToolData({
      settings: {
        providerTemplateId: 'openai-standard',
        baseUrl: 'https://api.openai.com',
        providerCredentials: {
          'openai-standard': {
            apiKey: 'official-key'
          }
        }
      }
    })

    expect(data.settings.providerTemplateId).toBe(COMPATIBLE_PROVIDER_TEMPLATE_ID)
    expect(data.settings.baseUrl).toBe('https://api.openai.com')
    expect(data.settings.providerCredentials[COMPATIBLE_PROVIDER_TEMPLATE_ID]?.apiKey).toBe('official-key')
    expect(data.settings.providerCredentials['openai-standard']).toBeUndefined()
  })

  it('migrates retired built-ins with credentials into user templates', () => {
    const data = sanitizeImageToolData({
      settings: {
        providerCredentials: {
          hubaobao: {
            apiKey: 'retired-key'
          },
          custom: {
            apiKey: 'custom-key'
          }
        }
      }
    })

    expect(data.settings.customProviderTemplates).toHaveLength(2)
    expect(data.settings.customProviderTemplates.every((template) => template.name === 'Migrated API')).toBe(true)
    expect(data.settings.customProviderTemplates.map((template) => template.id)).toEqual([
      'custom-legacy-custom',
      'custom-hubaobao'
    ])
    expect(data.settings.providerCredentials['custom-hubaobao']?.apiKey).toBe('retired-key')
    expect(data.settings.providerCredentials['custom-legacy-custom']?.apiKey).toBe('custom-key')
    expect(data.settings.providerCredentials.hubaobao).toBeUndefined()
    expect(data.settings.providerCredentials.custom).toBeUndefined()
  })

  it('migrates retired stored templates with credentials without duplicating them', () => {
    const data = sanitizeImageToolData({
      settings: {
        providerCredentials: {
          hubaobao: {
            apiKey: 'retired-key'
          }
        },
        customProviderTemplates: [
          {
            id: 'hubaobao',
            name: 'Legacy gateway',
            defaultBaseUrl: 'https://api.openai.com',
            endpointPath: '/proxy/images',
            editEndpointPath: '/proxy/edits',
            model: 'gpt-image-2',
            sendOutputFormat: false,
            sendResponseFormat: false
          }
        ]
      }
    })

    expect(data.settings.customProviderTemplates).toEqual([
      expect.objectContaining({
        id: 'custom-hubaobao',
        name: 'Migrated API',
        defaultBaseUrl: 'https://api.openai.com',
        endpointPath: '/proxy/images',
        editEndpointPath: '/proxy/edits'
      })
    ])
    expect(data.settings.providerCredentials['custom-hubaobao']?.apiKey).toBe('retired-key')
    expect(data.settings.providerCredentials.hubaobao).toBeUndefined()
  })

  it('cleans retired built-ins without credentials or user changes', () => {
    const data = sanitizeImageToolData({
      settings: {
        providerTemplateId: 'hubaobao',
        baseUrl: 'https://api.openai.com',
        endpointPath: '/v1/images/generations',
        editEndpointPath: '/v1/images/edits',
        model: 'gpt-image-2',
        sendOutputFormat: true,
        sendResponseFormat: false,
        customProviderTemplates: [
          {
            id: 'custom',
            name: 'Legacy empty',
            defaultBaseUrl: '',
            endpointPath: '/v1/images/generations',
            editEndpointPath: '/v1/images/edits',
            model: 'gpt-image-2',
            sendOutputFormat: false,
            sendResponseFormat: false
          }
        ]
      }
    })

    expect(data.settings.providerTemplateId).toBe(COMPATIBLE_PROVIDER_TEMPLATE_ID)
    expect(data.settings.baseUrl).toBe('https://api.openai.com')
    expect(data.settings.customProviderTemplates).toEqual([])
    expect(data.settings.providerCredentials).toEqual({})
  })

  it('cleans untouched retired direct templates without credentials', () => {
    const data = sanitizeImageToolData({
      settings: {
        providerTemplateId: 'jiekou-highway',
        baseUrl: 'https://api.openai.com',
        endpointPath: '/images/generations',
        editEndpointPath: '/v1/images/edits',
        model: 'gpt-image-2',
        sendOutputFormat: false,
        sendResponseFormat: false
      }
    })

    expect(data.settings.providerTemplateId).toBe(COMPATIBLE_PROVIDER_TEMPLATE_ID)
    expect(data.settings.customProviderTemplates).toEqual([])
    expect(data.settings.providerCredentials).toEqual({})
  })

  it('sanitizes endpoint template fields and user templates', () => {
    const data = sanitizeImageToolData({
      settings: {
        providerTemplateId: 'custom-fluxhub',
        baseUrl: 'https://api.openai.com',
        endpointPath: '/images/generations',
        editEndpointPath: 'v1/images/edits',
        sendOutputFormat: false,
        sendResponseFormat: false,
        responseFormat: 'url',
        customProviderTemplates: [
          {
            id: 'custom-fluxhub',
            name: 'FluxHub',
            description: 'Team image gateway',
            defaultBaseUrl: 'https://api.openai.com',
            endpointPath: 'images/generations',
            editEndpointPath: 'v1/images/edits',
            model: 'gpt-image-2',
            sendOutputFormat: false,
            outputFormat: 'jpeg',
            sendResponseFormat: false,
            responseFormat: 'url',
            apiKey: 'should-not-survive'
          }
        ]
      }
    })

    expect(data.settings.providerTemplateId).toBe('custom-fluxhub')
    expect(data.settings.baseUrl).toBe('https://api.openai.com')
    expect(data.settings.endpointPath).toBe('/images/generations')
    expect(data.settings.editEndpointPath).toBe('/v1/images/edits')
    expect(data.settings.sendOutputFormat).toBe(false)
    expect(data.settings.sendResponseFormat).toBe(false)
    expect(data.settings.responseFormat).toBe('url')
    expect(data.settings.customProviderTemplates).toHaveLength(1)
    expect(data.settings.customProviderTemplates[0]).toMatchObject({
      id: 'custom-fluxhub',
      name: 'FluxHub',
      defaultBaseUrl: 'https://api.openai.com',
      endpointPath: '/images/generations',
      editEndpointPath: '/v1/images/edits',
      model: 'gpt-image-2',
      sendOutputFormat: false,
      outputFormat: 'jpeg',
      sendResponseFormat: false,
      responseFormat: 'url'
    })
    expect('apiKey' in data.settings.customProviderTemplates[0]).toBe(false)
  })

  it('adds custom templates without saving apiKey', () => {
    const data = createDefaultImageToolData()
    const nextData = upsertCustomProviderTemplate(data, {
      id: 'custom-team-gateway',
      name: 'Team Gateway',
      defaultBaseUrl: 'https://api.openai.com',
      endpointPath: '/images/generations',
      editEndpointPath: '/v1/images/edits',
      model: 'gpt-image-2',
      sendOutputFormat: false,
      sendResponseFormat: false,
      apiKey: 'secret'
    } as never)

    expect(nextData.settings.customProviderTemplates).toHaveLength(1)
    expect(nextData.settings.customProviderTemplates[0]?.id).toBe('custom-team-gateway')
    expect('apiKey' in nextData.settings.customProviderTemplates[0]).toBe(false)
    expect(data.settings.customProviderTemplates).toEqual([])
  })

  it('removes custom templates and falls back when current template is deleted', () => {
    const data = sanitizeImageToolData({
      settings: {
        providerTemplateId: 'custom-team-gateway',
        baseUrl: 'https://api.openai.com',
        endpointPath: '/images/generations',
        editEndpointPath: '/v1/images/edits',
        model: 'gpt-image-2',
        sendOutputFormat: false,
        sendResponseFormat: false,
        customProviderTemplates: [
          {
            id: 'custom-team-gateway',
            name: 'Team Gateway',
            defaultBaseUrl: 'https://api.openai.com',
            endpointPath: '/images/generations',
            editEndpointPath: '/v1/images/edits',
            model: 'gpt-image-2',
            sendOutputFormat: false,
            sendResponseFormat: false
          }
        ],
        providerCredentials: {
          [COMPATIBLE_PROVIDER_TEMPLATE_ID]: {
            apiKey: 'compatible-key'
          },
          'custom-team-gateway': {
            apiKey: 'custom-key'
          }
        }
      }
    })
    const nextData = removeCustomProviderTemplate(data, 'custom-team-gateway')

    expect(nextData.settings.customProviderTemplates).toEqual([])
    expect(nextData.settings.providerTemplateId).toBe(COMPATIBLE_PROVIDER_TEMPLATE_ID)
    expect(nextData.settings.baseUrl).toBe('https://api.openai.com')
    expect(nextData.settings.endpointPath).toBe('/v1/images/generations')
    expect(nextData.settings.editEndpointPath).toBe('/v1/images/edits')
    expect(nextData.settings.model).toBe('gpt-image-2')
    expect(nextData.settings.sendOutputFormat).toBe(true)
    expect(nextData.settings.sendResponseFormat).toBe(false)
    expect(nextData.settings.providerCredentials[COMPATIBLE_PROVIDER_TEMPLATE_ID]?.apiKey).toBe('compatible-key')
    expect(nextData.settings.providerCredentials['custom-team-gateway']).toBeUndefined()
  })

  it('does not remove built-in provider templates', () => {
    const data = sanitizeImageToolData({
      settings: {
        providerTemplateId: 'openai-standard',
        customProviderTemplates: [
          {
            id: 'custom-team-gateway',
            name: 'Team Gateway',
            defaultBaseUrl: 'https://api.openai.com',
            endpointPath: '/images/generations',
            editEndpointPath: '/v1/images/edits',
            model: 'gpt-image-2',
            sendOutputFormat: false,
            sendResponseFormat: false
          }
        ]
      }
    })
    const nextData = removeCustomProviderTemplate(data, COMPATIBLE_PROVIDER_TEMPLATE_ID)

    expect(nextData).toBe(data)
    expect(nextData.settings.providerTemplateId).toBe(COMPATIBLE_PROVIDER_TEMPLATE_ID)
  })

  it('sanitizes file name parts', () => {
    expect(sanitizeFileNamePart('gpt/image:2 * 4K')).toBe('gpt-image-2-4K')
    expect(sanitizeFileNamePart('   ...   ')).toBe('untitled')
  })

  it('creates readable image file names with timestamp and task id', () => {
    const fileName = createImageFileName({
      createdAt: new Date(2026, 4, 24, 10, 30, 12).getTime(),
      taskId: 'a1b2c3d4-extra',
      model: 'gpt-image-2',
      size: '3840x2160',
      outputFormat: 'jpeg'
    })

    expect(fileName).toMatch(/^image-tool-20260524-103012-a1b2c3d4-3840x2160-gpt-image-2\.jpeg$/)
  })

  it('creates different file names for different task ids', () => {
    const firstFileName = createImageFileName({
      createdAt: 1,
      taskId: 'task-a',
      model: 'gpt-image-2',
      size: '3840x2160',
      outputFormat: 'png'
    })
    const secondFileName = createImageFileName({
      createdAt: 1,
      taskId: 'task-b',
      model: 'gpt-image-2',
      size: '3840x2160',
      outputFormat: 'png'
    })

    expect(firstFileName).not.toBe(secondFileName)
  })

  it('resolves jpeg/png/webp extensions', () => {
    expect(getImageFileExtension('png')).toBe('png')
    expect(getImageFileExtension('jpeg')).toBe('jpeg')
    expect(getImageFileExtension('webp')).toBe('webp')
    expect(getImageFileExtension('png', 'image/jpeg')).toBe('jpeg')
  })

  it('appends a numeric suffix when a file path already exists', () => {
    const imageDir = join('tmp', 'images')
    const existingPaths = new Set([join(imageDir, 'image.jpeg'), join(imageDir, 'image-2.jpeg')])
    const uniquePath = ensureUniqueFilePath(imageDir, 'image.jpeg', (filePath) => existingPaths.has(filePath))

    expect(uniquePath).toBe(join(imageDir, 'image-3.jpeg'))
  })
})
