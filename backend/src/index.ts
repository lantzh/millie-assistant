// src/index.ts
import dotenv from "dotenv";
import path from "path";
import express from "express";
import cors from "cors";
import { DatabaseMemory } from "./db/DatabaseMemory";
import { ConversationChain } from "langchain/chains";
import { milliePrompt } from "./prompts/millie";
import { CloudflareLLM } from "./llms/CloudflareLLM";

dotenv.config({ path: path.join(__dirname, "../../.env") });

const app = express();
app.use(cors());
app.use(express.json());

const setupChatAPI = async () => {
  const model = new CloudflareLLM({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    apiToken: process.env.CLOUDFLARE_API_TOKEN!,
    maxTokens: 250,
  });

  const memory = new DatabaseMemory("default_user", 5);

  //Create conversation chain with memory
  const chain = new ConversationChain({
    llm: model,
    memory: memory,
    prompt: milliePrompt,
    verbose: false,
  });
  app.post("/api/chat", async (req, res) => {
    try {
      const { message } = req.body;
      console.log("🔍 Received message:", message);

      const response = await chain.call({ input: message.trim() });

      res.json({ response: response.response });
    } catch (error) {
      console.error("❌ Chain Error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({
        error: "Sorry, I'm having trouble right now.",
        details: errorMessage,
      });
    }
  });

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`🤖 Millie API server running on port ${PORT}`);
  });
};

setupChatAPI();
