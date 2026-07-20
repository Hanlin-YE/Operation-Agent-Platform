import { FollowUp, GeneratedPitch, LeadScore } from "@/server/data/types";
import { getFrictionXCatalogProduct } from "@/server/data/frictionxCatalog";
import { makeId, readData, writeData } from "@/server/data/store";

export async function listScoresByLead(leadId: string) {
  const data = await readData();
  return data.scores
    .filter((score) => score.leadId === leadId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveScore(score: Omit<LeadScore, "id" | "createdAt">) {
  const data = await readData();
  const item: LeadScore = {
    ...score,
    id: makeId("score"),
    createdAt: new Date().toISOString()
  };
  data.scores.unshift(item);
  await writeData(data);
  return item;
}

export async function listPitchesByLead(leadId: string) {
  const data = await readData();
  return data.pitches
    // 历史演示话术可能引用了旧的通用电机；保留在原始数据中，但
    // 不得在 Friction X 产品工作台继续展示或参与业务决策。
    .filter((pitch) => pitch.leadId === leadId && (!pitch.productId || Boolean(getFrictionXCatalogProduct(pitch.productId))))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function savePitch(pitch: Omit<GeneratedPitch, "id" | "createdAt">) {
  const data = await readData();
  const item: GeneratedPitch = {
    ...pitch,
    id: makeId("pitch"),
    createdAt: new Date().toISOString()
  };
  data.pitches.unshift(item);
  await writeData(data);
  return item;
}

export async function updatePitchContent(id: string, content: string) {
  const data = await readData();
  const pitch = data.pitches.find((item) => item.id === id);
  if (!pitch) return null;
  pitch.content = content.trim();
  await writeData(data);
  return pitch;
}

export async function listFollowUpsByLead(leadId: string) {
  const data = await readData();
  return data.followUps
    .filter((followUp) => followUp.leadId === leadId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveFollowUp(followUp: Omit<FollowUp, "id" | "createdAt">) {
  const data = await readData();
  const item: FollowUp = {
    ...followUp,
    id: makeId("followup"),
    createdAt: new Date().toISOString()
  };
  data.followUps.unshift(item);
  await writeData(data);
  return item;
}

export async function updateFollowUpStatus(id: string, status: FollowUp["status"]) {
  const data = await readData();
  const followUp = data.followUps.find((item) => item.id === id);
  if (!followUp) return null;
  followUp.status = status;
  await writeData(data);
  return followUp;
}
