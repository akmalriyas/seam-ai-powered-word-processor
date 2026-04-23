# Seam — The Intelligence-First Word Processor

![Seam Banner](public/logo.png)

Seam is a high-performance, AI-integrated word processor designed for the modern writer. Built with a focus on "Intelligence-First" workflows, Seam seamlessly bridges the gap between traditional professional writing and the power of Large Language Models.

---

## Core Intelligence Features

### Context-Aware Find & Semantic Search
Traditional search finds *words*; Seam finds *concepts*. Using the **Context AI** engine, you can describe a section of your document (e.g., *"The part where the protagonist questions their loyalty"*) and Seam will scan your entire text to locate, highlight, and navigate to the exact verbatim quote.

### Intelligence Overlay & Galaxy Sweep
Experience AI as a tangible part of your document. Seam features a custom **Intelligence Overlay** that provides real-time visual feedback during AI tasks. Watch the "Galaxy Sweep" animation as the model analyzes your text, or see "Processing Overlays" as it suggests refinements directly within your layout.

### True Local AI Support
Privacy and performance are paramount. Seam is designed to work with local inference engines like **Ollama**, **LM Studio**, and any **OpenAI-compatible local server**. Write with zero latency and full privacy by running your models locally, or connect to industry-standard remote APIs.

### Professional Multi-Tool Selection
Right-click any selection to access a suite of specialized AI tools:
- **Improve Flow:** Elegant sentence variety and professional delivery.
- **Fix Grammar:** Precision proofreading without style interference.
- **Expand/Simplify:** Intelligent depth adjustment for any paragraph.
- **Summarize:** Insightful synthesis of complex topics.

---

## Premium Aesthetics & UX

- **Liquid Glass Interface:** A stunning glassmorphic UI featuring `backdrop-blur`, vibrant accents, and smooth transitions built with **Framer Motion**.
- **Dynamic Context Menus:** Native-feeling, context-aware menus that adapt to your cursor and selection.
- **Micro-Animations:** Sublte visual cues that make the editor feel alive and responsive.

---

## Technical Architecture

- **Engine:** Built on **Electron** for native performance and file-system access.
- **Editor:** Powered by **Tiptap** & **ProseMirror** for rock-solid text editing.
- **Build System:** **Vite** with **React** & **TypeScript** for a modern, type-safe development experience.
- **Styling:** **Tailwind CSS** with a custom high-end design system.

---

## File Support & Native Operations

- **.seam Projects:** Native JSON-based project files for deep state preservation.
- **Word Documentation:** Full support for **importing and exporting .docx** files.
- **PDF Export:** High-fidelity PDF generation with professional layout mapping.
- **Native Clipboard:** Enhanced handling for rich text, HTML, and image data.

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- Local AI Server (Optional: Ollama or LM Studio)

### Installation
1. Clone the repository:
   ```bash
   git clone git@github.com:akmalriyas/seam-ai-powered-word-processor.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run in development:
   ```bash
   npm run dev
   ```

### Configuration
Go to **Settings** within Seam to configure your API endpoint. For local use with Ollama, set the base URL to `http://localhost:11434`.

---

## License
MIT License - Copyright (c) 2026 Akmal Riyas.