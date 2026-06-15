import { getMoveDetail, getTypeMatchups, recommendTeam, searchPokemon } from "./pokeApi.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const tools = [
  {
    type: "function",
    function: {
      name: "search_pokemon",
      description: "Query a Pokemon by English name, Chinese common name, or ID. Returns types, stats, abilities and official image.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Pokemon name such as pikachu, charizard, gengar, or Chinese aliases like 皮卡丘." },
          id: { type: "string", description: "Pokemon PokeAPI ID." },
          query: { type: "string", description: "Fallback search query." },
          limit: { type: "number", description: "Maximum result count." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_type_matchups",
      description: "Get Pokemon type matchup relations: double damage, resistance, immunity, and weaknesses.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", description: "Pokemon type, for example fire, water, electric, rock, dragon, or Chinese type name." },
          name: { type: "string", description: "Alternative type name." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_move_detail",
      description: "Get move details including power, accuracy, PP, type and damage class.",
      parameters: {
        type: "object",
        properties: {
          move: { type: "string", description: "Move name, such as thunderbolt, earthquake, flamethrower, or Chinese aliases like 十万伏特." },
          name: { type: "string", description: "Alternative move name." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "recommend_team",
      description: "Recommend a 6-Pokemon team for a battle strategy or against an opponent type.",
      parameters: {
        type: "object",
        properties: {
          strategy: { type: "string", description: "Team strategy, such as balanced, fast offense, bulky, or Chinese descriptions." },
          opponent_type: { type: "string", description: "Opponent's important type, such as fire, water, rock, dragon." },
          preference: { type: "string", description: "User preference." }
        }
      }
    }
  }
];

const toolHandlers = {
  search_pokemon: searchPokemon,
  get_type_matchups: getTypeMatchups,
  get_move_detail: getMoveDetail,
  recommend_team: recommendTeam
};

class ProviderError extends Error {
  constructor(message, { status = 500, userMessage = "模型服务暂时不可用，已切换到本地策略模式。" } = {}) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
    this.userMessage = userMessage;
  }
}

class DataLookupError extends Error {
  constructor(message, userMessage = "没有查到对应数据，请换一个英文名、编号或更常见的中文名称。") {
    super(message);
    this.name = "DataLookupError";
    this.userMessage = userMessage;
  }
}

const systemPrompt = `
你是一个宝可梦队伍策略师。你必须通过工具查询真实 PokeAPI 数据，再给用户建议。
输出中文，语气简洁、策略导向。
当用户询问宝可梦资料、属性、种族值、图片时，调用 search_pokemon。
当用户询问属性克制、弱点、抗性、对某属性怎么打时，调用 get_type_matchups。
当用户询问招式威力、命中、PP 或伤害类型时，调用 get_move_detail。
当用户要求推荐队伍、替换队员、对战构筑或 6 只组合时，调用 recommend_team。
最终回复必须基于工具结果，不要输出原始 JSON。
`;

const finalAnswerPrompt = `
请基于上面的工具结果，用中文生成简洁策略建议。
要求：
1. 不要再调用工具。
2. 不要输出 JSON。
3. 如果有队伍，说明核心定位、属性覆盖和主要风险。
4. 如果有单只宝可梦，说明属性、种族值亮点和适合职责。
5. 如果有属性或招式结果，说明实战意义。
`;

function parseToolArguments(value) {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

async function callOpenRouter(messages, options = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:5174",
      "X-Title": "Pokemon Team Agent"
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || "openrouter/free",
      messages,
      ...(options.tools ? { tools: options.tools } : {}),
      ...(options.tool_choice ? { tool_choice: options.tool_choice } : {}),
      temperature: 0.35
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw createProviderError(response.status, text);
  }

  return response.json();
}

async function* streamOpenRouter(messages) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:5174",
      "X-Title": "Pokemon Team Agent"
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || "openrouter/free",
      messages,
      temperature: 0.35,
      stream: true
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw createProviderError(response.status, text);
  }

  const decoder = new TextDecoder();
  let buffer = "";

  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;

      try {
        const json = JSON.parse(payload);
        const content = json.choices?.[0]?.delta?.content;
        if (content) yield content;
      } catch {
        // Ignore provider keep-alive lines.
      }
    }
  }
}

function createProviderError(status, rawText = "") {
  let message = rawText;

  try {
    const parsed = JSON.parse(rawText);
    message = parsed.error?.message || parsed.message || rawText;
  } catch {
    // Keep raw text for server logs only.
  }

  const normalized = String(message).toLowerCase();
  const isRateLimit = status === 429 || normalized.includes("rate limit") || normalized.includes("free-models-per-day");
  const isAuth = status === 401 || status === 403;

  if (isRateLimit) {
    return new ProviderError(`OpenRouter rate limited: ${message}`, {
      status,
      userMessage: "免费模型今日额度或上游限流已触发，已切换到本地策略模式。结果仍来自 PokeAPI，但推荐语会更规则化。"
    });
  }

  if (isAuth) {
    return new ProviderError(`OpenRouter auth failed: ${message}`, {
      status,
      userMessage: "OpenRouter Key 无效或无权限，已切换到本地策略模式。请检查 .env 配置。"
    });
  }

  return new ProviderError(`OpenRouter failed: ${message}`, {
    status,
    userMessage: "模型服务暂时不可用，已切换到本地策略模式。"
  });
}

function isProviderError(error) {
  return error?.name === "ProviderError";
}

function isLookupError(error) {
  return error?.name === "DataLookupError" || /PokeAPI request failed: 404/.test(error?.message || "");
}

function buildMessages(history, userMessage) {
  const recentHistory = history.slice(-10).map((item) => ({
    role: item.role === "assistant" ? "assistant" : "user",
    content: item.content
  }));

  return [{ role: "system", content: systemPrompt }, ...recentHistory, { role: "user", content: userMessage }];
}

function normalizeToolResult(name, result) {
  return {
    name,
    result,
    display: {
      pokemon: result.pokemon || result.team?.pokemon || [],
      team: result.team ? [result.team] : [],
      matchups: result.matchup ? [result.matchup] : [],
      moves: result.move ? [result.move] : []
    }
  };
}

function compactToolContent(result) {
  const pokemon = result.pokemon || result.team?.pokemon || [];
  return {
    pokemon: pokemon.slice(0, 6).map((item) => ({
      name: item.name,
      types: item.types,
      totalStats: item.totalStats,
      topStats: item.stats?.slice().sort((a, b) => b.value - a.value).slice(0, 2)
    })),
    team: result.team
      ? {
          strategy: result.team.strategy,
          names: result.team.pokemon.map((item) => item.name),
          coverage: result.team.coverage
        }
      : undefined,
    matchup: result.matchup,
    move: result.move
  };
}

function mergeCards(steps) {
  return steps.reduce(
    (acc, step) => {
      const display = normalizeToolResult(step.tool, step.result).display;
      acc.pokemon.push(...display.pokemon);
      acc.team.push(...display.team);
      acc.matchups.push(...display.matchups);
      acc.moves.push(...display.moves);
      return acc;
    },
    { pokemon: [], team: [], matchups: [], moves: [] }
  );
}

function createDeterministicReply(cards) {
  if (cards.team.length) {
    const team = cards.team[0];
    return `已生成一支 6 只宝可梦队伍：${team.pokemon.map((item) => `「${item.displayName || item.name}」`).join("、")}。\n${team.coverage?.notes || "下方展示了队伍概览和属性覆盖。"}`;
  }

  if (cards.pokemon.length) {
    const names = cards.pokemon.map((item) => `「${item.displayName || item.name}」`).join("、");
    return `已查询到 ${names}，下方卡片包含官方图片、属性标签和种族值。`;
  }

  if (cards.matchups.length) {
    const matchup = cards.matchups[0];
    return `已查询「${matchup.type.label}」属性克制关系，下方卡片列出了进攻优势、防守弱点和抗性。`;
  }

  if (cards.moves.length) {
    const move = cards.moves[0];
    return `已查询招式「${move.name}」，威力 ${move.power || "-"}、命中 ${move.accuracy || "-"}、PP ${move.pp || "-"}。`;
  }

  return "我查到了结果，已整理在下方。";
}

function createNoResultReply(message = "") {
  return `没有查到「${message || "这个输入"}」对应的数据。可以试试：
1. 使用英文名，例如 charizard、pikachu、gengar。
2. 使用宝可梦编号，例如 6、25、94。
3. 查询属性时说“火系克制什么”或“岩石系弱点”。
4. 查询招式时说“十万伏特这个招式怎么样”。`;
}

async function executeToolRound(messages, emit = () => {}) {
  const first = await callOpenRouter(messages, { tools, tool_choice: "auto" });
  const assistantMessage = first.choices?.[0]?.message;
  const toolCalls = assistantMessage?.tool_calls || [];
  const steps = [];

  if (!toolCalls.length) {
    return { steps, directReply: assistantMessage?.content || "我需要更多信息才能给出策略建议。" };
  }

  messages.push(assistantMessage);

  for (const toolCall of toolCalls) {
    const name = toolCall.function?.name;
    const args = parseToolArguments(toolCall.function?.arguments);
    const handler = toolHandlers[name];
    if (!handler) continue;

    emit({ type: "tool_start", tool: name, args });
    let result;
    try {
      result = await handler(args);
    } catch (error) {
      if (isLookupError(error)) {
        throw new DataLookupError(error.message);
      }
      throw error;
    }
    steps.push({ tool: name, args, result });
    messages.push({
      role: "tool",
      tool_call_id: toolCall.id,
      name,
      content: JSON.stringify(compactToolContent(result))
    });
  }

  return { steps, directReply: "" };
}

export async function runAgent({ message, history = [] }) {
  const messages = buildMessages(history, message);
  let steps = [];
  let directReply = "";

  try {
    const round = await executeToolRound(messages);
    steps = round.steps;
    directReply = round.directReply;
  } catch (error) {
    if (isProviderError(error)) {
      const fallback = await runFallbackAgent({ message, notice: error.userMessage });
      return fallback;
    }
    if (isLookupError(error)) {
      return { reply: createNoResultReply(message), steps: [], cards: mergeCards([]), mode: "error" };
    }
    throw error;
  }

  if (directReply) return { reply: directReply, steps, cards: mergeCards(steps), mode: "openrouter" };

  const cards = mergeCards(steps);
  messages.push({ role: "user", content: finalAnswerPrompt });

  let reply = createDeterministicReply(cards);
  try {
    const final = await callOpenRouter(messages);
    reply = final.choices?.[0]?.message?.content || reply;
  } catch (error) {
    console.warn(`Final summary failed, using deterministic reply: ${error.message}`);
  }

  return { reply, steps, cards, mode: "openrouter" };
}

function extractFallbackTarget(text) {
  const known = ["皮卡丘", "喷火龙", "妙蛙花", "水箭龟", "耿鬼", "快龙", "路卡利欧", "烈咬陆鲨", "暴鲤龙"];
  return known.find((name) => text.includes(name)) || "pikachu";
}

function extractFallbackType(text) {
  const types = ["火", "水", "电", "草", "冰", "格斗", "毒", "地面", "飞行", "超能力", "虫", "岩石", "幽灵", "龙", "恶", "钢", "妖精"];
  return types.find((name) => text.includes(name)) || "fire";
}

function extractFallbackMove(text) {
  const moves = [
    { zh: "十万伏特", name: "thunderbolt" },
    { zh: "喷射火焰", name: "flamethrower" },
    { zh: "水炮", name: "hydro-pump" },
    { zh: "地震", name: "earthquake" },
    { zh: "冰冻光束", name: "ice-beam" },
    { zh: "暗影球", name: "shadow-ball" },
    { zh: "龙爪", name: "dragon-claw" },
    { zh: "月亮之力", name: "moonblast" },
    { zh: "近身战", name: "close-combat" }
  ];
  const found = moves.find((move) => text.includes(move.zh) || text.toLowerCase().includes(move.name));
  return found?.name || "thunderbolt";
}

export async function runFallbackAgent({ message }) {
  const steps = [];
  const text = message.toLowerCase();

  if (message.includes("队伍") || message.includes("推荐") || text.includes("team")) {
    const opponentType = extractFallbackType(message);
    const result = await recommendTeam({ opponent_type: opponentType });
    steps.push({ tool: "recommend_team", args: { opponent_type: opponentType }, result });
    const cards = mergeCards(steps);
    return { reply: createDeterministicReply(cards), steps, cards, mode: "fallback" };
  }

  if (message.includes("克制") || message.includes("弱点") || message.includes("属性") || text.includes("type")) {
    const type = extractFallbackType(message);
    const result = await getTypeMatchups({ type });
    steps.push({ tool: "get_type_matchups", args: { type }, result });
    const cards = mergeCards(steps);
    return { reply: createDeterministicReply(cards), steps, cards, mode: "fallback" };
  }

  if (message.includes("招式") || message.includes("威力") || text.includes("move") || message.includes("十万伏特")) {
    const move = extractFallbackMove(message);
    const result = await getMoveDetail({ move });
    steps.push({ tool: "get_move_detail", args: { move }, result });
    const cards = mergeCards(steps);
    return { reply: createDeterministicReply(cards), steps, cards, mode: "fallback" };
  }

  const name = extractFallbackTarget(message);
  const result = await searchPokemon({ name });
  steps.push({ tool: "search_pokemon", args: { name }, result });
  const cards = mergeCards(steps);
  return { reply: createDeterministicReply(cards), steps, cards, mode: "fallback" };
}

export async function runAgentStream({ message, history = [], onEvent }) {
  const emit = (event) => onEvent?.(event);

  if (!process.env.OPENROUTER_API_KEY) {
    const result = await runFallbackAgent({ message, history });
    emit({ type: "cards", steps: result.steps, cards: result.cards, mode: result.mode });
    emit({ type: "delta", text: result.reply });
    emit({ type: "done" });
    return;
  }

  const messages = buildMessages(history, message);
  let steps = [];
  let directReply = "";

  try {
    const round = await executeToolRound(messages, emit);
    steps = round.steps;
    directReply = round.directReply;
  } catch (error) {
    if (isProviderError(error)) {
      console.warn(error.message);
      emit({ type: "notice", message: error.userMessage });
      const fallback = await runFallbackAgent({ message });
      emit({ type: "cards", steps: fallback.steps, cards: fallback.cards, mode: "fallback" });
      emit({ type: "delta", text: fallback.reply });
      emit({ type: "done" });
      return;
    }

    if (isLookupError(error)) {
      emit({ type: "notice", message: "PokeAPI 没有找到对应数据。" });
      emit({ type: "delta", text: createNoResultReply(message) });
      emit({ type: "done" });
      return;
    }

    throw error;
  }
  const cards = mergeCards(steps);

  if (directReply) {
    emit({ type: "cards", steps, cards, mode: "openrouter" });
    emit({ type: "delta", text: directReply });
    emit({ type: "done" });
    return;
  }

  emit({ type: "cards", steps, cards, mode: "openrouter" });
  messages.push({ role: "user", content: finalAnswerPrompt });

  let streamed = "";
  const deterministic = createDeterministicReply(cards);

  try {
    for await (const token of streamOpenRouter(messages)) {
      streamed += token;
      emit({ type: "delta", text: token });
    }
  } catch (error) {
    console.warn(`Streaming summary failed, using deterministic reply: ${error.message}`);
    if (isProviderError(error)) {
      emit({ type: "notice", message: `${error.userMessage} 已先展示工具结果和规则摘要。` });
    }
  }

  if (!streamed.trim()) emit({ type: "delta", text: deterministic });
  emit({ type: "done" });
}
