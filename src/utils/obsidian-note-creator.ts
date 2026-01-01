import browser from './browser-polyfill';
import { escapeDoubleQuotes, sanitizeFileName } from '../utils/string-utils';
import { Template, Property, Settings } from '../types/types';
import { generalSettings, incrementStat, loadSettings } from './storage-utils';
import { copyToClipboard } from './clipboard-utils';

export async function generateFrontmatter(properties: Property[]): Promise<string> {
	let frontmatter = '---\n';
	for (const property of properties) {
		// Wrap property name in quotes if it contains YAML-ambiguous characters
		const needsQuotes = /[:\s\{\}\[\],&*#?|<>=!%@\\-]/.test(property.name) || /^[\d]/.test(property.name) || /^(true|false|null|yes|no|on|off)$/i.test(property.name.trim());
		const propertyKey = needsQuotes ? (property.name.includes('"') ? `'${property.name.replace(/'/g, "''")}'` : `"${property.name}"`) : property.name;
		frontmatter += `${propertyKey}:`;

		const propertyType = generalSettings.propertyTypes.find(p => p.name === property.name)?.type || 'text';

		switch (propertyType) {
			case 'multitext':
				let items: string[];
				if (property.value.trim().startsWith('["') && property.value.trim().endsWith('"]')) {
					try {
						items = JSON.parse(property.value);
					} catch (e) {
						// If parsing fails, fall back to splitting by comma
						items = property.value.split(',').map(item => item.trim());
					}
				} else {
					// Split by comma, but keep wikilinks intact
					items = property.value.split(/,(?![^\[]*\]\])/).map(item => item.trim());
				}
				items = items.filter(item => item !== '');
				if (items.length > 0) {
					frontmatter += '\n';
					items.forEach(item => {
						frontmatter += `  - "${escapeDoubleQuotes(item)}"\n`;
					});
				} else {
					frontmatter += '\n';
				}
				break;
			case 'number':
				const numericValue = property.value.replace(/[^\d.-]/g, '');
				frontmatter += numericValue ? ` ${parseFloat(numericValue)}\n` : '\n';
				break;
			case 'checkbox':
				const isChecked = typeof property.value === 'boolean' ? property.value : property.value === 'true';
				frontmatter += ` ${isChecked}\n`;
				break;
			case 'date':
			case 'datetime':
				if (property.value.trim() !== '') {
					frontmatter += ` ${property.value}\n`;
				} else {
					frontmatter += '\n';
				}
				break;
			default: // Text
				frontmatter += property.value.trim() !== '' ? ` "${escapeDoubleQuotes(property.value)}"\n` : '\n';
		}
	}
	frontmatter += '---\n';

	// Check if the frontmatter is empty
	if (frontmatter.trim() === '---\n---') {
		return '';
	}

	return frontmatter;
}

function openObsidianUrl(url: string): void {
	// browser.runtime.sendMessage({
	// 	action: "openObsidianUrl",
	// 	url: url
	// }).catch((error) => {
	// 	console.error('Error opening Obsidian URL via background script:', error);
	// 	window.open(url, '_blank');
	// });
}

async function tryClipboardWrite(fileContent: string, obsidianUrl: string): Promise<void> {
	const success = await copyToClipboard(fileContent);
	
	if (success) {
		obsidianUrl += `&clipboard`;
		openObsidianUrl(obsidianUrl);
		console.log('Obsidian URL:', obsidianUrl);
	} else {
		console.error('All clipboard methods failed, falling back to URI method');
		// Final fallback: use URI method with actual content (same as legacy mode)
		// Note: We don't add &clipboard here since we're bypassing the clipboard entirely
		obsidianUrl += `&content=${encodeURIComponent(fileContent)}`;
		openObsidianUrl(obsidianUrl);
		console.log('Obsidian URL (URI fallback):', obsidianUrl);
	}
}

/**
 * Blinko API 配置接口
 */
export interface BlinkoConfig {
	apiUrl: string;
	apiToken: string;
	callbackUrl?: string;
	thoughtLengthThreshold?: number;
}

/**
 * Blinko API 响应接口
 */
interface BlinkoResponse {
	id?: number;
	success?: boolean;
	message?: string;
	error?: string;
}

/**
 * 扩展 Settings 接口以支持 Blinko 配置
 */
export interface BlinkoSettings {
	apiUrl?: string;
	apiToken?: string;
	callbackUrl?: string;
	thoughtLengthThreshold?: number;
}

/**
 * 从存储中加载 Blinko 配置
 * 
 * @returns BlinkoConfig 实例
 */
export async function loadBlinkoConfig(): Promise<BlinkoConfig> {
	const settings = await loadSettings();
	
	// 从 local storage 中读取 Blinko 特定配置
	const blinkoData = await browser.storage.local.get('blinko_settings') as { blinko_settings?: BlinkoSettings };
	const blinkoSettings = blinkoData.blinko_settings || {};
	
	// 默认配置
	const defaultConfig: BlinkoConfig = {
		apiUrl: 'http://192.168.50.118:1111/api/v1/note/upsert',
		apiToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic3VwZXJhZG1pbiIsIm5hbWUiOiJBcmlvIiwic3ViIjoiMSIsImV4cCI6NDkwMzQ3ODM5OCwiaWF0IjoxNzQ5ODc4Mzk4fQ.njSNqRTlfrdKZNUJdo-8XfJ7fgv0mrdo5upQp2joO-w',
		callbackUrl: 'http://192.168.50.118:46375/8euU4SHs6fYna5A54wJoL3',
		thoughtLengthThreshold: 200
	};
	
	// 合并用户配置
	return {
		apiUrl: blinkoSettings.apiUrl || defaultConfig.apiUrl,
		apiToken: blinkoSettings.apiToken || defaultConfig.apiToken,
		callbackUrl: blinkoSettings.callbackUrl || defaultConfig.callbackUrl,
		thoughtLengthThreshold: blinkoSettings.thoughtLengthThreshold || defaultConfig.thoughtLengthThreshold
	};
}

/**
 * 保存 Blinko 配置到存储
 * 
 * @param config - BlinkoConfig 实例
 */
export async function saveBlinkoConfig(config: Partial<BlinkoConfig>): Promise<void> {
	const blinkoData = await browser.storage.local.get('blinko_settings') as { blinko_settings?: BlinkoSettings };
	const currentSettings = blinkoData.blinko_settings || {};
	
	const newSettings: BlinkoSettings = {
		...currentSettings,
		...config
	};
	
	await browser.storage.local.set({
		blinko_settings: newSettings
	});
	
	console.log('[Blinko] 配置已保存:', newSettings);
}

/**
 * 初始化 BlinkoConfig 样例
 * 
 * @param apiUrl - Blinko API 地址 (可选,默认使用本地存储或默认值)
 * @param apiToken - API 认证令牌 (可选,默认使用本地存储或空值)
 * @param callbackUrl - 回调通知 URL (可选)
 * @param thoughtLengthThreshold - 短笔记长度阈值 (可选,默认 200)
 * @returns BlinkoConfig 实例
 */
export async function initBlinkoConfig(
	apiUrl?: string,
	apiToken?: string,
	callbackUrl?: string,
	thoughtLengthThreshold?: number
): Promise<BlinkoConfig> {
	// 如果提供了参数,直接使用
	if (apiUrl && apiToken) {
		const config: BlinkoConfig = {
			apiUrl,
			apiToken,
			callbackUrl,
			thoughtLengthThreshold: thoughtLengthThreshold || 200
		};
		
		// 可选: 保存到存储
		await saveBlinkoConfig(config);
		
		return config;
	}
	
	// 否则从存储中加载
	return await loadBlinkoConfig();
}

/**
 * 获取 BlinkoConfig 样例 (用于测试或快速初始化)
 * 
 * @example
 * // 使用样例配置
 * const config = getBlinkoConfigSample();
 * const success = await saveToBlinko(content, '', '', '', 'create', config);
 * 
 * @returns BlinkoConfig 样例
 */
export function getBlinkoConfigSample(): BlinkoConfig {
	return {
		apiUrl: 'https://your-blinko-instance.com/api/notes',
		apiToken: 'your-api-token-here',
		callbackUrl: 'https://your-callback-service.com/notify',
		thoughtLengthThreshold: 200
	};
}

/**
 * 保存笔记到 Blinko
 * 
 * @param fileContent - 笔记内容 (包含 frontmatter 和 markdown 内容)
 * @param noteName - 笔记名称 (未使用,Blinko 不需要文件名)
 * @param path - 存储路径 (未使用,Blinko 不需要路径)
 * @param vault - 仓库 (未使用,Blinko 不需要 vault)
 * @param behavior - 行为模式 (未使用,Blinko 不支持追加/前置模式)
 * @param config - Blinko API 配置
 * @returns Promise<boolean> - true 表示保存成功,false 表示失败
 */
export async function saveToBlinko(
	fileContent: string,
	noteName: string,
	path: string,
	vault: string,
	behavior: Template['behavior'],
	config: BlinkoConfig
): Promise<boolean> {
	const {
		apiUrl,
		apiToken,
		callbackUrl,
		thoughtLengthThreshold = 200
	} = config;

	// 构建请求头
	const headers: HeadersInit = {
		'Content-Type': 'application/json',
		'Authorization': `Bearer ${apiToken}`
	};

	// 根据内容长度判断笔记类型 (0: 短笔记/thought, 1: 长笔记/note)
	const noteType = fileContent.length < thoughtLengthThreshold ? 0 : 1;
	// 构建请求数据
	const data = {
		content: fileContent,
		type: noteType
	};

	try {
		console.log(`[Blinko] 正在保存笔记, 内容长度: ${fileContent.length}, 类型: ${noteType === 0 ? 'thought' : 'note'}`);
		
		const response = await fetch(apiUrl, {
			method: 'POST',
			headers: headers,
			body: JSON.stringify(data)
		});

		if (response.status === 200) {
			const json_data: BlinkoResponse = await response.json();
			const noteId = json_data.id || 0;

			if (noteId > 0) {
				console.log(`[Blinko] 笔记保存成功, ID: ${noteId}`);
				
				// 发送成功回调通知
				if (callbackUrl) {
					notifyCallback(callbackUrl, '笔记保存成功').catch(err => {
						console.warn(`[Blinko] 回调通知失败: ${err}`);
					});
				}
				
				return true;
			} else {
				console.error(`[Blinko] 笔记保存失败:`, json_data);
				
				// 发送失败回调通知
				if (callbackUrl) {
					notifyCallback(callbackUrl, '笔记保存失败').catch(err => {
						console.warn(`[Blinko] 回调通知失败: ${err}`);
					});
				}
				
				return false;
			}
		} else {
			const errorText = await response.text();
			console.error(`[Blinko] 笔记保存失败, 状态码: ${response.status}, 响应: ${errorText}`);
			
			// 发送失败回调通知
			if (callbackUrl) {
				notifyCallback(callbackUrl, '笔记保存失败').catch(err => {
					console.warn(`[Blinko] 回调通知失败: ${err}`);
				});
			}
			
			return false;
		}

	} catch (error) {
		if (error instanceof TypeError && error.message.includes('fetch')) {
			console.error(`[Blinko] 笔记保存网络异常: ${error.message}`);
		} else {
			console.error(`[Blinko] 笔记保存异常:`, error);
		}
		
		// 发送失败回调通知
		if (callbackUrl) {
			notifyCallback(callbackUrl, '笔记保存失败').catch(err => {
				console.warn(`[Blinko] 回调通知失败: ${err}`);
			});
		}
		
		return false;
	}
}

/**
 * 发送回调通知
 * 
 * @param callbackUrl - 回调 URL
 * @param message - 通知消息
 */
async function notifyCallback(callbackUrl: string, message: string): Promise<void> {
	if (!callbackUrl) {
		return;
	}

	try {
		const notifyUrl = `${callbackUrl}/${encodeURIComponent(message)}`;
		await fetch(notifyUrl, {
			method: 'GET',
			signal: AbortSignal.timeout(5000) // 5 秒超时
		});
	} catch (error) {
		console.warn(`[Blinko] 回调通知失败: ${error}`);
	}
}

export async function saveToObsidian(
	fileContent: string,
	noteName: string,
	path: string,
	vault: string,
	behavior: Template['behavior'],
): Promise<void> {
	let obsidianUrl: string;

	const isDailyNote = behavior === 'append-daily' || behavior === 'prepend-daily';

	if (isDailyNote) {
		obsidianUrl = `obsidian://daily?`;
	} else {
		// Ensure path ends with a slash
		if (path && !path.endsWith('/')) {
			path += '/';
		}

		const formattedNoteName = sanitizeFileName(noteName);
		obsidianUrl = `obsidian://new?file=${encodeURIComponent(path + formattedNoteName)}`;
	}

	if (behavior.startsWith('append')) {
		obsidianUrl += '&append=true';
	} else if (behavior.startsWith('prepend')) {
		obsidianUrl += '&prepend=true';
	} else if (behavior === 'overwrite') {
		obsidianUrl += '&overwrite=true';
	}

	const vaultParam = vault ? `&vault=${encodeURIComponent(vault)}` : '';
	obsidianUrl += vaultParam;

	// Add silent parameter if silentOpen is enabled
	if (generalSettings.silentOpen) {
		obsidianUrl += '&silent=true';
	}

	if (generalSettings.legacyMode) {
		// Use the URI method
		obsidianUrl += `&content=${encodeURIComponent(fileContent)}`;
		console.log('Obsidian URL:', obsidianUrl);
		openObsidianUrl(obsidianUrl);
	} else {
		// Try to copy to clipboard with fallback mechanisms
		await tryClipboardWrite(fileContent, obsidianUrl);
	}
}
