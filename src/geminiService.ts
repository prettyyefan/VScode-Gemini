import axios from 'axios';
import * as vscode from 'vscode';

export interface GeminiResponse {
    candidates: Array<{
        content: {
            parts: Array<{
                text: string;
            }>;
        };
    }>;
}

export class GeminiService {
    private apiKey: string = '';
    private model: string = 'gemini-1.5-flash';
    private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

    constructor() {
        this.updateConfig();
    }

    public updateConfig(): void {
        const config = vscode.workspace.getConfiguration('vscode-gemini');
        this.apiKey = config.get<string>('apiKey') || '';
        this.model = config.get<string>('model') || 'gemini-1.5-flash';
    }

    public async generateContent(prompt: string): Promise<string> {
        if (!this.apiKey) {
            throw new Error('请先在设置中配置Gemini API Key');
        }

        const url = `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`;
        
        const requestBody = {
            contents: [
                {
                    parts: [
                        {
                            text: prompt
                        }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.7,
                // 移除maxOutputTokens限制，让API返回完整回答
            }
        };

        try {
            const response = await axios.post<GeminiResponse>(url, requestBody, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            if (response.data.candidates && response.data.candidates.length > 0) {
                const content = response.data.candidates[0].content;
                if (content.parts && content.parts.length > 0) {
                    return content.parts[0].text;
                }
            }

            throw new Error('未收到有效的AI响应');
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 401) {
                    throw new Error('API Key无效，请检查配置');
                } else if (error.response?.status === 429) {
                    throw new Error('API调用频率过高，请稍后重试');
                } else if (error.code === 'ECONNABORTED') {
                    throw new Error('请求超时，请检查网络连接');
                }
                throw new Error(`API请求失败: ${error.response?.data?.error?.message || error.message}`);
            }
            throw error;
        }
    }

    public async askAboutCode(code: string, question: string): Promise<string> {
        const prompt = `
请分析代码并回答问题：

代码：
\`\`\`
${code}
\`\`\`

问题：${question}

要求：用中文详细回答问题，提供完整和有用的信息。
        `;

        return this.generateContent(prompt);
    }

    public async explainCode(code: string): Promise<string> {
        const prompt = `
请分析以下代码并用中文解释：

\`\`\`
${code}
\`\`\`

要求：
1. 简洁清晰地说明代码的主要功能
2. 解释关键的实现逻辑
3. 提供完整的分析，但保持语言简洁
        `;

        return this.generateContent(prompt);
    }
} 