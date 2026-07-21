import { NextResponse } from "next/server";
import { makeId, readData } from "@/server/data/store";
import { listKnowledge } from "@/server/repositories/knowledge";
import { appendLearningMessages, setLearningConversationPersona } from "@/server/repositories/learningConversations";
import { findCompanyPersonaById, findCompanyPersonaByName } from "@/server/repositories/companyPersonas";
import { buildCompanyPersonaContext, buildKnowledgeContext, buildProductCatalogContext, buildProductRagContext, buildSalesScriptCoachContext } from "@/server/learning/answerSalesLearningQuestion";
import { searchProductRag } from "@/server/rag/ragClient";
import { askDeepSeekSalesCoach, type SalesLearningCategory } from "@/server/ai/deepseek";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.content !== "string" || !body.content.trim())
    return NextResponse.json({ error: "content is required" }, { status: 400 });

  const now = new Date().toISOString();

  // 读取对话，获取分类
  const data = await readData();
  const conversation = (data.learningConversations || []).find((c) => c.id === params.id);

  const question = body.content.trim();
  const category = (conversation?.category || "product") as SalesLearningCategory;
  let context = "";

  if (category === "product") {
    const hits = await searchProductRag(question, 5);
    context = [buildProductCatalogContext(data.products), buildProductRagContext(hits)].filter(Boolean).join("\n\n");
  } else if (category === "market") {
    const matchedPersona = await findCompanyPersonaByName(question);
    const existingPersona = !matchedPersona && conversation?.targetCompanyPersonaId
      ? await findCompanyPersonaById(conversation.targetCompanyPersonaId)
      : null;
    const persona = matchedPersona || existingPersona;
    const knowledge = await listKnowledge();
    context = [persona ? buildCompanyPersonaContext(persona) : "", buildKnowledgeContext(question, knowledge)].filter(Boolean).join("\n\n");
    if (matchedPersona) await setLearningConversationPersona(params.id, matchedPersona);
  } else if (category === "script") {
    const knowledge = await listKnowledge();
    context = [buildSalesScriptCoachContext(), buildKnowledgeContext(question, knowledge)].filter(Boolean).join("\n\n");
  } else {
    const knowledge = await listKnowledge();
    context = buildKnowledgeContext(question, knowledge);
  }

  const coachContent = await askDeepSeekSalesCoach({ category, question, context });

  const learner = {
    id: makeId("message"),
    role: "learner" as const,
    content: question,
    createdAt: now,
  };
  const coach = {
    id: makeId("message"),
    role: "coach" as const,
    content: coachContent,
    createdAt: now,
  };

  const updated = await appendLearningMessages(params.id, [learner, coach]);
  return updated
    ? NextResponse.json(updated)
    : NextResponse.json({ error: "conversation not found" }, { status: 404 });
}
