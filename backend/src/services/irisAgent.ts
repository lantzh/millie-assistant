import { callIrisTool, getIrisTools } from "./irisClient";

// Iris is Millie's communication and task agent.
// Use these typed methods when Millie's own code needs to delegate work to Iris.
// (The executeTools node uses callIrisTool directly for LLM-chosen tool calls.)
export const irisAgent = {
  getTools: () => getIrisTools(),

  sendEmail: (params: { to: string; subject: string; body: string }) =>
    callIrisTool("send_email", params),

  sendSms: (params: { to: string; body: string }) =>
    callIrisTool("send_sms", params),

  createGithubIssue: (params: { title: string; body: string; labels?: string[] }) =>
    callIrisTool("create_github_issue", params),

  updateGithubIssue: (params: {
    issue_number: number;
    title?: string;
    body?: string;
    labels?: string[];
  }) => callIrisTool("update_github_issue", params),
};
