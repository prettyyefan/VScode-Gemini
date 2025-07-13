import * as vscode from 'vscode';
import { GeminiService } from './geminiService';

export class TerminalManager {
    private geminiService: GeminiService;
    private aiTerminal: vscode.Terminal | undefined;
    private isWaitingForInput = false;
    private currentConversation: Array<{role: 'user' | 'assistant', content: string}> = [];
    private lastDisplayedResponse: string = '';
    private isProcessingResponse = false;
    private isAIRequestInProgress = false;
    private outputChannel: vscode.OutputChannel;

    constructor(geminiService: GeminiService) {
        this.geminiService = geminiService;
        this.outputChannel = vscode.window.createOutputChannel('Gemini AI 助手');
    }

    public async createAITerminal(): Promise<vscode.Terminal> {
        // 如果已有AI终端且仍然活跃，则直接使用
        if (this.aiTerminal && this.isTerminalActive(this.aiTerminal)) {
            this.aiTerminal.show();
            return this.aiTerminal;
        }

        // 关闭旧的终端（如果存在）
        if (this.aiTerminal) {
            this.aiTerminal.dispose();
        }

        // 重置状态
        this.isAIRequestInProgress = false;
        this.isProcessingResponse = false;
        this.lastDisplayedResponse = '';

        // 创建新的AI终端
        this.aiTerminal = vscode.window.createTerminal({
            name: '🤖 Gemini AI 助手',
            iconPath: new vscode.ThemeIcon('robot'),
            color: new vscode.ThemeColor('terminal.ansiGreen')
        });

        this.aiTerminal.show();
        this.initializeTerminal();
        
        return this.aiTerminal;
    }

    private initializeTerminal(): void {
        if (!this.aiTerminal) {
            return;
        }

        // 清屏并显示欢迎信息
        this.aiTerminal.sendText('clear', true);
        this.aiTerminal.sendText('Write-Host "🤖 欢迎使用 Gemini AI 智能助手！"', true);
        this.aiTerminal.sendText('Write-Host "💡 使用方法："', true);
        this.aiTerminal.sendText('Write-Host "  - 直接输入问题，AI会为您回答"', true);
        this.aiTerminal.sendText('Write-Host "  - 选中代码后使用 Ctrl+Shift+G 快速分析"', true);
        this.aiTerminal.sendText('Write-Host "  - 输入 help 查看更多命令"', true);
        this.aiTerminal.sendText('Write-Host "  - 输入 clear 清除对话历史"', true);
        this.aiTerminal.sendText('Write-Host "  - 输入 exit 退出AI助手"', true);
        this.aiTerminal.sendText('Write-Host "----------------------------------------"', true);
        this.showPrompt();
    }

    private showPrompt(): void {
        if (this.aiTerminal) {
            this.aiTerminal.sendText('Write-Host "🤖 AI> " -NoNewline', false);
            this.isWaitingForInput = true;
        }
    }

    private isTerminalActive(terminal: vscode.Terminal): boolean {
        return vscode.window.terminals.includes(terminal);
    }

    public async handleUserInput(input: string): Promise<void> {
        if (!this.aiTerminal || !this.isWaitingForInput) {
            return;
        }

        this.isWaitingForInput = false;
        const trimmedInput = input.trim();

        if (!trimmedInput) {
            this.showPrompt();
            return;
        }

        // 处理特殊命令
        switch (trimmedInput.toLowerCase()) {
            case 'help':
                this.showHelp();
                return;
            case 'clear':
                this.clearConversation();
                return;
            case 'exit':
                this.aiTerminal.sendText('Write-Host "👋 再见！AI助手已退出。"', true);
                this.aiTerminal.dispose();
                return;
        }

        // 显示用户输入
        this.aiTerminal.sendText(`Write-Host "👤 您: ${trimmedInput}"`, true);
        
        // 显示思考中提示
        this.aiTerminal.sendText('Write-Host "🤔 AI正在思考中..."', true);

        // 防止重复请求
        if (this.isAIRequestInProgress) {
            return;
        }

        try {
            this.isAIRequestInProgress = true;
            
            // 调用AI服务
            const response = await this.geminiService.generateContent(trimmedInput);
            
            // 记录对话
            this.currentConversation.push({role: 'user', content: trimmedInput});
            this.currentConversation.push({role: 'assistant', content: response});

            // 显示AI回答（处理多行回答）
            this.displayAIResponse(response);
            
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : '未知错误';
            this.aiTerminal.sendText(`Write-Host "❌ 错误: ${errorMsg}"`, true);
        } finally {
            this.isAIRequestInProgress = false;
        }
        this.showPrompt();
    }

    private displayAIResponse(response: string): void {
        if (this.isProcessingResponse) {
            return;
        }

        // 防止重复处理相同的响应
        this.isProcessingResponse = true;

        // 简化AI回答，去除多余的格式化
        let cleanResponse = response
            .replace(/\*\*/g, '')  // 移除markdown粗体标记
            .replace(/\*/g, '•')   // 将星号替换为点号
            .replace(/`([^`]*)`/g, "'$1'")  // 将反引号包围的内容替换为单引号
            .replace(/\n\s*\n/g, '\n')  // 将多个空行合并为一个换行
            .trim();

        // 去除明显重复的句子（只去重完全相同的句子）
        const sentences = cleanResponse.split(/([。！？.!?])/).filter(s => s.trim());
        let processedSentences: string[] = [];
        
        for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i];
            // 只去重完全相同且较长的句子（10字符以上）
            if (sentence.length > 10) {
                const isDuplicate = processedSentences.some(prev => 
                    prev.length > 10 && prev.trim() === sentence.trim()
                );
                if (!isDuplicate) {
                    processedSentences.push(sentence);
                }
            } else {
                processedSentences.push(sentence);
            }
        }
        
        cleanResponse = processedSentences.join('');

        // 检查是否与上次显示的响应相同
        if (cleanResponse === this.lastDisplayedResponse) {
            this.isProcessingResponse = false;
            return; // 跳过重复的响应
        }

        // 记录本次响应
        this.lastDisplayedResponse = cleanResponse;

        // 在输出通道显示AI回答（更可靠，无重复）
        this.outputChannel.clear();
        this.outputChannel.appendLine('🤖 Gemini AI 助手回答:');
        this.outputChannel.appendLine('=' .repeat(50));
        this.outputChannel.appendLine(cleanResponse);
        this.outputChannel.appendLine('=' .repeat(50));
        this.outputChannel.show(true); // 显示但不聚焦

        // 在终端也显示简短提示
        if (this.aiTerminal) {
            this.aiTerminal.sendText(`Write-Host "🤖 AI回答已显示在输出面板中，请查看!"`, true);
        }
        
        // 重置处理标志
        setTimeout(() => {
            this.isProcessingResponse = false;
        }, 100);
    }



    public showHelp(): void {
        if (!this.aiTerminal) {
            return;
        }

        this.aiTerminal.sendText('Write-Host "📚 Gemini AI 助手帮助文档："', true);
        this.aiTerminal.sendText('Write-Host "🔧 可用命令："', true);
        this.aiTerminal.sendText('Write-Host "  help    - 显示此帮助信息"', true);
        this.aiTerminal.sendText('Write-Host "  clear   - 清除对话历史"', true);
        this.aiTerminal.sendText('Write-Host "  exit    - 退出AI助手"', true);
        this.aiTerminal.sendText('Write-Host "💡 使用技巧："', true);
        this.aiTerminal.sendText('Write-Host "  - 可以询问编程问题、代码解释、调试建议等"', true);
        this.aiTerminal.sendText('Write-Host "  - 支持多轮对话，AI会记住之前的上下文"', true);
        this.aiTerminal.sendText('Write-Host "  - 选中代码后使用快捷键可快速分析代码"', true);
        this.showPrompt();
    }

    private clearConversation(): void {
        if (!this.aiTerminal) {
            return;
        }

        this.currentConversation = [];
        this.aiTerminal.sendText('clear', true);
        this.aiTerminal.sendText('Write-Host "🧹 对话历史已清除！"', true);
        this.showPrompt();
    }

    public async analyzeSelectedCode(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('请先打开一个文件并选择要分析的代码');
            return;
        }

        const selection = editor.selection;
        let code: string;

        if (selection.isEmpty) {
            // 如果没有选中文本，分析当前行
            const line = editor.document.lineAt(selection.start.line);
            code = line.text.trim();
            if (!code) {
                vscode.window.showWarningMessage('当前行为空，请选择要分析的代码');
                return;
            }
        } else {
            // 获取选中的代码
            code = editor.document.getText(selection);
        }

        // 确保AI终端存在
        await this.createAITerminal();

        if (!this.aiTerminal) {
            return;
        }

        // 显示正在分析的代码
        this.aiTerminal.sendText('Write-Host "📝 正在分析以下代码："', true);
        this.aiTerminal.sendText('Write-Host "----------------------------------------"', true);
        
        const codeLines = code.split('\n');
        for (const line of codeLines) {
            const safeLine = line.replace(/"/g, '""').replace(/`/g, "'");
            this.aiTerminal.sendText(`Write-Host "${safeLine}"`, true);
        }
        
        this.aiTerminal.sendText('Write-Host "----------------------------------------"', true);
        this.aiTerminal.sendText('Write-Host "🤔 AI正在分析中..."', true);

        // 防止重复请求
        if (this.isAIRequestInProgress) {
            return;
        }

        try {
            this.isAIRequestInProgress = true;
            const analysis = await this.geminiService.explainCode(code);
            this.displayAIResponse(analysis);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : '代码分析失败';
            this.aiTerminal.sendText(`Write-Host "❌ 错误: ${errorMsg}"`, true);
        } finally {
            this.isAIRequestInProgress = false;
        }

        this.showPrompt();
    }

    public async handleCodeQuestion(code: string, question: string): Promise<void> {
        // 确保AI终端存在
        await this.createAITerminal();

        if (!this.aiTerminal) {
            return;
        }

        // 显示正在分析的代码和问题
        this.aiTerminal.sendText('Write-Host "📝 代码分析问题："', true);
        this.aiTerminal.sendText(`Write-Host "❓ ${question}"`, true);
        this.aiTerminal.sendText('Write-Host "📄 相关代码："', true);
        this.aiTerminal.sendText('Write-Host "----------------------------------------"', true);
        
        const codeLines = code.split('\n');
        for (const line of codeLines) {
            const safeLine = line.replace(/"/g, '""').replace(/`/g, "'");
            this.aiTerminal.sendText(`Write-Host "${safeLine}"`, true);
        }
        
        this.aiTerminal.sendText('Write-Host "----------------------------------------"', true);
        this.aiTerminal.sendText('Write-Host "🤔 AI正在分析中..."', true);

        // 防止重复请求
        if (this.isAIRequestInProgress) {
            return;
        }

        try {
            this.isAIRequestInProgress = true;
            const response = await this.geminiService.askAboutCode(code, question);
            
            // 记录对话
            this.currentConversation.push({role: 'user', content: `关于代码的问题: ${question}`});
            this.currentConversation.push({role: 'assistant', content: response});

            this.displayAIResponse(response);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : '代码分析失败';
            this.aiTerminal.sendText(`Write-Host "❌ 错误: ${errorMsg}"`, true);
        } finally {
            this.isAIRequestInProgress = false;
        }

        this.showPrompt();
    }

    public dispose(): void {
        if (this.aiTerminal) {
            this.aiTerminal.dispose();
        }
        if (this.outputChannel) {
            this.outputChannel.dispose();
        }
    }
} 