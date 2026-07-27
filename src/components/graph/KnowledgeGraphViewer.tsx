"use client";

import { LoaderCircle, Maximize2, Minus, Plus, RefreshCw } from "lucide-react";
import { PointerEvent, WheelEvent, useCallback, useEffect, useMemo, useState } from "react";

type GraphNode = { id: string; label: string; type: string; properties: Record<string, unknown> };
type GraphEdge = { id: string; source: string; target: string; type: string };
type GraphSnapshot = { nodes: GraphNode[]; edges: GraphEdge[]; meta: { node_count: number; edge_count: number } };
type GraphPoint = { x: number; y: number };

const colors: Record<string, string> = {
  Source: "#14b8a6",
  Account: "#0f766e",
  Contact: "#2563eb",
  Evidence: "#64748b",
  Product: "#b45309",
  Scenario: "#7c3aed",
  SignalType: "#0891b2",
  IntentLevel: "#dc2626",
  FollowUpAction: "#65a30d"
};

const clusterConfig: Record<string, { label: string; x: number; y: number; radius: number }> = {
  Source: { label: "数据来源", x: 150, y: 86, radius: 64 },
  Contact: { label: "小红书账号", x: 190, y: 286, radius: 150 },
  Evidence: { label: "公开证据", x: 490, y: 288, radius: 185 },
  Scenario: { label: "应用场景", x: 785, y: 150, radius: 118 },
  Product: { label: "产品方案", x: 825, y: 375, radius: 98 },
  SignalType: { label: "信号类型", x: 505, y: 76, radius: 78 },
  IntentLevel: { label: "意向等级", x: 665, y: 76, radius: 74 },
  FollowUpAction: { label: "跟进动作", x: 740, y: 505, radius: 126 },
  Account: { label: "客户账户", x: 120, y: 500, radius: 82 }
};

const fallbackCluster = { label: "其他实体", x: 480, y: 510, radius: 96 };
const minZoom = 0.55;
const maxZoom = 2.4;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function shorten(value: string, max = 12) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function describeType(type: string) {
  return clusterConfig[type]?.label || type;
}

function isGraphNodeTarget(target: EventTarget | null) {
  return target instanceof Element && !!target.closest(".graph-node");
}

export function KnowledgeGraphViewer() {
  const [graph, setGraph] = useState<GraphSnapshot | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(0.88);
  const [pan, setPan] = useState<GraphPoint>({ x: 12, y: -10 });
  const [dragStart, setDragStart] = useState<{ pointerId: number; x: number; y: number; pan: GraphPoint } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/graph", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "读取 Neo4j 图谱失败。");
      setGraph(payload);
      setSelectedId((current) => current || payload.nodes[0]?.id || null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "读取 Neo4j 图谱失败。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const positions = useMemo(() => {
    const result = new Map<string, { x: number; y: number }>();
    const groups = new Map<string, GraphNode[]>();
    graph?.nodes.forEach((node) => {
      const items = groups.get(node.type) || [];
      items.push(node);
      groups.set(node.type, items);
    });
    groups.forEach((nodes, type) => {
      const config = clusterConfig[type] || fallbackCluster;
      nodes.forEach((node, index) => {
        if (nodes.length === 1) {
          result.set(node.id, { x: config.x, y: config.y });
          return;
        }
        const ring = Math.floor(Math.sqrt(index));
        const ringStart = ring * ring;
        const ringSize = Math.max(1, (ring + 1) * (ring + 1) - ringStart);
        const progress = (index - ringStart) / ringSize;
        const angle = progress * Math.PI * 2 + ring * 0.82;
        const radius = Math.min(config.radius - 26, 22 + ring * 32);
        result.set(node.id, {
          x: config.x + Math.cos(angle) * radius,
          y: config.y + Math.sin(angle) * radius
        });
      });
    });
    return result;
  }, [graph]);

  const relatedIds = useMemo(() => {
    const ids = new Set<string>();
    if (!selectedId || !graph) return ids;
    ids.add(selectedId);
    graph.edges.forEach((edge) => {
      if (edge.source === selectedId) ids.add(edge.target);
      if (edge.target === selectedId) ids.add(edge.source);
    });
    return ids;
  }, [graph, selectedId]);

  const visibleClusters = useMemo(() => {
    const counts = new Map<string, number>();
    graph?.nodes.forEach((node) => counts.set(node.type, (counts.get(node.type) || 0) + 1));
    return Array.from(counts, ([type, count]) => ({ type, count, config: clusterConfig[type] || fallbackCluster }));
  }, [graph]);

  const selected = graph?.nodes.find((node) => node.id === selectedId);
  const selectedDegree = selectedId ? graph?.edges.filter((edge) => edge.source === selectedId || edge.target === selectedId).length || 0 : 0;

  const updateZoom = useCallback((next: number) => setZoom(clamp(next, minZoom, maxZoom)), []);
  const selectNode = useCallback((id: string) => {
    setSelectedId(id);
    setHoveredId(id);
  }, []);
  const resetView = useCallback(() => {
    setZoom(0.88);
    setPan({ x: 12, y: -10 });
  }, []);

  const handleWheel = useCallback((event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    updateZoom(zoom + delta);
  }, [updateZoom, zoom]);

  const handlePointerDown = useCallback((event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    if (isGraphNodeTarget(event.target)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragStart({ pointerId: event.pointerId, x: event.clientX, y: event.clientY, pan });
  }, [pan]);

  const handlePointerMove = useCallback((event: PointerEvent<SVGSVGElement>) => {
    if (!dragStart) return;
    setPan({
      x: dragStart.pan.x + (event.clientX - dragStart.x) / zoom,
      y: dragStart.pan.y + (event.clientY - dragStart.y) / zoom
    });
  }, [dragStart, zoom]);

  const handlePointerUp = useCallback((event: PointerEvent<SVGSVGElement>) => {
    if (dragStart?.pointerId === event.pointerId) setDragStart(null);
  }, [dragStart]);

  if (loading && !graph) return <div className="graph-state"><LoaderCircle size={18} className="spin" /> 正在读取 Neo4j 图谱…</div>;
  if (error && !graph) return <div className="graph-state graph-error">{error}</div>;

  return (
    <div className="graph-workspace">
      <div className="graph-toolbar">
        <div>
          <p>{graph?.meta.node_count || 0} 个实体 · {graph?.meta.edge_count || 0} 条关系 · 簇状视图</p>
          <div className="graph-legend" aria-label="图谱实体类型">
            {visibleClusters.map(({ type, count }) => <span key={type}><i style={{ background: colors[type] || "#64748b" }} />{describeType(type)} {count}</span>)}
          </div>
        </div>
        <div className="graph-actions">
          <button className="icon-button" type="button" onClick={() => updateZoom(zoom + 0.14)} aria-label="放大图谱" title="放大"><Plus size={15} /></button>
          <button className="icon-button" type="button" onClick={() => updateZoom(zoom - 0.14)} aria-label="缩小图谱" title="缩小"><Minus size={15} /></button>
          <button className="icon-button" type="button" onClick={resetView} aria-label="重置视图" title="重置视图"><Maximize2 size={15} /></button>
          <button className="icon-button" type="button" onClick={() => void load()} aria-label="刷新图谱" title="刷新图谱"><RefreshCw size={15} /></button>
        </div>
      </div>
      {error ? <p className="run-error">{error}</p> : null}
      <div className="graph-canvas-wrap">
        <svg
          className={`graph-canvas ${dragStart ? "is-panning" : ""}`}
          viewBox="0 0 980 600"
          role="img"
          aria-label="Neo4j 销售知识图谱"
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#94a3b8" /></marker></defs>
          <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
            {visibleClusters.map(({ type, count, config }) => (
              <g key={type} className="graph-cluster">
                <circle cx={config.x} cy={config.y} r={config.radius} style={{ ["--cluster-color" as string]: colors[type] || "#64748b" }} />
                <text x={config.x} y={config.y - config.radius + 22}>{config.label}</text>
                <text x={config.x} y={config.y - config.radius + 42}>{count} 个节点</text>
              </g>
            ))}
            {graph?.edges.map((edge) => {
              const source = positions.get(edge.source);
              const target = positions.get(edge.target);
              if (!source || !target) return null;
              const highlighted = relatedIds.has(edge.source) && relatedIds.has(edge.target);
              return (
                <g key={edge.id} className={highlighted ? "graph-edge-group active" : "graph-edge-group"}>
                  <line x1={source.x} y1={source.y} x2={target.x} y2={target.y} className="graph-edge" />
                  {highlighted ? <text x={(source.x + target.x) / 2} y={(source.y + target.y) / 2 - 6} className="graph-edge-label">{edge.type}</text> : null}
                </g>
              );
            })}
            {graph?.nodes.map((node) => {
              const position = positions.get(node.id);
              if (!position) return null;
              const active = node.id === selectedId;
              const hovered = node.id === hoveredId;
              const related = relatedIds.has(node.id);
              const r = active ? 16 : node.type === "Evidence" || node.type === "Contact" ? 10 : 13;
              const showLabel = active || hovered || related || ["Source", "Product", "Scenario", "IntentLevel", "SignalType"].includes(node.type);
              return (
                <g
                  key={node.id}
                  className={`graph-node ${active ? "active" : ""} ${related ? "related" : ""}`}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.stopPropagation();
                    selectNode(node.id);
                  }}
                  onClick={(event) => { event.stopPropagation(); selectNode(node.id); }}
                  onPointerEnter={() => setHoveredId(node.id)}
                  onPointerLeave={() => setHoveredId(null)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectNode(node.id);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                >
                  <circle className="graph-node-hit-area" cx={position.x} cy={position.y} r={Math.max(24, r + 10)} />
                  <circle cx={position.x} cy={position.y} r={r} fill={colors[node.type] || "#475467"} />
                  {showLabel ? <text x={position.x + r + 5} y={position.y + 4} className="graph-node-label">{shorten(node.label, active ? 24 : 14)}</text> : null}
                </g>
              );
            })}
          </g>
        </svg>
        <aside className="graph-detail">
          <p className="eyebrow">Entity Detail</p>
          {selected ? <><h2>{selected.label}</h2><div className="graph-detail-badges"><span className="badge">{describeType(selected.type)}</span><span>{selectedDegree} 条相邻关系</span></div><dl>{Object.entries(selected.properties).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl></> : <p className="subtle">点击节点查看属性。</p>}
        </aside>
      </div>
    </div>
  );
}
