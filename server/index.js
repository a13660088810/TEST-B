import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { runAgent, runAgentStream, runFallbackAgent } from "./agent.js";
import { getMoveDetail, getTypeMatchups, recommendTeam, searchPokemon } from "./pokeApi.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3002);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
    model: process.env.OPENROUTER_MODEL || "openrouter/free"
  });
});

app.post("/api/chat", async (req, res) => {
  const { message, history } = req.body || {};

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message is required" });
    return;
  }

  try {
    const result = process.env.OPENROUTER_API_KEY
      ? await runAgent({ message, history: Array.isArray(history) ? history : [] })
      : await runFallbackAgent({ message, history: Array.isArray(history) ? history : [] });
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Agent failed",
      detail: "服务暂时不可用，请稍后重试或换一个更明确的查询。"
    });
  }
});

function sendSse(res, event) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

app.post("/api/chat/stream", async (req, res) => {
  const { message, history } = req.body || {};

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  try {
    await runAgentStream({
      message,
      history: Array.isArray(history) ? history : [],
      onEvent: (event) => sendSse(res, event)
    });
  } catch (error) {
    console.error(error);
    sendSse(res, {
      type: "error",
      message: "服务暂时不可用，请稍后重试或换一个更明确的查询。"
    });
  } finally {
    res.end();
  }
});

app.get("/api/pokemon/:name", async (req, res) => {
  try {
    res.json(await searchPokemon({ name: req.params.name }));
  } catch (error) {
    res.status(error.message.includes("404") ? 404 : 500).json({
      error: error.message.includes("404") ? "未找到对应宝可梦，请换英文名、编号或常见中文名。" : "查询失败，请稍后重试。"
    });
  }
});

app.get("/api/type/:type", async (req, res) => {
  try {
    res.json(await getTypeMatchups({ type: req.params.type }));
  } catch (error) {
    res.status(error.message.includes("404") ? 404 : 500).json({
      error: error.message.includes("404") ? "未找到对应属性，请换一个属性名称。" : "查询失败，请稍后重试。"
    });
  }
});

app.get("/api/move/:move", async (req, res) => {
  try {
    res.json(await getMoveDetail({ move: req.params.move }));
  } catch (error) {
    res.status(error.message.includes("404") ? 404 : 500).json({
      error: error.message.includes("404") ? "未找到对应招式，请尝试英文招式名或常见中文招式名。" : "查询失败，请稍后重试。"
    });
  }
});

app.get("/api/team/recommend", async (req, res) => {
  try {
    res.json(await recommendTeam(req.query));
  } catch (error) {
    res.status(500).json({ error: "队伍推荐失败，请稍后重试。" });
  }
});

app.listen(port, () => {
  console.log(`Pokemon team agent server listening on http://localhost:${port}`);
});
