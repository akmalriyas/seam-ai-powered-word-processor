import { app, BrowserWindow, ipcMain, clipboard, nativeImage, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import { loadConfig, saveConfig } from './settings.js'

const require = createRequire(import.meta.url)
const mammoth = require('mammoth')
const HTMLtoDOCX = require('html-to-docx')

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 750,
    frame: false,
    transparent: false,
    icon: path.join(process.env.VITE_PUBLIC, 'logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#00000000',
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    // win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(process.env.DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Window controls
ipcMain.handle('app-close', () => win?.close());
ipcMain.handle('app-minimize', () => win?.minimize());
ipcMain.handle('app-maximize', () => {
  if (win?.isMaximized()) win.restore();
  else win?.maximize();
});

// Clipboard
ipcMain.handle('clipboard-write', async (_, { html, text, imageBase64 }: { html: string, text: string, imageBase64?: string }) => {
  try {
    const data: any = { html, text };
    if (imageBase64) {
      data.image = nativeImage.createFromDataURL(imageBase64);
    }
    clipboard.write(data);
    return true;
  } catch (e) {
    console.error('Failed to write to native clipboard:', e);
    throw e;
  }
});

// Image fetch
ipcMain.handle('get-image-base64', async (_, url: string) => {
  try {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return `data:${response.headers.get('content-type')};base64,${base64}`;
  } catch (e) {
    console.error('Failed to fetch image in main process:', e);
    throw e;
  }
});

// ─── Native Project Operations (.seam) ───────────────────────────────────────────

// Save Project (.seam)
ipcMain.handle('file-save-project', async (_, { content, filePath }: { content: any, filePath?: string }) => {
  try {
    if (!win) return { success: false, error: 'No window' };

    let targetPath = filePath;

    if (!targetPath) {
      const result = await dialog.showSaveDialog(win, {
        title: 'Save Seam Project',
        defaultPath: 'Document.seam',
        filters: [{ name: 'Seam Project', extensions: ['seam'] }],
      });
      if (result.canceled || !result.filePath) return { success: false, canceled: true };
      targetPath = result.filePath;
    }

    // Save as minified JSON
    const data = JSON.stringify({
      version: '1.0',
      content,
      timestamp: Date.now(),
    });

    fs.writeFileSync(targetPath, data, 'utf-8');
    return { success: true, filePath: targetPath };
  } catch (e: any) {
    console.error('Failed to save project:', e);
    return { success: false, error: String(e?.message || e) };
  }
});

// Open Project / Import
ipcMain.handle('file-open-project', async () => {
  try {
    if (!win) return { success: false, error: 'No window' };

    const result = await dialog.showOpenDialog(win, {
      title: 'Open Document',
      filters: [
        { name: 'All Supported', extensions: ['seam', 'docx', 'doc', 'html', 'htm'] },
        { name: 'Seam Project', extensions: ['seam'] },
        { name: 'Word Document', extensions: ['docx', 'doc'] },
      ],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) return { success: false, canceled: true };

    const filePath = result.filePaths[0];
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.seam') {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const project = JSON.parse(raw);
      return { success: true, content: project.content, filePath, type: 'seam' };
    } else if (ext === '.docx' || ext === '.doc') {
      const buffer = fs.readFileSync(filePath);
      const convResult = await mammoth.convertToHtml({ buffer }, {
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Heading 4'] => h4:fresh",
          "p[style-name='Title'] => h1:fresh",
          "p[style-name='Subtitle'] => h2:fresh",
          "p[style-name='Quote'] => blockquote:fresh",
          "p[style-name='Intense Quote'] => blockquote:fresh",
          "p[style-name='List Paragraph'] => ul > li:fresh" // Crucial for parsing Word bullet points
        ]
      });
      return { success: true, html: convResult.value, filePath, type: 'docx' };
    } else {
      const htmlContent = fs.readFileSync(filePath, 'utf-8');
      return { success: true, html: htmlContent, filePath, type: 'html' };
    }
  } catch (e: any) {
    console.error('Failed to open project:', e);
    return { success: false, error: String(e?.message || e) };
  }
});

// ─── Export Operations ───────────────────────────────────────────────────────────

// Export as .docx
ipcMain.handle('file-export-docx', async (_, htmlContent: string) => {
  try {
    if (!win) return { success: false, error: 'No window' };

    const result = await dialog.showSaveDialog(win, {
      title: 'Export to Word',
      defaultPath: 'Export.docx',
      filters: [{ name: 'Word Document', extensions: ['docx'] }],
    });

    if (result.canceled || !result.filePath) return { success: false, canceled: true };

    // Preprocess the Tiptap HTML to remove proprietary UI wrappers that break DOCX conversion
    let cleanHtml = htmlContent
      .replace(/<div class="resizable-image-container[^>]*>([\s\S]*?)<\/div>/gi, '$1')
      .replace(/<div class="resizable-image-wrapper[^>]*>([\s\S]*?)<\/div>/gi, '$1')
      .replace(/<ul data-type="taskList">/gi, '<ul>')
      .replace(/<li data-checked="[^"]*">/gi, '<li>')
      .replace(/<label>[\s\S]*?<\/label>/gi, ''); // remove checkbox inputs

    const wrappedHtml = `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Inter', 'Helvetica', 'Arial', sans-serif; font-size: 12pt; color: #000000; }
          p { margin-bottom: 12pt; line-height: 1.5; color: #000000; }
          h1 { font-family: 'Inter', sans-serif; font-size: 24pt; font-weight: bold; margin-bottom: 16pt; color: #000000; }
          h2 { font-family: 'Inter', sans-serif; font-size: 18pt; font-weight: bold; margin-bottom: 12pt; color: #000000; }
          h3 { font-family: 'Inter', sans-serif; font-size: 14pt; font-weight: bold; margin-bottom: 10pt; color: #000000; }
          blockquote { border-left: 2px solid #7c8aff; padding-left: 12pt; font-style: italic; color: #555555; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 12pt; }
          th, td { border: 1pt solid #cbd5e1; padding: 6pt; }
          th { background-color: #f1f5f9; font-weight: bold; }
          img { max-width: 100%; }
        </style>
      </head>
      <body>${cleanHtml}</body>
    </html>`;
    
    const docxBuffer = await HTMLtoDOCX(wrappedHtml, null, {
      table: { row: { cantSplit: true } },
      footer: true,
      pageNumber: true,
    });
    fs.writeFileSync(result.filePath, Buffer.from(docxBuffer as ArrayBuffer));
    return { success: true, filePath: result.filePath };
  } catch (e: any) {
    console.error('Failed to export DOCX:', e);
    return { success: false, error: String(e?.message || e) };
  }
});

// Export as PDF
ipcMain.handle('file-export-pdf', async (_, layoutFormat: string = 'letter') => {
  try {
    if (!win) return { success: false, error: 'No window' };

    const pdfData = await win.webContents.printToPDF({
      pageSize: layoutFormat === 'a4' ? 'A4' : 'Letter',
      printBackground: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });

    const result = await dialog.showSaveDialog(win, {
      title: 'Export to PDF',
      defaultPath: 'Export.pdf',
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
    });

    if (result.canceled || !result.filePath) return { success: false, canceled: true };
    fs.writeFileSync(result.filePath, Buffer.from(pdfData as ArrayBuffer));
    return { success: true, filePath: result.filePath };
  } catch (e: any) {
    console.error('Failed to export PDF:', e);
    return { success: false, error: String(e?.message || e) };
  }
});

// Print physically
ipcMain.handle('file-print', async (_, layoutFormat: string = 'letter') => {
  try {
    if (!win) return { success: false, error: 'No window' };
    
    // Open standard OS print dialog.
    // The margin type "none" allows the web page's exact CSS margins (our page padding) to be the standard.
    win.webContents.print({ silent: false, printBackground: true, marginType: "none", pageSize: layoutFormat === 'a4' ? 'A4' : 'Letter' });
    
    return { success: true };
  } catch (e: any) {
    console.error('Failed to print:', e);
    return { success: false, error: String(e?.message || e) };
  }
});


// ─── AI Configuration & Remote Inference ────────────────────────────────────────┐

ipcMain.handle('ai:get-config', () => loadConfig());
ipcMain.handle('ai:save-config', (_, config) => saveConfig(config));

/**
 * Ensures the API URL follows the OpenAI /v1 format.
 * LM Studio and Ollama require the /v1 prefix for chat completions.
 */
function getSanitizedUrl(baseUrl: string) {
  let url = baseUrl.trim().replace(/\/+$/, '');
  if (!url.endsWith('/v1')) {
    url += '/v1';
  }
  return `${url}/chat/completions`;
}

ipcMain.handle('ai:test-connection', async (_, config) => {
  try {
    const url = getSanitizedUrl(config.baseUrl);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {})
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1
      })
    });
    return response.ok;
  } catch (err) {
    return false;
  }
});

ipcMain.handle('ai-chat-start', async (event, { messages, context, silent }) => {
  const config = loadConfig();
  try {
    const url = getSanitizedUrl(config.baseUrl);    // Identify the mode and tool type
    let chatMessages = [...messages];
    const rawContent = chatMessages[chatMessages.length - 1]?.content || '';
    
    // Safely extract string if it's a multi-part vision array
    const prompt = typeof rawContent === 'string' 
      ? rawContent 
      : (Array.isArray(rawContent) ? (rawContent.find((p: any) => p.type === 'text')?.text || '') : '');

    const isToolRequest = typeof prompt === 'string' && prompt.startsWith('[TOOL_REQUEST]');
    
    // Intelligent Routing: Switch personas based on the tool requested
    let systemPrompt = '';
    
    if (isToolRequest) {
      const toolMatch = prompt.match(/\[TOOL_REQUEST:([^\]]+)\]/);
      const toolType = toolMatch ? toolMatch[1] : 'GENERAL';
      const customInstruction = prompt.split('] ').pop() || '';

      const baseToolDirective = `You are a specialized text processing engine for the SEAM Word Processor.
Your ONLY task is to return the replacement content based on the user's request.
CRITICAL RULES:
1. Return ONLY the raw content (HTML/Text).
2. ABSOLUTELY NO preamble (e.g., "Sure!", "Here is...").
3. ABSOLUTELY NO postscript or explanations.
4. DO NOT use markdown code blocks (\\\`\\\`\\\`) or reasoning tags (<thought>).
5. Output MUST start with the first character of the replacement text.`;

      switch(toolType) {
        case 'IMPROVE_FLOW':
          systemPrompt = `${baseToolDirective}
Persona: Expert Editor.
Focus: Transitions, sentence variety, and elegant delivery.
Goal: Rewrite the selected text to flow naturally and professionally while maintaining the original meaning.`;
          break;
        case 'FIX_GRAMMAR':
          systemPrompt = `${baseToolDirective}
Persona: Precision Proofreader.
Focus: Technical accuracy, spelling, and punctuation.
Goal: Repair all errors while keeping the user's style identical. Do not rewrite for style.`;
          break;
        case 'SUMMARIZE':
          systemPrompt = `${baseToolDirective}
Persona: Master Synthesizer.
Focus: Core thesis and key points.
Goal: Condense the text into an insightful summary.`;
          break;
        case 'SIMPLIFY':
          systemPrompt = `${baseToolDirective}
Persona: Clarity Specialist.
Focus: Readability and jargon removal.
Goal: Make the text accessible and easy to digest.`;
          break;
        case 'EXPAND':
          systemPrompt = `${baseToolDirective}
Persona: Analytical Author.
Focus: Depth and logical extension.
Goal: Elaborate on the user's ideas with professional insight.`;
          break;
        case 'CUSTOM':
          systemPrompt = `${baseToolDirective}
Persona: Instruction Follower.
Instruction: ${customInstruction}
Goal: Apply the user's specific instruction to the selected text.`;
          break;
        default:
          systemPrompt = baseToolDirective;
      }
    } else {
      // Standard Chat Persona
      systemPrompt = `You are Seam, a world-class professional writing companion and chatbot.
Your goal is to help the user brainstorm, plan, and refine their document through conversation.
STYLE:
- Professional, helpful, and encouraging.
- Do NOT introduce yourself or use preambles like "As your writing companion" or "As an AI". Answer the user directly.
- Use <thought> tags at the beginning of your response for your internal reasoning and analysis.
- If you suggest specific document changes, wrap them in <action type="UPDATE">HTML</action> tags.
- Feel free to ask clarifying questions to better understand the user's goals.`;
    }

    // Ensure the system prompt is at the top
    if (chatMessages.length === 0 || chatMessages[0].role !== 'system') {
      chatMessages.unshift({ role: 'system', content: systemPrompt });
    } else {
      chatMessages[0].content = systemPrompt;
    }

    // Filter leading assistant greetings (but keep system and user context)
    const firstUserIndex = chatMessages.findIndex(m => m.role === 'user');
    if (firstUserIndex > 0) {
      const systemMsg = chatMessages[0];
      chatMessages = [systemMsg, ...chatMessages.slice(firstUserIndex)];
    }

    if (context && chatMessages.length > 1 && chatMessages[1].role === 'user') {
      const safeContext = context.length > 64000 ? context.substring(0, 64000) + '... [Context Truncated]' : context;
      chatMessages[1].content = `[GLOBAL_DOCUMENT_HTML_CONTEXT]\n${safeContext}\n\n[USER_REQUEST]\n${chatMessages[1].content}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {})
      },
      body: JSON.stringify({
        model: config.modelName || 'default',
        messages: chatMessages,
        stream: true,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error (${response.status}): ${errorText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    if (!reader) throw new Error("No response body");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') continue;

          try {
            const data = JSON.parse(dataStr);
            const content = data.choices[0]?.delta?.content || '';
            if (content) {
              fullText += content;
              
              // Backend Pre-Sanitizer: Strip common artifacts during streaming
              let sanitizedChunk = fullText
                .replace(/```[a-z]*\n?/gi, '') // Strip leading code fences
                .replace(/```/g, '') // Strip trailing code fences
                .replace(/^html\n/i, '') // Strip leading language labels
                .trimStart();

              if (isToolRequest) {
                sanitizedChunk = sanitizedChunk.replace(/<thought>[\s\S]*?<\/thought>/gi, ''); // Strip reasoning for tools
              }

              if (!silent) {
                event.sender.send('ai-chat-chunk', sanitizedChunk);
              }
            }
          } catch (e) {
            // Ignore parse errors for partial chunks
          }
        }
      }
    }

    // Final Post-Processing: Nuclear Scrubber
    // Recursively removes technical artifacts and labels until we reach actual content
    let result = fullText;

    const scrub = (text: string): string => {
      let output = text;
      
      // 1. Remove reasoning tags ONLY if it's a tool request
      if (isToolRequest) {
        output = output.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();
      }
      
      // 2. Remove common preamble/postscript patterns if it's a tool request
      if (isToolRequest) {
        const technicalLabels = /^(html|markdown|text|css|javascript|improved|revised|result|here is|here's|the text|the result|corrected|refined)[:\-\s\*\n]*/i;
        const codeFences = /^(\s*```[a-z]*\n?)/i;
        
        let changed = false;
        
        // Remove wrapping code blocks
        if (output.startsWith('```') && output.endsWith('```')) {
          output = output.replace(/^```[a-z]*\n?([\s\S]*?)```$/i, '$1').trim();
          changed = true;
        }
        
        // Remove leading labels (multi-pass)
        const labelMatch = output.match(technicalLabels);
        if (labelMatch) {
          output = output.replace(technicalLabels, '').trim();
          changed = true;
        }
        
        // Remove stray fences
        const fenceMatch = output.match(codeFences);
        if (fenceMatch) {
          output = output.replace(codeFences, '').trim();
          changed = true;
        }

        if (changed) return scrub(output); // Recurse until clean
      }
      
      return output;
    };

    result = scrub(result);
    fullText = result;

    if (!silent) {
      event.sender.send('ai-chat-end', fullText);
    }
    return { success: true, result: fullText };
  } catch (error: any) {
    console.error("AI Streaming Error:", error);
    return { success: false, error: error.message || String(error) };
  }
});
