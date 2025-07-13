// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { GeminiService } from './geminiService';
import { TerminalManager } from './terminalManager';
import { InputHandler } from './inputHandler';

let geminiService: GeminiService;
let terminalManager: TerminalManager;
let inputHandler: InputHandler;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "vscode-gemini" is now active!');

	// 初始化服务
	geminiService = new GeminiService();
	terminalManager = new TerminalManager(geminiService);
	inputHandler = new InputHandler(terminalManager);

	// 监听配置变化
	const configChangeListener = vscode.workspace.onDidChangeConfiguration(event => {
		if (event.affectsConfiguration('vscode-gemini')) {
			geminiService.updateConfig();
		}
	});

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposableHelloWorld = vscode.commands.registerCommand('vscode-gemini.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from Vscode-Gemini!');
	});

	// 启动AI聊天终端
	const disposableStartAIChat = vscode.commands.registerCommand('vscode-gemini.startAIChat', async () => {
		try {
			// 检查API Key配置
			const config = vscode.workspace.getConfiguration('vscode-gemini');
			const apiKey = config.get<string>('apiKey');
			
			if (!apiKey) {
				const choice = await vscode.window.showWarningMessage(
					'请先配置Gemini API Key',
					'打开设置'
				);
				if (choice === '打开设置') {
					vscode.commands.executeCommand('workbench.action.openSettings', 'vscode-gemini.apiKey');
				}
				return;
			}

			await inputHandler.startInteractiveSession();
		} catch (error) {
			vscode.window.showErrorMessage(`启动AI助手失败: ${error instanceof Error ? error.message : '未知错误'}`);
		}
	});

	// 快速提问
	const disposableAskQuestion = vscode.commands.registerCommand('vscode-gemini.askQuestion', async () => {
		try {
			// 检查API Key配置
			const config = vscode.workspace.getConfiguration('vscode-gemini');
			const apiKey = config.get<string>('apiKey');
			
			if (!apiKey) {
				const choice = await vscode.window.showWarningMessage(
					'请先配置Gemini API Key',
					'打开设置'
				);
				if (choice === '打开设置') {
					vscode.commands.executeCommand('workbench.action.openSettings', 'vscode-gemini.apiKey');
				}
				return;
			}

			await inputHandler.promptUserForQuestion();
		} catch (error) {
			vscode.window.showErrorMessage(`提问失败: ${error instanceof Error ? error.message : '未知错误'}`);
		}
	});

	// 分析选中的代码
	const disposableAnalyzeCode = vscode.commands.registerCommand('vscode-gemini.analyzeSelectedCode', async () => {
		try {
			// 检查API Key配置
			const config = vscode.workspace.getConfiguration('vscode-gemini');
			const apiKey = config.get<string>('apiKey');
			
			if (!apiKey) {
				const choice = await vscode.window.showWarningMessage(
					'请先配置Gemini API Key',
					'打开设置'
				);
				if (choice === '打开设置') {
					vscode.commands.executeCommand('workbench.action.openSettings', 'vscode-gemini.apiKey');
				}
				return;
			}

			await terminalManager.analyzeSelectedCode();
		} catch (error) {
			vscode.window.showErrorMessage(`代码分析失败: ${error instanceof Error ? error.message : '未知错误'}`);
		}
	});

	// 关于选中代码的问题
	const disposableCodeQuestion = vscode.commands.registerCommand('vscode-gemini.askAboutCode', async () => {
		try {
			// 检查API Key配置
			const config = vscode.workspace.getConfiguration('vscode-gemini');
			const apiKey = config.get<string>('apiKey');
			
			if (!apiKey) {
				const choice = await vscode.window.showWarningMessage(
					'请先配置Gemini API Key',
					'打开设置'
				);
				if (choice === '打开设置') {
					vscode.commands.executeCommand('workbench.action.openSettings', 'vscode-gemini.apiKey');
				}
				return;
			}

			await inputHandler.promptUserForCodeQuestion();
		} catch (error) {
			vscode.window.showErrorMessage(`代码问答失败: ${error instanceof Error ? error.message : '未知错误'}`);
		}
	});

	// 添加状态栏项
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.text = '$(robot) Gemini AI';
	statusBarItem.tooltip = '点击启动Gemini AI助手';
	statusBarItem.command = 'vscode-gemini.startAIChat';
	statusBarItem.show();

	// 注册所有的disposables
	context.subscriptions.push(
		disposableHelloWorld,
		disposableStartAIChat,
		disposableAskQuestion,
		disposableAnalyzeCode,
		disposableCodeQuestion,
		configChangeListener,
		statusBarItem
	);

	// 显示欢迎消息
	vscode.window.showInformationMessage('🤖 Gemini AI 助手已就绪！点击状态栏图标或使用 Ctrl+Shift+G 开始使用。');
}

// This method is called when your extension is deactivated
export function deactivate() {
	if (terminalManager) {
		terminalManager.dispose();
	}
	if (inputHandler) {
		inputHandler.dispose();
	}
}
