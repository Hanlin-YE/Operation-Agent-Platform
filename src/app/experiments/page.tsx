const sections = [
  { title: "内容运营", links: [ ["AI 内容生成", "/aigc?type=text"], ["发布记录", "/content"], ["用户数据分析", "/content/review"], ["内部内容排行", "/content/inbox"], ["视频播放器", "/content/player"] ] },
  { title: "知识研究", links: [ ["论文与专利知识库", "/content/library"], ["市场分析", "/marketing"], ["知识关系图谱", "/graph"] ] },
  { title: "其他封存模块", links: [ ["销售培训", "/agent"] ] }
];

export default function ExperimentsPage() {
  return <>
    <div className="page-head"><div><p className="eyebrow">实验区 · 已封存</p><h1>历史模块</h1><p className="subtle">保留已有页面供查阅，暂停新增功能和外部服务接入。日常工作从销售线索和跟进任务开始。</p></div><a className="button" href="/">返回今日待跟进</a></div>
    <div className="grid cols-3">{sections.map((section) => <section className="panel" key={section.title}><h2>{section.title}</h2><div className="sales-task-list">{section.links.map(([title, href]) => <a key={href} className="sales-task" href={href}>{title}<span className="badge">实验模块</span></a>)}</div></section>)}</div>
  </>;
}
