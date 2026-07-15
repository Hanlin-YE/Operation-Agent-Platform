"use client";

import { ChangeEvent, useState } from "react";
import { FileUp } from "lucide-react";

type CsvRow = Record<string, string>;

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else current += char;
  }
  cells.push(current.trim());
  return cells;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, parseCsvLine(line)[index] || ""])));
}

export function CsvLeadImport() {
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const parsed = parseCsv(await file.text()).slice(0, 500);
    setRows(parsed);
    setMessage(parsed.length ? `已解析 ${parsed.length} 条线索，确认后将自动分层。` : "CSV 中没有可导入的数据行。支持字段：公司名称、行业、地区、公司规模、联系人、职位、联系方式、来源、标签、备注。");
  }

  async function importRows() {
    setLoading(true);
    const response = await fetch("/api/leads/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows })
    });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(result.message || "导入失败");
    setMessage(`已导入 ${result.created} 条：KA ${result.tiers.KA} / LA ${result.tiers.LA} / SMB ${result.tiers.SMB}`);
    window.location.reload();
  }

  return (
    <section className="panel" style={{ marginBottom: 16 }}>
      <div className="page-head" style={{ marginBottom: 12 }}>
        <div><h2>CSV 批量导入</h2><p className="subtle">表头支持中英文；导入前预览条数，导入后自动应用账户分层策略。</p></div>
        <label className="button secondary"><FileUp size={16} />选择 CSV<input type="file" accept=".csv,text/csv" onChange={selectFile} hidden /></label>
      </div>
      {message && <p className="subtle">{message}</p>}
      {rows.length > 0 && <button className="button" onClick={importRows} disabled={loading}>{loading ? "导入中…" : `确认导入 ${rows.length} 条`}</button>}
    </section>
  );
}
