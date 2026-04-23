import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export interface AIConfig {
    provider: 'lmstudio' | 'ollama' | 'openai' | 'custom';
    baseUrl: string;
    apiKey: string;
    modelName: string;
    isConfigured: boolean;
}

const DEFAULT_CONFIG: AIConfig = {
    provider: 'lmstudio',
    baseUrl: 'http://localhost:1234/v1',
    apiKey: '',
    modelName: '',
    isConfigured: false,
};

export const PRESETS: Record<string, Partial<AIConfig>> = {
    lmstudio: {
        baseUrl: 'http://localhost:1234/v1',
        provider: 'lmstudio'
    },
    ollama: {
        baseUrl: 'http://localhost:11434/v1',
        provider: 'ollama'
    },
    openai: {
        baseUrl: 'https://api.openai.com/v1',
        provider: 'openai'
    }
};

const getConfigPath = () => path.join(app.getPath('userData'), 'ai-config.json');

export function loadConfig(): AIConfig {
    try {
        const configPath = getConfigPath();
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf-8');
            return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
        }
    } catch (err) {
        console.error('Error loading AI config:', err);
    }
    return DEFAULT_CONFIG;
}

export function saveConfig(config: AIConfig) {
    try {
        const configPath = getConfigPath();
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (err) {
        console.error('Error saving AI config:', err);
    }
}
