import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export type GroqTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

let _client: Client | null = null;

async function getClient(): Promise<Client> {
  if (_client) return _client;

  const irisUrl = process.env.IRIS_URL;
  const apiKey = process.env.IRIS_API_KEY;

  if (!irisUrl) throw new Error("IRIS_URL environment variable is required");

  const client = new Client({ name: "millie", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(irisUrl), {
    requestInit: apiKey ? { headers: { "x-api-key": apiKey } } : undefined,
  });

  await client.connect(transport);
  _client = client;
  console.log("🌸 Connected to Iris MCP server at", irisUrl);
  return client;
}

export async function getIrisTools(): Promise<GroqTool[]> {
  const client = await getClient();
  const { tools } = await client.listTools();
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description ?? "",
      parameters: tool.inputSchema as Record<string, unknown>,
    },
  }));
}

export async function callIrisTool(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  const client = await getClient();
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as Array<{ type: string; text?: string }>;
  const text = content.find((c) => c.type === "text")?.text ?? "Tool executed successfully";
  if (result.isError) throw new Error(text);
  return text;
}
