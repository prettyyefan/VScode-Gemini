import * as vscode from 'vscode';
import { TerminalManager } from './terminalManager';

export class InputHandler {
    private terminalManager: TerminalManager;

    constructor(terminalManager: TerminalManager) {
        this.terminalManager = terminalManager;
    }

    public async promptUserForQuestion(): Promise<void> {
        const question = await vscode.window.showInputBox({
            prompt: '🤖 请输入您的问题',
            placeHolder: '例如：如何优化这段代码？',
            ignoreFocusOut: true
        });

        if (question) {
            await this.terminalManager.handleUserInput(question);
        }
    }

    public async promptUserForCodeQuestion(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('请先打开一个文件并选择要分析的代码');
            return;
        }

        const selection = editor.selection;
        let code: string;

        if (selection.isEmpty) {
            const line = editor.document.lineAt(selection.start.line);
            code = line.text.trim();
            if (!code) {
                vscode.window.showWarningMessage('当前行为空，请选择要分析的代码');
                return;
            }
        } else {
            code = editor.document.getText(selection);
        }

        const question = await vscode.window.showInputBox({
            prompt: '🤖 关于选中的代码，您想了解什么？',
            placeHolder: '例如：这段代码的作用是什么？如何优化？',
            ignoreFocusOut: true
        });

        if (question) {
            await this.terminalManager.handleCodeQuestion(code, question);
        }
    }

    public async startInteractiveSession(): Promise<void> {
        // 创建AI终端
        await this.terminalManager.createAITerminal();

        // 显示使用说明
        const choice = await vscode.window.showInformationMessage(
            '🤖 Gemini AI 助手已启动！使用以下方式与AI交互：',
            {modal: false},
            '💬 提问',
            '📝 分析代码',
            '📚 查看帮助'
        );

        switch (choice) {
            case '💬 提问':
                await this.promptUserForQuestion();
                break;
            case '📝 分析代码':
                await this.promptUserForCodeQuestion();
                break;
            case '📚 查看帮助':
                await this.terminalManager.showHelp();
                break;
        }
    }

    public dispose(): void {
        // 清理资源
    }
} 