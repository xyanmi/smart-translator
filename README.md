# Smart Translator

一个用于 Chrome 的划词翻译扩展，支持网页选中文本、输入框文本、PDF 场景和自定义翻译 API。

## 特性

- 划词后即时翻译
- 支持 `F1`、复制后、以及自定义快捷键触发
- 支持 Google、Bing、DeepL、OpenRouter/OpenAI-compatible、DeepSeek、Gemini
- 支持 Custom API，可分别配置请求方式、请求头、响应路径和模型参数
- 设置页内置 API 测试页，方便检查请求和原始响应
- API key 本地保存，不同步到云端

## 安全说明

- API key 存在 `chrome.storage.local`，不会同步到 `chrome.storage.sync`
- 设置页不会回显真实 key，只会显示本地已保存状态
- 发送请求时仍然需要通过 HTTPS 把 key 传给对应厂商，这是调用官方接口的必要步骤
- 本项目不包含抓包、绕过限制、伪造认证或其他侵权能力

## 开发与测试

```bash
npm test
```

测试会覆盖：

- 配置归一化和密钥脱敏
- OpenAI-compatible 请求构造
- Custom API 请求和响应解析
- 选区工具逻辑

## 安装

1. 打开 `chrome://extensions/`
2. 开启“开发者模式”
3. 选择“加载已解压的扩展程序”
4. 指向本项目根目录

## 目录

- `src/background.js` 后台服务
- `src/content.js` 页面划词逻辑
- `src/settings/` 设置页和 API 测试页
- `src/shared/translation-api.js` 共享翻译适配层
- `src/shared/selection-utils.js` 共享选区工具
- `tests/` 自动化测试

## 许可证

MIT
