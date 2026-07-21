type CompletionInput = {
  system: string;
  user: string;
};

export type JsonCompletionResult<T> =
  | { status: "ok"; data: T }
  | { status: "model_not_configured" }
  | { status: "error"; message: string };

export type JsonCompletionInput = CompletionInput & {
  images?: { mimeType: string; dataUrl: string }[];
};

export async function generateCompletion(input: CompletionInput) {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const response = await fetch(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user }
      ],
      temperature: 0.5
    })
  });

  if (!response.ok) return null;
  const json = await response.json();
  return json.choices?.[0]?.message?.content as string | null;
}

/** Calls the configured compatible Chat Completions endpoint from the server only. */
export async function generateJsonCompletion<T>(input: JsonCompletionInput): Promise<JsonCompletionResult<T>> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { status: "model_not_configured" };

  const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
    { type: "text", text: input.user }
  ];
  for (const image of input.images || []) content.push({ type: "image_url", image_url: { url: image.dataUrl } });

  try {
    const response = await fetch(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [{ role: "system", content: input.system }, { role: "user", content }],
        response_format: { type: "json_object" },
        temperature: 0.2
      })
    });
    if (!response.ok) return { status: "error", message: "模型请求未成功，请检查服务端模型配置。" };
    const payload = await response.json();
    const raw = payload.choices?.[0]?.message?.content;
    if (typeof raw !== "string") return { status: "error", message: "模型没有返回可解析的结构化内容。" };
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
    return { status: "ok", data: JSON.parse(cleaned) as T };
  } catch {
    return { status: "error", message: "模型返回的结构化内容无效或连接失败。" };
  }
}
