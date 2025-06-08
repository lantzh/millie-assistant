// src/index.ts
import dotenv from "dotenv";
import path from "path";
import { HuggingFaceInference } from "@langchain/community/llms/hf";
import { BufferWindowMemory } from "langchain/memory";
import { ConversationChain } from "langchain/chains";
import * as readline from "readline";

dotenv.config({ path: path.join(__dirname, "../../.env") });

const startChat = async () => {
  const model = new HuggingFaceInference({
    model: "meta-llama/Llama-3.1-8B-Instruct",
    apiKey: process.env.HUGGINGFACEHUB_API_KEY,
    maxTokens: 100,
    stopSequences: ["Human:", "\nHuman:", "User:"],
  });

  // Create memory to remember last 5 exchanges (10 messages total)
  const memory = new BufferWindowMemory({
    k: 5, // Remember last 5 conversation turns
    memoryKey: "history",
    inputKey: "input",
    outputKey: "response",
  });

  // Create conversation chain with memory
  const chain = new ConversationChain({
    llm: model,
    memory: memory,
    verbose: false,
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(
    "🤖 Millie: Hello! I'm Millie, your caring assistant. How are you feeling today?"
  );
  console.log("(Type 'exit' to quit)\n");

  const chat = () => {
    rl.question("You: ", async (input) => {
      if (input.toLowerCase() === "exit") {
        console.log("🤖 Millie: Take care! 💙");
        rl.close();
        return;
      }

      if (input.trim() === "") {
        console.log("🤖 Millie: Please say something. I'm here to listen! 💬");
      } else {
        console.log("🤖 Millie is thinking...");

        // Create a prompt that includes Millie's personality
        const prompt = `You are Millie, a caring and empathetic AI assistant. Respond helpfully and warmly to the user's message.

${input.trim()}`;

        try {
          const response = await chain.call({ input: prompt });
          const cleanResponse = response.response
            .split("Human:")[0]
            .split("\nHuman:")[0]
            .split("User:")[0]
            .split("\nUser:")[0]
            .trim();

          console.log("🤖 Millie:", cleanResponse);
        } catch (error) {
          console.error("❌ Error:", error);
          console.log(
            "🤖 Millie: Sorry, I'm having trouble connecting right now. Please try again!"
          );
        }
      }

      // Always continue the chat loop after processing
      chat();
    });
  };

  chat();
};

startChat();
