import React, { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const starterPrompts = [
  "帮我推荐一支均衡队伍",
  "对手是喷火龙，我该怎么应对？",
  "查询皮卡丘的属性和种族值",
  "火系克制什么？",
  "十万伏特这个招式怎么样？"
];

const typeColors = {
  normal: "#8f9488",
  fire: "#e35d2f",
  water: "#3c7edb",
  electric: "#d99a19",
  grass: "#469c4a",
  ice: "#54a7b7",
  fighting: "#b54242",
  poison: "#8b55a2",
  ground: "#b98542",
  flying: "#7589c9",
  psychic: "#d85886",
  bug: "#77952e",
  rock: "#9b8445",
  ghost: "#5b5a9c",
  dragon: "#6652c7",
  dark: "#55515a",
  steel: "#6f8791",
  fairy: "#d774a6"
};

function TypeBadge({ type }) {
  if (!type) return null;
  const color = typeColors[type.name] || "#687064";
  return (
    <span className="type-badge" style={{ "--type-color": color }}>
      {type.label || type.name}
    </span>
  );
}

function StatBars({ stats = [], compact = false }) {
  if (!stats.length) return null;

  return (
    <div className={`stat-bars ${compact ? "compact" : ""}`}>
      {stats.map((stat) => (
        <div className="stat-row" key={stat.key}>
          <span>{stat.label}</span>
          <div className="stat-track">
            <i style={{ width: `${Math.min(100, Math.round((stat.value / 180) * 100))}%` }} />
          </div>
          <strong>{stat.value}</strong>
        </div>
      ))}
    </div>
  );
}

function PokemonCard({ pokemon, onOpen }) {
  const topStats = [...(pokemon.stats || [])].sort((a, b) => b.value - a.value).slice(0, 3);

  return (
    <article className="pokemon-card">
      <div className="pokemon-art">
        {pokemon.image ? <img src={pokemon.image} alt={pokemon.displayName || pokemon.name} /> : null}
      </div>
      <div className="pokemon-body">
        <div className="card-title-row">
          <div>
            <p className="dex-number">#{String(pokemon.id).padStart(3, "0")}</p>
            <h3>{pokemon.displayName || pokemon.name}</h3>
          </div>
          <span className="total-stat">{pokemon.totalStats}</span>
        </div>
        <div className="type-row">{pokemon.types?.map((type) => <TypeBadge key={type.name} type={type} />)}</div>
        <StatBars stats={topStats} compact />
        <button className="link-button" type="button" onClick={() => onOpen(pokemon)}>
          查看详情
        </button>
      </div>
    </article>
  );
}

function TeamView({ team, onOpen }) {
  if (!team?.pokemon?.length) return null;

  return (
    <section className="team-view">
      <div className="section-header">
        <div>
          <h3>队伍组合</h3>
          <p>{team.coverage?.notes || "6 只宝可梦队伍概览"}</p>
        </div>
        <span className="strategy-pill">{team.strategy}</span>
      </div>
      <div className="team-grid">
        {team.pokemon.map((pokemon) => (
          <button className="team-slot" type="button" key={pokemon.id} onClick={() => onOpen(pokemon)}>
            {pokemon.sprite || pokemon.image ? <img src={pokemon.sprite || pokemon.image} alt={pokemon.name} /> : null}
            <strong>{pokemon.displayName || pokemon.name}</strong>
            <span>{pokemon.types?.map((type) => type.label).join(" / ")}</span>
          </button>
        ))}
      </div>
      {team.coverage ? <CoveragePanel coverage={team.coverage} /> : null}
    </section>
  );
}

function CoveragePanel({ coverage }) {
  return (
    <div className="coverage-panel">
      <div>
        <h4>进攻覆盖</h4>
        <div className="chip-row">
          {coverage.offensiveSuperEffectiveTypes?.slice(0, 18).map((type) => <TypeBadge key={type.name} type={type} />)}
        </div>
      </div>
      <div>
        <h4>主要风险</h4>
        <div className="weakness-list">
          {coverage.majorWeaknesses?.map((type) => (
            <span key={type.name}>
              {type.label} × {type.count}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function MatchupCard({ matchup }) {
  return (
    <article className="info-card">
      <div className="section-header">
        <h3>属性克制：{matchup.type?.label}</h3>
        <TypeBadge type={matchup.type} />
      </div>
      <MatchupGroup title="进攻双倍" list={matchup.doubleDamageTo} />
      <MatchupGroup title="进攻减半" list={matchup.halfDamageTo} />
      <MatchupGroup title="防守弱点" list={matchup.doubleDamageFrom} />
      <MatchupGroup title="防守抗性" list={matchup.halfDamageFrom} />
      <MatchupGroup title="免疫" list={matchup.noDamageFrom} />
    </article>
  );
}

function MatchupGroup({ title, list = [] }) {
  if (!list.length) return null;
  return (
    <div className="matchup-group">
      <h4>{title}</h4>
      <div className="chip-row">{list.map((type) => <TypeBadge key={type.name} type={type} />)}</div>
    </div>
  );
}

function MoveCard({ move }) {
  return (
    <article className="info-card move-card">
      <div className="section-header">
        <h3>{move.name}</h3>
        <TypeBadge type={move.type} />
      </div>
      <div className="move-metrics">
        <Metric label="威力" value={move.power ?? "-"} />
        <Metric label="命中" value={move.accuracy ? `${move.accuracy}%` : "-"} />
        <Metric label="PP" value={move.pp ?? "-"} />
        <Metric label="类型" value={move.damageClass || "-"} />
      </div>
      {move.effect ? <p className="effect-text">{move.effect}</p> : null}
    </article>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Results({ cards, onOpenDetail }) {
  const teams = cards?.team || [];
  const pokemon = cards?.pokemon || [];
  const matchups = cards?.matchups || [];
  const moves = cards?.moves || [];
  const teamIds = new Set(teams.flatMap((team) => team.pokemon?.map((item) => item.id) || []));
  const standalonePokemon = pokemon.filter((item, index, array) => {
    if (teamIds.has(item.id)) return false;
    return array.findIndex((candidate) => candidate.id === item.id) === index;
  });

  if (!teams.length && !standalonePokemon.length && !matchups.length && !moves.length) return null;

  return (
    <div className="results-stack">
      {teams.map((team, index) => <TeamView team={team} key={`${team.strategy}-${index}`} onOpen={onOpenDetail} />)}
      {standalonePokemon.length ? (
        <div className="pokemon-grid">
          {standalonePokemon.map((item) => <PokemonCard pokemon={item} key={item.id} onOpen={onOpenDetail} />)}
        </div>
      ) : null}
      {matchups.map((matchup, index) => <MatchupCard matchup={matchup} key={`${matchup.type?.name}-${index}`} />)}
      {moves.map((move) => <MoveCard move={move} key={move.id} />)}
    </div>
  );
}

function ToolSteps({ steps = [] }) {
  if (!steps.length) return null;
  return (
    <div className="tool-steps">
      <span>Tool 调用链</span>
      {steps.map((step, index) => (
        <b key={`${step.tool}-${index}`}>{index + 1}. {step.tool}</b>
      ))}
    </div>
  );
}

function InlineMarkdown({ text }) {
  const parts = String(text || "").split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

function AssistantText({ text }) {
  return (
    <div className="assistant-text">
      {String(text || "")
        .split("\n")
        .map((line, index) => (
          <p key={index}>
            <InlineMarkdown text={line || " "} />
          </p>
        ))}
    </div>
  );
}

function MessageBubble({ item, onOpenDetail }) {
  const isUser = item.role === "user";
  return (
    <div className={`message ${isUser ? "user" : "assistant"}`}>
      <div className="bubble">
        {isUser ? <p>{item.content}</p> : <AssistantText text={item.content} />}
        {!isUser && item.streaming ? <span className="cursor" /> : null}
        {!isUser && item.notice ? <div className="notice">{item.notice}</div> : null}
        {!isUser && item.mode === "fallback" ? <div className="notice">未配置 OpenRouter Key，当前为本地降级演示。</div> : null}
        {!isUser ? <ToolSteps steps={item.steps} /> : null}
      </div>
      {!isUser ? <Results cards={item.cards} onOpenDetail={onOpenDetail} /> : null}
    </div>
  );
}

function DetailModal({ pokemon, onClose }) {
  if (!pokemon) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="detail-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="关闭详情">×</button>
        <div className="modal-art">
          {pokemon.image ? <img src={pokemon.image} alt={pokemon.displayName || pokemon.name} /> : null}
        </div>
        <div className="modal-content">
          <p className="dex-number">#{String(pokemon.id).padStart(3, "0")}</p>
          <h2>{pokemon.displayName || pokemon.name}</h2>
          <div className="type-row">{pokemon.types?.map((type) => <TypeBadge key={type.name} type={type} />)}</div>
          {pokemon.flavorText ? <p className="flavor-text">{pokemon.flavorText}</p> : null}
          <div className="modal-metrics">
            <Metric label="身高" value={`${pokemon.height / 10} m`} />
            <Metric label="体重" value={`${pokemon.weight / 10} kg`} />
            <Metric label="总种族值" value={pokemon.totalStats} />
          </div>
          <section className="modal-section">
            <h3>种族值</h3>
            <StatBars stats={pokemon.stats} />
          </section>
          <section className="modal-section">
            <h3>特性</h3>
            <div className="chip-row">
              {pokemon.abilities?.map((ability) => (
                <span className="plain-chip" key={ability.name}>
                  {ability.name}{ability.hidden ? "（隐藏）" : ""}
                </span>
              ))}
            </div>
          </section>
          {pokemon.evolution?.length ? (
            <section className="modal-section">
              <h3>进化链</h3>
              <div className="evolution-chain">
                {pokemon.evolution.map((name, index) => (
                  <React.Fragment key={name}>
                    {index > 0 ? <span>→</span> : null}
                    <b>{name}</b>
                  </React.Fragment>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function App() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "描述你的对战需求、偏好或想查询的宝可梦，我会调用 PokeAPI 帮你组队和分析属性克制。",
      steps: [],
      cards: { pokemon: [], team: [], matchups: [], moves: [] }
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const inputRef = useRef(null);

  const apiHistory = useMemo(
    () =>
      messages
        .filter((item) => item.role === "user" || item.role === "assistant")
        .map((item) => ({ role: item.role, content: item.content })),
    [messages]
  );

  async function sendMessage(text = input) {
    const content = text.trim();
    if (!content || loading) return;

    const assistantId = `assistant-${Date.now()}`;
    setMessages((current) => [
      ...current,
      { role: "user", content },
      {
        id: assistantId,
        role: "assistant",
        content: "",
        steps: [],
        cards: { pokemon: [], team: [], matchups: [], moves: [] },
        mode: "openrouter",
        streaming: true
      }
    ]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, history: apiHistory })
      });

      if (!response.ok) throw new Error("请求失败");

      await readSseStream(response, (event) => {
        if (event.type === "cards") {
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantId
                ? { ...item, steps: event.steps || [], cards: event.cards || item.cards, mode: event.mode || item.mode }
                : item
            )
          );
        }

        if (event.type === "notice") {
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantId ? { ...item, notice: event.message || "已切换到降级策略。" } : item
            )
          );
        }

        if (event.type === "delta") {
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantId ? { ...item, content: `${item.content}${event.text || ""}` } : item
            )
          );
        }

        if (event.type === "error") throw new Error(event.message || "处理失败");
      });

      setMessages((current) => current.map((item) => (item.id === assistantId ? { ...item, streaming: false } : item)));
    } catch (error) {
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantId
            ? { ...item, content: `抱歉，处理失败：${error.message}`, steps: [], cards: { pokemon: [], team: [], matchups: [], moves: [] }, streaming: false }
            : item
        )
      );
    } finally {
      setLoading(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendMessage();
  }

  return (
    <main className="app-shell">
      <aside className="side-panel">
        <div>
          <p className="eyebrow">AI Agent</p>
          <h1>宝可梦队伍策略师</h1>
          <p className="summary">基于 PokeAPI 和 OpenRouter Tool Calling 的对战组队与属性分析工具。</p>
        </div>
        <div className="prompt-list">
          {starterPrompts.map((prompt) => (
            <button key={prompt} type="button" onClick={() => sendMessage(prompt)}>{prompt}</button>
          ))}
        </div>
      </aside>

      <section className="chat-panel">
        <header className="chat-header">
          <div>
            <h2>策略对话</h2>
            <p>组队、属性克制、招式查询、对战建议</p>
          </div>
          <span className="status-dot">{loading ? "分析中" : "在线"}</span>
        </header>

        <div className="messages">
          {messages.map((item, index) => (
            <MessageBubble item={item} key={`${item.role}-${index}`} onOpenDetail={setDetail} />
          ))}
        </div>

        <form className="composer" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="例如：对手是岩石系，帮我组一支队伍"
          />
          <button type="submit" disabled={loading || !input.trim()}>发送</button>
        </form>
      </section>
      <DetailModal pokemon={detail} onClose={() => setDetail(null)} />
    </main>
  );
}

async function readSseStream(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const eventText of events) {
      const dataLine = eventText.split("\n").find((line) => line.startsWith("data:"));
      if (!dataLine) continue;
      const payload = dataLine.slice(5).trim();
      if (!payload) continue;
      onEvent(JSON.parse(payload));
    }
  }
}

createRoot(document.getElementById("root")).render(<App />);
