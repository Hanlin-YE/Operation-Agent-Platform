type KnowledgeSnippet = { title: string; content: string };

export function answerSalesLearningQuestion(question: string, knowledge: KnowledgeSnippet[]) {
  const query = question.toLocaleLowerCase();
  const match = knowledge.find((item) => `${item.title} ${item.content}`.toLocaleLowerCase().split(/\s|，|。|、|；/).some((word) => word.length > 1 && query.includes(word))) || knowledge[0];
  if (!match) return "先说明客户的实际场景，再确认工况、决策角色和下一步动作；需要技术承诺时请转交人工确认。";
  return `复习要点来自「${match.title}」：${match.content}\n\n建议你下一步用自己的话复述该要点，并补充一句面向客户的澄清提问。`;
}
