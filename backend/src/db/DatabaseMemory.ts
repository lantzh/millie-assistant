import { BaseMemory } from "@langchain/core/memory";
import {
  InputValues,
  OutputValues,
  MemoryVariables,
} from "@langchain/core/memory";
import { saveConversation, getRecentHistory } from "./memory";
import { CloudflareLLM } from "../llms/CloudflareLLM";

export class DatabaseMemory extends BaseMemory {
  private userId: string;
  private k: number;
  private llm?: CloudflareLLM;

  constructor(
    userId: string = "default_user",
    k: number = 5,
    llm?: CloudflareLLM
  ) {
    super();
    this.userId = userId;
    this.k = k;
    this.llm = llm;
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
      await saveConversation(this.userId, input, output, this.llm);
    }
  }
  // TODO: Nuclear option to completely wipe user from memory
  async clear(): Promise<void> {
    console.log("DatabaseMemory.clear() called");
  }
}
