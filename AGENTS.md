## 题目 B：宝可梦队伍策略师

### 任务概述

基于免费公开 API，使用 AI 工具构建一个**宝可梦队伍策略师**。用户描述对战需求或偏好，Agent 查询宝可梦数据后推荐最佳队伍组合。

### 可用 API

以下 API 全部免费，无需注册，无需 API Key，可直接调用。

### PokeAPI — 宝可梦数据百科

文档：<https://pokeapi.co/docs/v2>

```
# 查询宝可梦信息（名称或ID）
GET <https://pokeapi.co/api/v2/pokemon/{id_or_name}>
# 返回：种族值(stats)、属性(types)、技能(abilities)、招式(moves)、图片(sprites)

# 查询宝可梦物种信息（含文字描述、进化链）
GET <https://pokeapi.co/api/v2/pokemon-species/{id_or_name}>
# 返回：flavor_text（图鉴描述）、evolution_chain、generation、habitat

# 查询属性详情（含克制关系）
GET <https://pokeapi.co/api/v2/type/{id_or_name}>
# 返回：damage_relations（双倍伤害/半倍伤害/免疫的属性列表）

# 查询技能详情
GET <https://pokeapi.co/api/v2/ability/{id_or_name}>

# 查询招式详情
GET <https://pokeapi.co/api/v2/move/{id_or_name}>
# 返回：威力(power)、命中(accuracy)、PP、属性(type)、伤害类型(damage_class)

# 查询进化链
GET <https://pokeapi.co/api/v2/evolution-chain/{id}>

# 获取宝可梦列表（分页）
GET <https://pokeapi.co/api/v2/pokemon?limit=20&offset=0>

# 获取所有属性列表
GET <https://pokeapi.co/api/v2/type>

# 获取世代信息
GET <https://pokeapi.co/api/v2/generation/{id_or_name}>

# 宝可梦图片地址规律
<https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{id}.png>
<https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{id}.png>
```

### 必须完成

### 1. AI Agent（后端）

- 使用 OpenRouter API 调用大语言模型
- 实现**至少 3 个 Tool / Function**：
  - `search_pokemon` — 按名称查询宝可梦基础信息（种族值、属性、图片）
  - `get_type_matchups` — 查询属性克制关系（如火克草、水克火）
  - `get_move_detail` — 查询招式详情（威力、命中、属性）
- Agent 能根据用户自然语言输入，**自主决定**调用哪个 Tool
- 支持多轮对话（如"换掉队伍里的水系，推荐一个电系"）

### 2. Web 界面（前端）

- Chat 对话界面（用户输入 → Agent 回复）
- 宝可梦信息需**结构化展示**（卡片含官方图片、属性标签、种族值），不能只显示原始 JSON
- ui基础交互可用

### 加分项

- 队伍组合视图（展示 6 只宝可梦的队伍概览）
- 属性克制覆盖分析（"你的队伍对岩石系缺乏应对"）
- 种族值雷达图/柱状图
- 进化链展示
- 对战模拟建议（"对手派出喷火龙，你应该换上谁？"）
- 精美加分

---

## 当前实现进度（2026-06-15）

### 运行方式

- 项目目录：`D:\testb`
- 安装依赖：`npm install`
- 开发启动：`npm run dev`
- 前端地址：`http://localhost:5174`
- 后端地址：`http://localhost:3002`
- OpenRouter 配置：复制 `.env.example` 为 `.env`，填写 `OPENROUTER_API_KEY`
- 当前本地已配置免费路由：`OPENROUTER_MODEL=openrouter/free`

### 必须完成项对照

#### 1. AI Agent（后端）

- [x] 使用 OpenRouter API 调用大语言模型
  - 实现位置：`server/agent.js`
  - 说明：已接入 OpenRouter Chat Completions + tools，并通过 `openrouter/free` 完成真实流式接口验证。
- [x] 实现至少 3 个 Tool / Function
  - `search_pokemon`：已实现，按名称、中文常见别名或 ID 查询宝可梦基础信息、属性、图片、特性、种族值、图鉴描述、进化链。
  - `get_type_matchups`：已实现，查询属性克制、抗性、免疫和弱点。
  - `get_move_detail`：已实现，查询招式威力、命中、PP、属性、伤害类型和效果说明。
  - 额外实现 `recommend_team`：按策略或对手属性推荐 6 只宝可梦队伍。
- [x] Agent 根据用户自然语言输入自主决定调用哪个 Tool
  - 实现位置：`server/agent.js`
  - 说明：配置 OpenRouter Key 后由模型通过 `tool_choice: "auto"` 自主选择工具。
- [x] 支持多轮对话
  - 实现位置：`src/main.jsx`、`server/agent.js`
  - 说明：前端会把历史消息传给 `/api/chat/stream`，后端保留最近 10 条上下文。

#### 2. Web 界面（前端）

- [x] Chat 对话界面
  - 实现位置：`src/main.jsx`
  - 说明：支持输入、发送、示例 Prompt、加载态、错误提示和流式输出。
- [x] 宝可梦信息结构化展示
  - 实现位置：`src/main.jsx`、`src/styles.css`
  - 说明：卡片包含官方图片、属性标签、种族值柱状图、总种族值、特性和详情弹窗；不直接展示原始 JSON。
- [x] UI 基础交互可用
  - 说明：已完成响应式布局、按钮、输入框、卡片、弹窗和状态展示。

### 已完成加分项

- [x] 队伍组合视图
  - 说明：`recommend_team` 返回 6 只宝可梦，前端以队伍 6 宫格展示。
- [x] 属性克制覆盖分析
  - 说明：队伍结果包含进攻覆盖和主要防守风险。
- [x] 种族值柱状图
  - 说明：宝可梦卡片展示高亮种族值，详情弹窗展示完整 6 项种族值。
- [x] 进化链展示
  - 说明：详情弹窗展示 PokeAPI species/evolution-chain 解析结果。
- [x] 对战模拟建议基础能力
  - 说明：用户描述对手属性时，Agent 可调用 `recommend_team` 生成反制队伍；属性和招式工具可辅助说明实战意义。
- [x] 流式输出
  - 说明：已新增 `/api/chat/stream` SSE 接口，前端逐步显示模型回复。
- [x] 完善的错误处理与优雅降级
  - 说明：未配置 OpenRouter Key、OpenRouter 免费模型 429/上游限流、鉴权失败或模型不可用时，会自动切换本地策略模式，隐藏原始 provider JSON；PokeAPI 查询失败会返回友好提示。
- [x] 基础精美度
  - 说明：已完成桌面端/移动端样式、属性色彩标签、队伍视图和详情弹窗。

### 验证记录

- [x] `npm run build` 通过
- [x] PokeAPI 网络访问验证通过
- [x] `/api/health` 返回 `openRouterConfigured: true`
- [x] `/api/team/recommend?opponent_type=rock` 返回 6 只队伍成员
- [x] `/api/chat/stream` 返回 `tool_start`、`cards`、`delta` 流式事件
- [x] OpenRouter 429 降级验证通过：前端收到友好 notice，并继续展示 PokeAPI 工具结果
