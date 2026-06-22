const GROQ_API_KEY = process.env.GROQ_API_KEY!;
const GROQ_MODEL = "llama-3.3-70b-versatile";

const TRIAGE_PROMPT = `You are a product manager triaging feature requests for Millie, an AI chat assistant designed for elderly users.

Given a raw feature request, you must decide:
1. ACCEPT — the request is clear enough to write a user story for
2. REJECT — the request is too vague to act on, or clearly out of scope for an elderly care assistant

If you ACCEPT, rewrite the request as a proper GitHub issue using this format:

## User Story
As a [type of user], I want to [goal] so that [benefit].

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Notes
[Any relevant implementation context]

If you REJECT, provide a short, clear reason.

Respond with valid JSON only. No markdown, no explanation outside the JSON.

If accepting:
{
  "action": "accept",
  "title": "concise issue title in imperative form (e.g. Add dark mode support)",
  "body": "full markdown body as described above"
}

If rejecting:
{
  "action": "reject",
  "reason": "short explanation"
}`;

type TriageResult =
  | { action: "accept"; title: string; body: string }
  | { action: "reject"; reason: string };

export async function triageRequest(title: string, description: string): Promise<TriageResult> {
  const userMessage = `Title: ${title}\n\nDescription: ${description}`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: TRIAGE_PROMPT },
        { role: "user", content: userMessage },
      ],
      max_tokens: 1000,
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Groq triage error: ${response.status} ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content as string;
  const result = JSON.parse(content) as TriageResult;

  if (result.action !== "accept" && result.action !== "reject") {
    throw new Error(`Unexpected triage action: ${JSON.stringify(result)}`);
  }

  return result;
}
