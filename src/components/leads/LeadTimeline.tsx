import { FollowUp, GeneratedPitch, LeadScore } from "@/server/data/types";

export function LeadTimeline({
  scores,
  pitches,
  followUps
}: {
  scores: LeadScore[];
  pitches: GeneratedPitch[];
  followUps: FollowUp[];
}) {
  const items = [
    ...scores.map((score) => ({
      at: score.createdAt,
      title: `评分 ${score.grade} / ${score.totalScore} 分`,
      content: score.recommendedAction
    })),
    ...pitches.map((pitch) => ({
      at: pitch.createdAt,
      title: `生成话术：${pitch.scenario}`,
      content: pitch.content.slice(0, 120)
    })),
    ...followUps.map((followUp) => ({
      at: followUp.createdAt,
      title: `跟进记录：${followUp.type}`,
      content: followUp.content.slice(0, 120)
    }))
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="panel">
      <h2>线索时间线</h2>
      {items.length ? (
        <div className="timeline">
          {items.map((item) => (
            <div className="timeline-item" key={`${item.at}-${item.title}`}>
              <h3>{item.title}</h3>
              <p className="subtle">{item.content}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="subtle">暂无评分、话术或跟进记录。</p>
      )}
    </div>
  );
}
