import dotenv from "dotenv";
import path from "path";
import express from "express";
import cors from "cors";
import { graph } from "./agent/graph";
import { Message, ToolCall } from "./agent/state";
import { irisAgent } from "./services/irisAgent";
import { triageRequest } from "./services/triageAgent";

dotenv.config({ path: path.join(__dirname, "../../.env") });

const app = express();
app.use(cors());
app.use(express.json());

type ReasoningEvent = { type: "reasoning"; node: string; label: string; detail: string; route?: string };
type PipelineLogEvent = { type: "pipeline"; node: string; stage: string; status: string; detail: string };
type ResponseEvent  = { type: "response"; text: string };
type ErrorEvent     = { type: "error"; message: string };
type SseEvent       = ReasoningEvent | PipelineLogEvent | ResponseEvent | ErrorEvent;

const NODE_LABELS: Record<string, string> = {
  loadContext:    "Loading context",
  callLlm:        "Thinking",
  executeTools:   "Using tools",
  saveAndRespond: "Done",
};

function deriveDetail(nodeName: string, output: Record<string, unknown>): string {
  switch (nodeName) {
    case "loadContext": {
      const msgs = output.messages as Message[] | undefined;
      // messages = [system, ...history, user] — subtract 2 for system + current user
      const historyCount = msgs ? Math.max(0, msgs.length - 2) : 0;
      const toolCount = (output.tools as unknown[] | undefined)?.length ?? 0;
      return `Loaded ${historyCount} past message${historyCount !== 1 ? "s" : ""} · ${toolCount} tool${toolCount !== 1 ? "s" : ""} available`;
    }
    case "callLlm": {
      const msgs = output.messages as Message[] | undefined;
      const toolCalls = msgs?.[msgs.length - 1]?.tool_calls as ToolCall[] | undefined;
      if (toolCalls?.length) {
        const names = toolCalls.map((tc) => tc.function.name).join(", ");
        return `Calling tool${toolCalls.length > 1 ? "s" : ""}: ${names}`;
      }
      return "Groq responded";
    }
    case "executeTools": {
      const msgs = output.messages as Message[] | undefined;
      const result = msgs?.map((m) => m.content ?? "").join(" · ") ?? "";
      return result.slice(0, 120) || "Tool executed";
    }
    case "saveAndRespond":
      return "Conversation saved";
    default:
      return "";
  }
}

const setupChatAPI = async () => {
  app.post("/api/chat", async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const writeEvent = (event: SseEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      const { message } = req.body;
      console.log("🔍 Received message:", message);

      const stream = await graph.stream(
        { userId: "default_user", userMessage: message, messages: [], tools: [], responseText: null },
        { streamMode: "updates", recursionLimit: 10 },
      );

      let responseText = "I'm sorry, I couldn't process that.";

      for await (const chunk of stream) {
        for (const [nodeName, nodeOutput] of Object.entries(chunk)) {
          const output = nodeOutput as Record<string, unknown>;
          let route: string | undefined;
          if (nodeName === "callLlm") {
            const msgs = output.messages as Array<{ tool_calls?: unknown[] }> | undefined;
            route = msgs?.[msgs.length - 1]?.tool_calls?.length
              ? "executeTools"
              : "saveAndRespond";
          }

          writeEvent({
            type:   "reasoning",
            node:   nodeName,
            label:  NODE_LABELS[nodeName] ?? nodeName,
            detail: deriveDetail(nodeName, output),
            ...(route && { route }),
          });

          const pipelineLog = output.pipelineLog as Array<{ stage: string; status: string; detail: string }> | undefined;
          if (pipelineLog) {
            for (const entry of pipelineLog) {
              writeEvent({ type: "pipeline", node: nodeName, ...entry });
            }
          }

          if (nodeName === "saveAndRespond" && typeof output.responseText === "string") {
            responseText = output.responseText;
          }
        }
      }

      writeEvent({ type: "response", text: responseText });
    } catch (error) {
      console.error("❌ Chat Error:", error);
      writeEvent({ type: "error", message: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      res.end();
    }
  });

  app.post("/api/feature-request", async (req, res) => {
    try {
      const { title, description } = req.body as { title: string; description: string };
      if (!title?.trim() || !description?.trim()) {
        res.status(400).json({ error: "title and description are required" });
        return;
      }

      console.log("🎫 Feature request received:", title);

      // 1. Create issue in GitHub with triage label
      const createResult = await irisAgent.createGithubIssue({
        title,
        body: description,
        labels: ["triage"],
      });
      console.log("✅ Issue created:", createResult);

      // Parse issue number from "Issue #42 created: https://..."
      const issueMatch = createResult.match(/Issue #(\d+)/);
      const issueNumber = issueMatch ? parseInt(issueMatch[1]) : null;
      const urlMatch = createResult.match(/https:\/\/\S+/);
      const issueUrl = urlMatch ? urlMatch[0] : null;

      // 2. Run triage agent
      console.log("🔍 Running triage agent...");
      const triage = await triageRequest(title, description);
      console.log("🤖 Triage result:", triage.action);

      // 3. Update issue with triage output
      if (issueNumber) {
        if (triage.action === "accept") {
          await irisAgent.updateGithubIssue({
            issue_number: issueNumber,
            title: triage.title,
            body: triage.body,
            labels: ["review"],
          });
        } else {
          await irisAgent.updateGithubIssue({
            issue_number: issueNumber,
            body: `**Rejected:** ${triage.reason}\n\n---\n\n**Original request:**\n${description}`,
            labels: ["wontfix"],
          });
        }
      }

      res.json({
        success: true,
        issue_number: issueNumber,
        issue_url: issueUrl,
        triage: triage.action,
        ...(triage.action === "accept"
          ? { title: triage.title }
          : { reason: triage.reason }),
      });
    } catch (error) {
      console.error("❌ Feature request error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`🤖 Millie API server running on port ${PORT}`);
  });
};

setupChatAPI();
