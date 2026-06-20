import { Annotation } from "@langchain/langgraph";

export type Role = "system" | "user" | "assistant" | "tool";

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type Message = {
  role: Role;
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

export type PipelineEvent = {
  stage: string;
  status: "done" | "skip" | "error";
  detail: string;
};

export const StateAnnotation = Annotation.Root({
  userId: Annotation<string>(),
  userMessage: Annotation<string>(),
  // Reducer appends new messages rather than replacing the array.
  messages: Annotation<Message[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  tools: Annotation<unknown[]>(),
  responseText: Annotation<string | null>(),
  toolError: Annotation<string | undefined>(),
  pipelineLog: Annotation<PipelineEvent[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
});

export type AgentState = typeof StateAnnotation.State;
