"use client";

import { LoaderCircle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type GraphNode = { id: string; label: string; type: string; properties: Record<string, unknown> };
type GraphEdge = { id: string; source: string; target: string; type: string };
type GraphSnapshot = { nodes: GraphNode[]; edges: GraphEdge[]; meta: { node_count: number; edge_count: number } };

const colors: Record<string, string> = {
  Account: "#0f766e",
  Contact: "#2563eb",
  Product: "#b45309",
  Scenario: "#7c3aed"
};

export function KnowledgeGraphViewer() {
  const [graph, setGraph] = useState<GraphSnapshot | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    graph?.nodes.forEach((node, index) => {
      const angle = (Math.PI * 2 * index) / graph.nodes.length - Math.PI / 2;
      result.set(node.id, { x: 360 + Math.cos(angle) * 220, y: 220 + Math.sin(angle) * 145 });
    });
    return result;
  }, [graph]);
  const selected = graph?.nodes.find((node) => node.id === selectedId);

  if (loading && !graph) return <div className="graph-state"><LoaderCircle size={18} className="spin" /> 正在读取 Neo4j 图谱…</div>;
  if (error && !graph) return <div className="graph-state graph-error">{error}</div>;

  return (
    <div className="graph-workspace">
      <div className="graph-toolbar">
        <p>{graph?.meta.node_count || 0} 个实体 · {graph?.meta.edge_count || 0} 条关系 · 数据来自 Neo4j</p>
        <button className="button ghost" type="button" onClick={() => void load()}><RefreshCw size={16} />刷新图谱</button>
      </div>
      {error ? <p className="run-error">{error}</p> : null}
      <div className="graph-canvas-wrap">
        <svg className="graph-canvas" viewBox="0 0 720 440" role="img" aria-label="Neo4j 销售知识图谱">
          <defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#94a3b8" /></marker></defs>
          {graph?.edges.map((edge) => {
            const source = positions.get(edge.source);
            const target = positions.get(edge.target);
            if (!source || !target) return null;
            return <g key={edge.id}><line x1={source.x} y1={source.y} x2={target.x} y2={target.y} className="graph-edge" markerEnd="url(#arrow)" /><text x={(source.x + target.x) / 2} y={(source.y + target.y) / 2 - 8} className="graph-edge-label">{edge.type}</text></g>;
          })}
          {graph?.nodes.map((node) => {
            const position = positions.get(node.id);
            if (!position) return null;
            const active = node.id === selectedId;
            return <g key={node.id} className="graph-node" onClick={() => setSelectedId(node.id)} tabIndex={0} role="button"><circle cx={position.x} cy={position.y} r={active ? 39 : 33} fill={colors[node.type] || "#475467"} className={active ? "graph-node-active" : ""} /><text x={position.x} y={position.y + 4} className="graph-node-label">{node.label}</text><text x={position.x} y={position.y + 57} className="graph-node-type">{node.type}</text></g>;
          })}
        </svg>
        <aside className="graph-detail">
          <p className="eyebrow">Entity Detail</p>
          {selected ? <><h2>{selected.label}</h2><span className="badge">{selected.type}</span><dl>{Object.entries(selected.properties).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl></> : <p className="subtle">点击节点查看属性。</p>}
        </aside>
      </div>
    </div>
  );
}
