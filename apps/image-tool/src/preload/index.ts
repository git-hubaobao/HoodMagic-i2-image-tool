import { contextBridge, ipcRenderer, webUtils } from 'electron'

import type {
  ImageToolEditImage2Request,
  ImageToolGenerateImage2Request,
  ImageToolGenerateImage2Result,
  ImageToolHistoryItem,
  ImageToolImageTask,
  ImageToolImageTaskEvent,
  ImageToolImageTaskEventCallback,
  ImageToolPersistedSettings,
  ImageToolPromptTemplate,
  ImageToolPromptTemplateCategory,
  ImageToolPromptTemplateCategoryInput,
  ImageToolPromptTemplateExportResult,
  ImageToolPromptTemplateImportResult,
  ImageToolPromptTemplateInput,
  ImageToolSaveImageResultAsPromptTemplateInput,
  ImageToolSessionState,
  ImageToolTestConnectionRequest,
  ImageToolTestConnectionResult
} from '../shared/image2'

console.info('[image-tool preload] loaded')

contextBridge.exposeInMainWorld('imageTool', {
  generateImage2: (request: ImageToolGenerateImage2Request): Promise<ImageToolGenerateImage2Result> => {
    return ipcRenderer.invoke('image-tool:generate-image2', request) as Promise<ImageToolGenerateImage2Result>
  },
  testImage2Connection: (request: ImageToolTestConnectionRequest): Promise<ImageToolTestConnectionResult> => {
    return ipcRenderer.invoke('image-tool:test-image2-connection', request) as Promise<ImageToolTestConnectionResult>
  },
  createImage2Task: (request: ImageToolGenerateImage2Request): Promise<ImageToolImageTask> => {
    return ipcRenderer.invoke('image-tool:create-image2-task', request) as Promise<ImageToolImageTask>
  },
  createImageEditTask: (request: ImageToolEditImage2Request): Promise<ImageToolImageTask> => {
    return ipcRenderer.invoke('image-tool:create-image-edit-task', request) as Promise<ImageToolImageTask>
  },
  getImageTask: (taskId: string): Promise<ImageToolImageTask | undefined> => {
    return ipcRenderer.invoke('image-tool:get-image-task', taskId) as Promise<ImageToolImageTask | undefined>
  },
  listImageTasks: (): Promise<ImageToolImageTask[]> => {
    return ipcRenderer.invoke('image-tool:list-image-tasks') as Promise<ImageToolImageTask[]>
  },
  getSessionState: (): Promise<ImageToolSessionState> => {
    return ipcRenderer.invoke('image-tool:get-session-state') as Promise<ImageToolSessionState>
  },
  createConversation: (projectId?: string | null): Promise<ImageToolSessionState> => {
    return ipcRenderer.invoke('image-tool:create-conversation', projectId) as Promise<ImageToolSessionState>
  },
  setActiveConversation: (conversationId: string): Promise<ImageToolSessionState> => {
    return ipcRenderer.invoke('image-tool:set-active-conversation', conversationId) as Promise<ImageToolSessionState>
  },
  renameConversation: (conversationId: string, title: string): Promise<ImageToolSessionState> => {
    return ipcRenderer.invoke('image-tool:rename-conversation', conversationId, title) as Promise<ImageToolSessionState>
  },
  moveConversationToProject: (conversationId: string, projectId: string | null): Promise<ImageToolSessionState> => {
    return ipcRenderer.invoke(
      'image-tool:move-conversation-to-project',
      conversationId,
      projectId
    ) as Promise<ImageToolSessionState>
  },
  deleteConversation: (conversationId: string): Promise<ImageToolSessionState> => {
    return ipcRenderer.invoke('image-tool:delete-conversation', conversationId) as Promise<ImageToolSessionState>
  },
  restoreConversation: (conversationId: string): Promise<ImageToolSessionState> => {
    return ipcRenderer.invoke('image-tool:restore-conversation', conversationId) as Promise<ImageToolSessionState>
  },
  permanentlyDeleteConversation: (conversationId: string): Promise<ImageToolSessionState> => {
    return ipcRenderer.invoke(
      'image-tool:permanently-delete-conversation',
      conversationId
    ) as Promise<ImageToolSessionState>
  },
  createProject: (name: string): Promise<ImageToolSessionState> => {
    return ipcRenderer.invoke('image-tool:create-project', name) as Promise<ImageToolSessionState>
  },
  renameProject: (projectId: string, name: string): Promise<ImageToolSessionState> => {
    return ipcRenderer.invoke('image-tool:rename-project', projectId, name) as Promise<ImageToolSessionState>
  },
  deleteProject: (projectId: string): Promise<ImageToolSessionState> => {
    return ipcRenderer.invoke('image-tool:delete-project', projectId) as Promise<ImageToolSessionState>
  },
  getSettings: (): Promise<ImageToolPersistedSettings> => {
    return ipcRenderer.invoke('image-tool:get-settings') as Promise<ImageToolPersistedSettings>
  },
  saveSettings: (settings: ImageToolPersistedSettings): Promise<ImageToolPersistedSettings> => {
    return ipcRenderer.invoke('image-tool:save-settings', settings) as Promise<ImageToolPersistedSettings>
  },
  listHistory: (conversationId?: string): Promise<ImageToolHistoryItem[]> => {
    return ipcRenderer.invoke('image-tool:list-history', conversationId) as Promise<ImageToolHistoryItem[]>
  },
  deleteHistoryItem: (id: string): Promise<void> => {
    return ipcRenderer.invoke('image-tool:delete-history-item', id) as Promise<void>
  },
  readHistoryImage: (id: string): Promise<string | undefined> => {
    return ipcRenderer.invoke('image-tool:read-history-image', id) as Promise<string | undefined>
  },
  listPromptTemplates: (): Promise<ImageToolPromptTemplate[]> => {
    return ipcRenderer.invoke('image-tool:list-prompt-templates') as Promise<ImageToolPromptTemplate[]>
  },
  savePromptTemplate: (template: ImageToolPromptTemplateInput): Promise<ImageToolPromptTemplate> => {
    return ipcRenderer.invoke('image-tool:save-prompt-template', template) as Promise<ImageToolPromptTemplate>
  },
  deletePromptTemplate: (templateId: string): Promise<void> => {
    return ipcRenderer.invoke('image-tool:delete-prompt-template', templateId) as Promise<void>
  },
  listPromptTemplateCategories: (): Promise<ImageToolPromptTemplateCategory[]> => {
    return ipcRenderer.invoke('image-tool:list-prompt-template-categories') as Promise<
      ImageToolPromptTemplateCategory[]
    >
  },
  savePromptTemplateCategory: (
    category: ImageToolPromptTemplateCategoryInput
  ): Promise<ImageToolPromptTemplateCategory> => {
    return ipcRenderer.invoke(
      'image-tool:save-prompt-template-category',
      category
    ) as Promise<ImageToolPromptTemplateCategory>
  },
  deletePromptTemplateCategory: (categoryId: string): Promise<void> => {
    return ipcRenderer.invoke('image-tool:delete-prompt-template-category', categoryId) as Promise<void>
  },
  importPromptTemplateFile: (filePath: string): Promise<ImageToolPromptTemplateImportResult> => {
    return ipcRenderer.invoke(
      'image-tool:import-prompt-template-file',
      filePath
    ) as Promise<ImageToolPromptTemplateImportResult>
  },
  importPromptTemplateFileContent: (
    fileName: string,
    rawDocument: string
  ): Promise<ImageToolPromptTemplateImportResult> => {
    return ipcRenderer.invoke(
      'image-tool:import-prompt-template-file-content',
      fileName,
      rawDocument
    ) as Promise<ImageToolPromptTemplateImportResult>
  },
  getFilePath: (file: File): string => {
    return webUtils.getPathForFile(file)
  },
  exportPromptTemplate: (templateId: string): Promise<ImageToolPromptTemplateExportResult> => {
    return ipcRenderer.invoke(
      'image-tool:export-prompt-template',
      templateId
    ) as Promise<ImageToolPromptTemplateExportResult>
  },
  exportPromptTemplateCategory: (categoryId: string): Promise<ImageToolPromptTemplateExportResult> => {
    return ipcRenderer.invoke(
      'image-tool:export-prompt-template-category',
      categoryId
    ) as Promise<ImageToolPromptTemplateExportResult>
  },
  exportAllPromptTemplates: (): Promise<ImageToolPromptTemplateExportResult> => {
    return ipcRenderer.invoke('image-tool:export-all-prompt-templates') as Promise<ImageToolPromptTemplateExportResult>
  },
  scanPromptTemplateImports: (): Promise<ImageToolPromptTemplateImportResult> => {
    return ipcRenderer.invoke('image-tool:scan-prompt-template-imports') as Promise<ImageToolPromptTemplateImportResult>
  },
  openPromptTemplateFolder: (): Promise<string> => {
    return ipcRenderer.invoke('image-tool:open-prompt-template-folder') as Promise<string>
  },
  saveImageResultAsPromptTemplate: (
    input: ImageToolSaveImageResultAsPromptTemplateInput
  ): Promise<ImageToolPromptTemplate> => {
    return ipcRenderer.invoke(
      'image-tool:save-image-result-as-prompt-template',
      input
    ) as Promise<ImageToolPromptTemplate>
  },
  onImageTaskEvent: (callback: ImageToolImageTaskEventCallback): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, taskEvent: ImageToolImageTaskEvent) => {
      callback(taskEvent)
    }

    ipcRenderer.on('image-tool:image-task-event', listener)
    return () => {
      ipcRenderer.removeListener('image-tool:image-task-event', listener)
    }
  }
})
