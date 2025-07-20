import { LLM, BaseLLMParams } from "@langchain/core/language_models/llms";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";

interface CloudflareLLMParams extends BaseLLMParams {
  accountId: string;
  apiToken: string;
  model?: string;
  maxTokens?: number;
}

export class CloudflareLLM extends LLM {
  accountId: string;
  apiToken: string;
  model: string;
  maxTokens: number;

  constructor(params: CloudflareLLMParams) {
    super(params);
    this.accountId = params.accountId;
    this.apiToken = params.apiToken;
    this.model = params.model || "@cf/google/gemma-3-12b-it";
    this.maxTokens = params.maxTokens || 250;
  }

  _llmType() {
    return "cloudflare";
  }

  async _call(
    prompt: string,
    options?: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    try {
      console.log(`🤖 Cloudflare LLM: Calling ${this.model}`);

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${this.model}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: prompt }],
            max_tokens: this.maxTokens,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Cloudflare API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      const result = data.result?.response || "No response from Cloudflare";

      console.log(
        `✅ Cloudflare LLM: Response received (${result.length} chars)`
      );
      return result;
    } catch (error) {
      console.error("❌ Cloudflare LLM Error:", error);
      throw error;
    }
  }
}
