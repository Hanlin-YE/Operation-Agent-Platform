"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Award, CheckCircle2, LoaderCircle, MessageCirclePlus, MoreVertical, Pencil, Send, Trash2, X } from "lucide-react";
import { LearningCategory, LearningConversation, LearningMessage } from "@/server/data/types";
import { MarkdownMessage } from "@/components/agent/MarkdownMessage";

type LearningModule = "sales" | "customer";

const modules: { value: LearningModule; label: string; description: string }[] = [
  { value: "sales", label: "销售培训", description: "整合产品学习与营销话术训练" },
  { value: "customer", label: "模拟客户", description: "导入企业情报后进行客户沟通演练" }
];

const directions: { value: LearningCategory; label: string; description: string }[] = [
  { value: "product", label: "产品学习", description: "围绕产品资料、参数、案例进行复习" },
  { value: "script", label: "营销话术", description: "温柔陪练开场、提问、异议处理和成交推进" },
  { value: "customer", label: "模拟客户", description: "采购人员视角追问资质、交付、验证和风险" }
];

function getCategory(item: LearningConversation): LearningCategory {
  return item.category ?? "product";
}

function getModule(category: LearningCategory): LearningModule {
  return category === "customer" ? "customer" : "sales";
}

function categoryFromQuery(value: string | null): LearningCategory | null {
  return value === "script" || value === "customer" || value === "product" ? value : null;
}

function recordModuleLabel(category: LearningCategory) {
  return category === "customer" ? "模拟客户" : "销售培训";
}

function initialCategoryFromQuery(initialQuery?: { module?: string; category?: string; conversation?: string }): LearningCategory {
  return categoryFromQuery(initialQuery?.category ?? null) ?? (initialQuery?.module === "customer" ? "customer" : "product");
}

function buildCustomerTrainingScore(messages: LearningMessage[]) {
  const learnerText = messages.filter((message) => message.role === "learner").map((message) => message.content).join("\n");
  const hasLearnerInput = learnerText.trim().length > 0;
  const checks = [
    { label: "开场与客户背景", points: 16, pattern: /您好|你好|贵司|公司|场景|需求|采购|项目|应用/ },
    { label: "技术与应用匹配", points: 18, pattern: /参数|转速|扭矩|功率|电压|寿命|噪音|效率|应用|适配|选型|方案/ },
    { label: "资质与可信证据", points: 18, pattern: /认证|资质|案例|测试|报告|数据|样品|验证|交付记录|客户/ },
    { label: "交付、质量与风险回应", points: 18, pattern: /交期|交付|质量|风险|售后|批量|良率|供应|稳定|责任|验收/ },
    { label: "下一步推进", points: 16, pattern: /下一步|资料|报价|样机|样品|会议|清单|确认|跟进|发送|安排/ }
  ];
  const passed = checks.filter((check) => check.pattern.test(learnerText));
  const score = hasLearnerInput ? Math.min(96, 28 + passed.reduce((total, check) => total + check.points, 0) + Math.min(8, messages.length * 2)) : 42;
  const level = score >= 85 ? "优秀" : score >= 72 ? "良好" : score >= 60 ? "待加强" : "需要重练";
  const feedback = hasLearnerInput ? [
    passed.length ? `已覆盖：${passed.map((item) => item.label).join("、")}。` : "目前还没有明显覆盖采购关心的验证点。",
    ...checks.filter((check) => !passed.includes(check)).slice(0, 3).map((check) => `补强：${check.label}，让客户能看到可验证材料和明确动作。`),
    "建议下一轮用“客户场景复述 + 可验证证据 + 交付边界 + 下一步材料”来回应。"
  ] : [
    "还没有销售侧输入，先发送一段开场、产品介绍或异议回应后再评分。",
    "评分重点会看技术匹配、资质证据、交付风险和下一步推进。"
  ];
  return { score, level, feedback };
}

export function LearningReviewWorkbench({ initialQuery }: { initialQuery?: { module?: string; category?: string; conversation?: string } }) {
  const initializedRef = useRef(false);
  const [items, setItems] = useState<LearningConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [category, setCategory] = useState<LearningCategory>(() => initialCategoryFromQuery(initialQuery));
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState<LearningCategory | null>(null);
  const [pendingMessage, setPendingMessage] = useState<{ conversationId: string; content: string } | null>(null);
  const [sendError, setSendError] = useState("");

  const filteredItems = useMemo(() => items.filter((item) => getCategory(item) === category), [category, items]);
  const active = filteredItems.find((item) => item.id === activeId) ?? filteredItems[0];
  const activeModule = getModule(category);
  const activeDirection = directions.find((item) => item.value === category) ?? directions[0];
  const isPendingOnActive = !!active && pendingMessage?.conversationId === active.id;
  const visibleMessages = active?.messages || [];
  const scoreReview = useMemo(() => buildCustomerTrainingScore(visibleMessages), [visibleMessages]);

  const create = useCallback(async (targetCategory: LearningCategory = category) => {
    setCreatingCategory(targetCategory);
    try {
      const response = await fetch("/api/learning-conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: targetCategory })
      });
      const next = await response.json();
      setItems((current) => [next, ...current]);
      setActiveId(next.id);
      return next as LearningConversation;
    } finally {
      setCreatingCategory(null);
    }
  }, [category]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    fetch("/api/learning-conversations")
      .then((response) => response.json())
      .then((data: LearningConversation[]) => {
        setItems(data);
        const conversationId = initialQuery?.conversation;
        const requestedCategory = categoryFromQuery(initialQuery?.category ?? null);
        const requestedModule = initialQuery?.module === "customer" ? "customer" : "sales";
        const linked = conversationId ? data.find((item) => item.id === conversationId) : undefined;
        if (linked) {
          setCategory(getCategory(linked));
          setActiveId(linked.id);
          return;
        }
        const nextCategory = requestedCategory ?? (requestedModule === "customer" ? "customer" : "product");
        setCategory(nextCategory);
        const first = data.find((item) => getCategory(item) === nextCategory);
        if (first) {
          setActiveId(first.id);
          return;
        }
        void create(nextCategory);
      });
  }, [create, initialQuery?.category, initialQuery?.conversation, initialQuery?.module]);

  useEffect(() => {
    setActiveId((current) => filteredItems.some((item) => item.id === current) ? current : filteredItems[0]?.id || null);
  }, [filteredItems]);

  async function selectModule(nextModule: LearningModule) {
    const nextCategory = nextModule === "customer" ? "customer" : category === "script" ? "script" : "product";
    await selectCategory(nextCategory);
  }

  async function selectCategory(nextCategory: LearningCategory) {
    setCategory(nextCategory);
    setEditingId(null);
    setMenuId(null);
    setScoreOpen(false);
    setSendError("");
    const first = items.find((item) => getCategory(item) === nextCategory);
    if (first) {
      setActiveId(first.id);
      return;
    }
    await create(nextCategory);
  }

  async function rename(item: LearningConversation) {
    if (!editingTitle.trim()) return;
    const response = await fetch(`/api/learning-conversations/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editingTitle })
    });
    const next = await response.json();
    if (response.ok) setItems((current) => current.map((record) => record.id === next.id ? next : record));
    setEditingId(null);
    setEditingTitle("");
  }

  async function remove(item: LearningConversation) {
    const response = await fetch(`/api/learning-conversations/${item.id}`, { method: "DELETE" });
    if (!response.ok) return;
    setItems((current) => current.filter((record) => record.id !== item.id));
    if (activeId === item.id) setActiveId(null);
    setMenuId(null);
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!active || !text.trim()) return;
    const content = text.trim();
    setText("");
    setSendError("");
    setPendingMessage({ conversationId: active.id, content });
    setLoading(true);
    try {
      const response = await fetch(`/api/learning-conversations/${active.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      });
      const next = await response.json().catch(() => null) as LearningConversation | { error?: string } | null;
      if (!response.ok || !next || !("id" in next)) throw new Error(next && "error" in next ? next.error || "发送失败" : "发送失败");
      setItems((current) => [next, ...current.filter((item) => item.id !== next.id)]);
      setActiveId(next.id);
    } catch (reason) {
      setText(content);
      setSendError(reason instanceof Error ? reason.message : "发送失败");
    } finally {
      setLoading(false);
      setPendingMessage(null);
    }
  }

  return (
    <div className="learning-workbench">
      <aside className="learning-history">
        <div className="learning-history-head">
          <button className="button" onClick={() => create(category)} disabled={!!creatingCategory}><MessageCirclePlus size={16} />新对话</button>
          <p>学习记录</p>
        </div>
        <div className="learning-history-tabs">
          {modules.map((item) => <button key={item.value} className={item.value === activeModule ? "active" : ""} onClick={() => selectModule(item.value)} type="button">{item.label}</button>)}
        </div>
        <div className="learning-records">
          {filteredItems.length ? filteredItems.map((item) => (
            <article key={item.id} className={`learning-record-card ${item.id === active?.id ? "active" : ""}`}>
              {editingId === item.id ? (
                <div className="learning-record-rename">
                  <input value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void rename(item); if (event.key === "Escape") setEditingId(null); }} autoFocus maxLength={40} />
                  <div><button type="button" onClick={() => rename(item)}>保存</button><button type="button" onClick={() => setEditingId(null)}>取消</button></div>
                </div>
              ) : (
                <>
                  <button className="learning-record-main" onClick={() => setActiveId(item.id)} type="button"><span className="learning-record-module"><i />{recordModuleLabel(getCategory(item))}</span><strong>{item.title}</strong></button>
                  <div className="learning-record-actions">
                    <button className="learning-record-menu-trigger" type="button" onClick={() => setMenuId((current) => current === item.id ? null : item.id)} aria-label={`${item.title}更多操作`}><MoreVertical size={16} /></button>
                    {menuId === item.id ? <div className="learning-record-menu"><button type="button" onClick={() => { setEditingId(item.id); setEditingTitle(item.title); setMenuId(null); }}><Pencil size={16} />重命名</button><button className="danger" type="button" onClick={() => remove(item)}><Trash2 size={16} />删除</button></div> : null}
                  </div>
                </>
              )}
            </article>
          )) : <div className="learning-history-empty">当前模块暂无学习记录。</div>}
        </div>
      </aside>
      <section className="learning-chat">
        <div className="learning-chat-head">
          <div>
            <p className="eyebrow">{activeModule === "customer" ? "Simulated Customer" : "Sales Training"}</p>
            <h2>{active?.title || activeDirection.label}</h2>
            <span>{activeDirection.description}</span>
          </div>
          {activeModule === "customer" ? <button className="button learning-score-trigger" type="button" onClick={() => setScoreOpen(true)}><Award size={16} />评分</button> : null}
        </div>
        {visibleMessages.length || isPendingOnActive ? (
          <div className="learning-messages">
            {visibleMessages.map((message) => <article className={message.role} key={message.id}><strong>{message.role === "learner" ? "我" : category === "customer" ? "模拟客户" : "学习助手"}</strong>{message.role === "coach" ? <MarkdownMessage content={message.content} /> : <p>{message.content}</p>}</article>)}
            {isPendingOnActive ? (
              <>
                <article className="learner learning-pending-learner"><strong>我</strong><p>{pendingMessage.content}</p></article>
                <article className="coach learning-loading-message"><strong>{category === "customer" ? "模拟客户" : "学习助手"}</strong><p><LoaderCircle className="spin" size={15} />正在生成回答</p></article>
              </>
            ) : null}
          </div>
        ) : (
          <div className="learning-empty">
            <strong>从{activeDirection.label}开始</strong>
            <p>{category === "customer" ? "输入你的销售开场、产品介绍或客户场景，模拟客户会以采购人员视角追问资质、交付、验证和风险。" : "知识库不会直接展示；请输入问题或训练目标后，助手会基于内部资料生成训练回答。"}</p>
          </div>
        )}
        {sendError ? <p className="learning-send-error">{sendError}</p> : null}
        <form className="learning-input" onSubmit={send}>
          <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder={category === "script" ? "输入你的客户场景或原始话术，我来帮你温柔打磨…" : category === "customer" ? "输入你的销售开场或产品介绍，模拟客户会开始刁钻追问…" : `输入${activeDirection.label}相关问题…`} disabled={!active || loading} />
          <button className="button" type="submit" disabled={!active || loading || !text.trim()}>{loading ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />}{loading ? "生成中" : "发送"}</button>
        </form>
        {activeModule === "customer" ? (
          <div className="learning-score-overlay" role="presentation" hidden={!scoreOpen} onMouseDown={(event) => event.target === event.currentTarget && setScoreOpen(false)}>
            <section className="learning-score-dialog" role="dialog" aria-modal="true" aria-labelledby="learning-score-title">
              <div className="learning-score-head">
                <div>
                  <p className="eyebrow">Conversation Review</p>
                  <h2 id="learning-score-title">对话评分</h2>
                </div>
                <button className="icon-button" type="button" onClick={() => setScoreOpen(false)} aria-label="关闭对话评分"><X size={17} /></button>
              </div>
              <div className="learning-score-summary">
                <strong>{scoreReview.score}<span>分</span></strong>
                <div>
                  <span>{scoreReview.level}</span>
                  <p>训练反馈会根据你的销售侧表达，检查是否回应采购人员关心的资质、交付、验证和风险。</p>
                </div>
              </div>
              <div className="learning-score-feedback">
                <h3>训练反馈</h3>
                {scoreReview.feedback.map((item) => <p key={item}><CheckCircle2 size={15} />{item}</p>)}
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </div>
  );
}
