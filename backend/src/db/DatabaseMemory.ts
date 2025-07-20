import { BaseMemory } from "@langchain/core/memory";
import {
  InputValues,
  OutputValues,
  MemoryVariables,
} from "@langchain/core/memory";
import { saveConversation, getRecentHistory } from "./memory";

export class DatabaseMemory extends BaseMemory {
  private userId: string;
  private k: number;

  constructor(userId: string = "default_user", k: number = 5) {
    super();
    this.userId = userId;
    this.k = k;
  }

  get memoryKeys(): string[] {
    return ["history"];
  }

  async loadMemoryVariables(
    _values: InputValues = {}
  ): Promise<MemoryVariables> {
    const history = await getRecentHistory(this.userId, this.k);
    return { history };
  }

  async saveContext(
    inputValues: InputValues,
    outputValues: OutputValues
  ): Promise<void> {
    const input = inputValues.input || inputValues.question;
    const output = outputValues.response || outputValues.output;

    if (input && output) {
      await saveConversation(this.userId, input, output);
    }
  }

  async clear(): Promise<void> {
    // Could implement database clearing if needed
    console.log("DatabaseMemory.clear() called - implement if needed");
  }
}
