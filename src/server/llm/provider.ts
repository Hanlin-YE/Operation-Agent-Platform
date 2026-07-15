type CompletionInput = {
  system: string;
  user: string;
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
