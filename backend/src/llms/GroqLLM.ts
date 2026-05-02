import { LLM, BaseLLMParams } from "@langchain/core/language_models/llms";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";

interface GroqLLMParams extends BaseLLMParams {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export class GroqLLM extends LLM {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;

  constructor(params: GroqLLMParams) {
    super(params);
    this.apiKey = params.apiKey;
    this.model = params.model || "llama-3.3-70b-versatile";
    this.maxTokens = params.maxTokens || 800;
    this.temperature = params.temperature || 0.7;
  }

  _llmType() {
    return "groq";
  }

  async _call(
    prompt: string,
    options?: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun,
  ): Promise<string> {
    try {
      console.log(`> Groq LLM: Calling ${this.model}`);

      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.model,
            messages: [{ role: "user", content: prompt }],
            max_tokens: this.maxTokens,
            temperature: this.temperature,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Groq API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`,
        );
      }

      const data = await response.json();
      const result =
        data.choices?.[0]?.message?.content || "No response from Groq";

      console.log(` Groq LLM: Response received (${result.length} chars)`);
      return result;
    } catch (error) {
      console.error("L Groq LLM Error:", error);
      throw error;
    }
  }
}
