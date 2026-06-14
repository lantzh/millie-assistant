import { StateGraph, END, START } from "@langchain/langgraph";
import { StateAnnotation, AgentState } from "./state";
import { loadContext, callLlm, executeTools, saveAndRespond } from "./nodes";

function routeAfterLlm(state: AgentState): "executeTools" | "saveAndRespond" {
  const lastMessage = state.messages[state.messages.length - 1];
  return lastMessage.tool_calls?.length ? "executeTools" : "saveAndRespond";
}

function routeAfterTools(state: AgentState): "callLlm" | "saveAndRespond" {
  return state.toolError ? "saveAndRespond" : "callLlm";
}

const builder = new StateGraph(StateAnnotation)
  .addNode("loadContext", loadContext)
  .addNode("callLlm", callLlm)
  .addNode("executeTools", executeTools)
  .addNode("saveAndRespond", saveAndRespond)
  .addEdge(START, "loadContext")
  .addEdge("loadContext", "callLlm")
  .addConditionalEdges("callLlm", routeAfterLlm, {
    executeTools: "executeTools",
    saveAndRespond: "saveAndRespond",
  })
  .addConditionalEdges("executeTools", routeAfterTools, {
    callLlm: "callLlm",
    saveAndRespond: "saveAndRespond",
  })
  .addEdge("saveAndRespond", END);

export const graph = builder.compile();
