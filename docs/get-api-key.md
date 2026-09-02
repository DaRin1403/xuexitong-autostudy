# 获取 AI API Key(多平台指南)

> 本脚本的自动答题使用 **OpenAI 兼容接口**——任何支持该协议的大模型平台都可以用,不只是 DeepSeek。
> 你只需要在脚本设置面板(⚙)里填三样东西:

| 面板设置项 | 填什么 | 示例(DeepSeek) |
|------------|--------|-----------------|
| 🔑 AI Key | 平台给你的 `sk-` 开头密钥 | `sk-xxxxxxxx` |
| 🌐 AI 接口地址 | 平台的兼容接口地址(以 `/chat/completions` 结尾) | `https://api.deepseek.com/v1/chat/completions` |
| 🧠 AI 模型 | 该平台的模型名 | `deepseek-reasoner` |

> **提醒**:API Key 相当于你的钱包钥匙,只保存在自己浏览器里,不要发到群里或截图外传。

---

## 平台速查表

| 平台 | 注册地址 | 接口地址(填面板) | 模型名(填面板) | 特点 |
|------|----------|-------------------|----------------|------|
| **DeepSeek**(推荐) | platform.deepseek.com | `https://api.deepseek.com/v1/chat/completions` | `deepseek-reasoner` / `deepseek-chat` | 便宜、准、速度快 |
| **硅基流动** | cloud.siliconflow.cn | `https://api.siliconflow.cn/v1/chat/completions` | `deepseek-ai/DeepSeek-V3` 等 | 注册送额度,可免费体验多家模型 |
| **MiniMax** | platform.minimaxi.com | `https://api.minimaxi.com/v1/chat/completions` | `MiniMax-Text-01` | 国内合规,注册送体验金 |
| **智谱 AI** | open.bigmodel.cn | `https://open.bigmodel.cn/api/paas/v4/chat/completions` | `glm-4-flash`(免费)/ `glm-4-plus` | GLM-4-Flash 免费 |
| **通义千问** | bailian.console.aliyun.com | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` | `qwen-plus` / `qwen-turbo` | 阿里,有免费额度 |
| **Kimi** | platform.moonshot.cn | `https://api.moonshot.cn/v1/chat/completions` | `moonshot-v1-8k` | 月之暗面 |

---

## 分平台图文步骤

### 1. DeepSeek(推荐,刷一门课通常只要几毛钱)

1. 打开 **https://platform.deepseek.com** ,用手机号注册并登录
2. 左侧菜单点击「**API Keys**」
3. 点「**创建 API Key**」,名称随便填(如"学习通"),点创建
4. **立刻复制**弹出的 `sk-` 开头密钥(关闭后无法再查看,只能重新创建)
5. 建议先充值 10 元,足够刷几十门课
6. 面板填写:
   - AI Key:`sk-...`
   - AI 接口地址:`https://api.deepseek.com/v1/chat/completions`(默认就是它,不用改)
   - AI 模型:`deepseek-reasoner`(默认,最准)

### 2. 硅基流动(注册送额度,没钱也能先用)

1. 打开 **https://cloud.siliconflow.cn** ,手机号注册登录
2. 新用户赠送额度(约 14 元),可直接调用多家开源模型
3. 左侧「**API 密钥**」→「**新建 API 密钥**」→ 复制 `sk-` 开头密钥
4. 面板填写:
   - AI Key:`sk-...`
   - AI 接口地址:`https://api.siliconflow.cn/v1/chat/completions`
   - AI 模型:`deepseek-ai/DeepSeek-V3`(或平台模型广场里任意模型名)

### 3. MiniMax

1. 打开 **https://platform.minimaxi.com** ,注册登录(新用户有体验金)
2. 控制台 →「**接口密钥**」→ 创建密钥,复制
3. 面板填写:
   - AI Key:你的密钥
   - AI 接口地址:`https://api.minimaxi.com/v1/chat/completions`
   - AI 模型:`MiniMax-Text-01`(以平台当前模型名为准)

### 4. 智谱 AI(GLM-4-Flash 免费)

1. 打开 **https://open.bigmodel.cn** ,注册并完成实名
2. 控制台 →「**API 密钥**」→ 添加新密钥,复制(注意是 `id.secret` 格式,整串复制)
3. 面板填写:
   - AI Key:整串密钥(含小数点)
   - AI 接口地址:`https://open.bigmodel.cn/api/paas/v4/chat/completions`
   - AI 模型:`glm-4-flash`(免费)或 `glm-4-plus`(更强)

### 5. 通义千问(DashScope)

1. 打开 **https://bailian.console.aliyun.com** ,阿里云账号登录并开通"百炼"服务
2. 右上角头像 →「**API-KEY 管理**」→ 创建,复制
3. 面板填写:
   - AI Key:`sk-...`
   - AI 接口地址:`https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
   - AI 模型:`qwen-plus`

### 6. Kimi(月之暗面)

1. 打开 **https://platform.moonshot.cn** ,注册登录
2. 「**API 密钥管理**」→ 新建,复制 `sk-` 开头密钥
3. 面板填写:
   - AI Key:`sk-...`
   - AI 接口地址:`https://api.moonshot.cn/v1/chat/completions`
   - AI 模型:`moonshot-v1-8k`

---

## 常见问题

**Q: 填了之后做题还是显示"未查到答案"?**
A: 检查三点:① Key 是否完整(含 `sk-` 前缀,注意别带空格);② 接口地址是否以 `/chat/completions` 结尾;③ 模型名是否是该平台真实存在的模型名(可在各平台"模型广场/文档"里查)。

**Q: 日志提示"HTTP 402"?**
A: 账户余额不足。去对应平台充值;或换一个注册送额度的平台(如硅基流动、MiniMax)。

**Q: 日志提示"HTTP 401"?**
A: Key 错误或已删除。回平台重新创建一个 Key。

**Q: 能用 ChatGPT(OpenAI 官方)吗?**
A: 可以,接口地址填 `https://api.openai.com/v1/chat/completions`,模型填 `gpt-4o-mini`。但需要能访问 OpenAI 的网络环境,且价格比国内平台贵。

**Q: 不同平台答题效果有差别吗?**
A: 有。推荐优先级:DeepSeek-R1/GLM-4-Plus/Kimi 等推理模型 > 普通对话模型。单选/判断题各平台都接近满分,多选和简答题推理模型明显更强。
