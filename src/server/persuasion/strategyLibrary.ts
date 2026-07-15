export type PersuasionStrategy = { id: string; label: string; trigger: string; objective: string };

export const persuasionStrategies: PersuasionStrategy[] = [
  { id: "empathy", label: "共情确认", trigger: "客户担忧", objective: "先确认顾虑，再澄清一个约束" },
  { id: "clarify_concern", label: "澄清顾虑", trigger: "技术/寿命/交期问题", objective: "定位具体约束，不作无证据承诺" },
  { id: "guided_next_step", label: "小步推进", trigger: "客户有兴趣", objective: "推荐审核资料、视频或预约" },
  { id: "human_handoff", label: "人工交接", trigger: "报价/合同/性能", objective: "转交客户经理" }
];

export function selectStrategy(message: string) {
  if (/(价格|报价|合同|寿命|参数|性能)/.test(message)) return persuasionStrategies[3];
  if (/(担心|犹豫|噪声|发热|磨损|交期)/.test(message)) return persuasionStrategies[1];
  if (/(想了解|适合|应用|机器人|医疗|无人机)/.test(message)) return persuasionStrategies[2];
  return persuasionStrategies[0];
}
