const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Window controls
  close: () => ipcRenderer.invoke('app-close'),
  minimize: () => ipcRenderer.invoke('app-minimize'),
  maximize: () => ipcRenderer.invoke('app-maximize'),

  // Clipboard & images
  getImageBase64: (url: string) => ipcRenderer.invoke('get-image-base64', url),
  clipboardWrite: (data: { html: string, text: string, imageBase64?: string }) => ipcRenderer.invoke('clipboard-write', data),

  // File & Project operations
  openProject: () => ipcRenderer.invoke('file-open-project'),
  saveProject: (content: any, filePath?: string) => ipcRenderer.invoke('file-save-project', { content, filePath }),
  
  // Export operations
  exportDocx: (htmlContent: string) => ipcRenderer.invoke('file-export-docx', htmlContent),
  exportPDF: (layoutFormat: string) => ipcRenderer.invoke('file-export-pdf', layoutFormat),
  print: (layoutFormat: string) => ipcRenderer.invoke('file-print', layoutFormat),

  // AI Integration (Remote/LM Studio)
  processAIChat: async (messages: any[], context?: string, silent: boolean = false) => {
    return ipcRenderer.invoke('ai-chat-start', { messages, context, silent });
  },
  onAIChatChunk: (callback: (chunk: string) => void) => {
    const listener = (_: any, chunk: string) => callback(chunk);
    ipcRenderer.on('ai-chat-chunk', listener);
    return () => ipcRenderer.removeListener('ai-chat-chunk', listener);
  },
  onAIChatEnd: (callback: (finalText: string) => void) => {
    const listener = (_: any, finalText: string) => callback(finalText);
    ipcRenderer.on('ai-chat-end', listener);
    return () => ipcRenderer.removeListener('ai-chat-end', listener);
  },
  getAIConfig: () => ipcRenderer.invoke('ai:get-config'),
  saveAIConfig: (config: any) => ipcRenderer.invoke('ai:save-config', config),
  testAIConnection: (config: any) => ipcRenderer.invoke('ai:test-connection', config)
});
