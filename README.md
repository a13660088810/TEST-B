# 宝可梦队伍策略师

基于 PokeAPI + OpenRouter Tool Calling 的 AI Agent 项目。用户可以通过对话查询宝可梦、属性克制、招式详情，并让 Agent 推荐 6 只宝可梦队伍。

## 功能

- Chat 对话界面
- OpenRouter 大模型 Tool Calling
- PokeAPI 数据查询
- `search_pokemon`：查询宝可梦基础信息、属性、图片、种族值
- `get_type_matchups`：查询属性克制、抗性、免疫、弱点
- `get_move_detail`：查询招式威力、命中、PP、属性、伤害类型
- `recommend_team`：推荐 6 只宝可梦队伍
- 队伍组合视图
- 属性覆盖分析
- 种族值柱状图
- 进化链详情
- 流式输出
- OpenRouter 限流/失败时自动降级到本地策略模式

## 环境要求

- Node.js 18+
- npm
- OpenRouter API Key，可选但建议配置

PokeAPI 免费公开，无需 API Key。

## 初始化

安装依赖：

```bash
npm install
```

复制环境变量文件：

```bash
copy .env.example .env
```

编辑 `.env`：

```env
OPENROUTER_API_KEY=你的_openrouter_key
OPENROUTER_MODEL=openrouter/free
PORT=3002
```

如果不配置 `OPENROUTER_API_KEY`，项目仍可运行，会自动进入本地降级模式，直接调用 PokeAPI 返回规则化结果。

## 启动开发服务

```bash
npm run dev
```

默认地址：

- 前端：http://localhost:5174
- 后端：http://localhost:3002

## 构建

```bash
npm run build
```

## 常用测试

健康检查：

```bash
curl http://localhost:3002/api/health
```

查询宝可梦：

```bash
curl http://localhost:3002/api/pokemon/pikachu
```

查询属性克制：

```bash
curl http://localhost:3002/api/type/fire
```

查询招式：

```bash
curl http://localhost:3002/api/move/thunderbolt
```

推荐队伍：

```bash
curl "http://localhost:3002/api/team/recommend?opponent_type=rock"
```

## 示例输入

- 查询皮卡丘的属性和种族值
- 火系克制什么？
- 十万伏特这个招式怎么样？
- 对手是岩石系，帮我组一支队伍
- 对手是喷火龙，我该怎么应对？

## 注意事项

- 不要把 `.env` 提交到 GitHub。
- OpenRouter 免费模型可能有每日额度或上游限流。
- 当 OpenRouter 429、鉴权失败或模型不可用时，后端会隐藏原始错误并自动切换本地策略模式。
