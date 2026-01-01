/**
 * BlinkoConfig 使用示例
 * 
 * 此文件展示如何在调用 saveToBlinko 时初始化和使用 BlinkoConfig
 */

import { 
	saveToBlinko, 
	loadBlinkoConfig, 
	saveBlinkoConfig, 
	initBlinkoConfig,
	getBlinkoConfigSample 
} from './obsidian-note-creator';

// ============================================
// 示例 1: 使用样例配置 (最简单的方式)
// ============================================

async function example1_useSampleConfig() {
	const fileContent = `---
title: 我的笔记
tags: [example, demo]
date: 2024-01-01
---

# 示例笔记内容

这是一条测试笔记内容。`;

	// 获取样例配置
	const config = getBlinkoConfigSample();
	
	// 使用样例配置保存笔记
	const success = await saveToBlinko(
		fileContent,
		'',          // noteName (Blinko 不需要)
		'',          // path (Blinko 不需要)
		'',          // vault (Blinko 不需要)
		'create',    // behavior (Blinko 不需要)
		config
	);

	if (success) {
		console.log('✅ 笔记保存成功!');
	} else {
		console.log('❌ 笔记保存失败');
	}
}

// ============================================
// 示例 2: 使用 initBlinkoConfig 函数初始化
// ============================================

async function example2_initConfig() {
	const fileContent = '这是一条简短笔记';

	// 初始化 Blinko 配置
	const config = await initBlinkoConfig(
		'https://my-blinko-instance.com/api/notes',
		'my-secret-api-token-12345',
		'https://my-callback.com/notify',  // 可选
		200                                  // 短笔记阈值(字符数)
	);

	// 保存笔记
	const success = await saveToBlinko(
		fileContent,
		'', '', '', 'create',
		config
	);

	console.log(`保存结果: ${success ? '成功' : '失败'}`);
}

// ============================================
// 示例 3: 从存储加载配置
// ============================================

async function example3_loadFromStorage() {
	const fileContent = `---
title: 从存储加载的笔记
---

这是从存储中加载配置后保存的笔记。`;

	// 从本地存储加载 Blinko 配置
	const config = await loadBlinkoConfig();
	
	// 检查配置是否有效
	if (!config.apiToken) {
		console.error('❌ API Token 未配置,请先配置 Blinko');
		return;
	}

	// 保存笔记
	const success = await saveToBlinko(
		fileContent,
		'', '', '', 'create',
		config
	);

	console.log(`保存结果: ${success ? '成功' : '失败'}`);
}

// ============================================
// 示例 4: 先保存配置,再使用
// ============================================

async function example4_saveAndUseConfig() {
	// 第一步: 保存配置到存储
	await saveBlinkoConfig({
		apiUrl: 'https://my-blinko.com/api/notes',
		apiToken: 'my-token-abc123',
		callbackUrl: 'https://my-callback.com/notify',
		thoughtLengthThreshold: 300
	});
	
	console.log('✅ 配置已保存到存储');

	// 第二步: 从存储加载并使用
	const config = await loadBlinkoConfig();
	
	const fileContent = '这是使用保存的配置的笔记';
	const success = await saveToBlinko(
		fileContent,
		'', '', '', 'create',
		config
	);

	console.log(`笔记保存: ${success ? '成功' : '失败'}`);
}

// ============================================
// 示例 5: 部分更新配置
// ============================================

async function example5_partialUpdate() {
	// 只更新 API Token (其他配置保持不变)
	await saveBlinkoConfig({
		apiToken: 'new-updated-token-xyz789'
	});

	console.log('✅ API Token 已更新');

	// 加载完整配置
	const config = await loadBlinkoConfig();
	console.log('当前配置:', config);
}

// ============================================
// 示例 6: 在 popup.ts 中的实际使用场景
// ============================================

async function example6_realWorldUsage() {
	// 假设这是在 popup.ts 的 handleClipObsidian 函数中
	
	// 加载用户配置
	const config = await loadBlinkoConfig();
	
	// 验证配置
	if (!config.apiToken) {
		alert('请先在设置中配置 Blinko API Token');
		return;
	}
	
	// 收集笔记内容
	const properties = Array.from(document.querySelectorAll('.metadata-property input')).map(input => {
		const inputElement = input as HTMLInputElement;
		return {
			id: inputElement.dataset.id || Date.now().toString(),
			name: inputElement.id,
			value: inputElement.type === 'checkbox' ? inputElement.checked : inputElement.value
		};
	});

	const noteContentField = document.getElementById('note-content-field') as HTMLTextAreaElement;
	const fileContent = noteContentField.value;

	// 保存到 Blinko
	const success = await saveToBlinko(
		fileContent,
		'', '', '', 'create',
		config
	);

	if (success) {
		// 更新统计
		// await incrementStat('addToBlinko');
		
		// 显示成功提示
		console.log('✅ 笔记已保存到 Blinko');
		
		// 关闭 popup
		setTimeout(() => window.close(), 500);
	} else {
		// 显示错误提示
		console.error('❌ 保存到 Blinko 失败');
		alert('保存失败,请检查网络连接和 API 配置');
	}
}

// ============================================
// 示例 7: 错误处理和重试
// ============================================

async function example7_errorHandling() {
	const fileContent = '带有错误处理的笔记保存';
	
	try {
		const config = await loadBlinkoConfig();
		
		if (!config.apiToken) {
			throw new Error('API Token 未配置');
		}

		const success = await saveToBlinko(
			fileContent,
			'', '', '', 'create',
			config
		);

		if (!success) {
			throw new Error('保存失败');
		}

		console.log('✅ 笔记保存成功');
		
	} catch (error) {
		console.error('❌ 保存笔记时出错:', error);
		
		// 根据错误类型给出不同的提示
		if (error instanceof Error) {
			if (error.message.includes('API Token')) {
				alert('请先配置 Blinko API Token');
			} else if (error.message.includes('网络')) {
				alert('网络连接失败,请检查网络');
			} else {
				alert('保存失败: ' + error.message);
			}
		}
	}
}

// ============================================
// 示例 8: 根据内容长度自动判断笔记类型
// ============================================

async function example8_autoDetectNoteType() {
	const shortNote = '这是一条短笔记,会被识别为 thought';
	const longNote = `这是一条长笔记,会被识别为 note。

---
tags: [long-note]
title: 长笔记示例
---

## 介绍

这条笔记的内容超过了阈值(默认200字符),
因此会被自动识别为长笔记(type=1)。

## 详细内容

可以包含更多的内容、标题、列表等结构化信息。

- 列表项 1
- 列表项 2
- 列表项 3

超过 200 字符后,Blinko 会将其作为完整笔记处理。
`;

	// 使用默认阈值 (200字符)
	const config = await loadBlinkoConfig();
	
	// 保存短笔记
	console.log('保存短笔记 (type=0/thought)...');
	await saveToBlinko(shortNote, '', '', '', 'create', config);
	
	// 保存长笔记
	console.log('保存长笔记 (type=1/note)...');
	await saveToBlinko(longNote, '', '', '', 'create', config);
}

// ============================================
// 导出示例函数供测试使用
// ============================================

export {
	example1_useSampleConfig,
	example2_initConfig,
	example3_loadFromStorage,
	example4_saveAndUseConfig,
	example5_partialUpdate,
	example6_realWorldUsage,
	example7_errorHandling,
	example8_autoDetectNoteType
};

// ============================================
// 测试入口
// ============================================

// 在浏览器控制台中运行测试:
// import * as examples from './blinko-examples';
// examples.example1_useSampleConfig();
