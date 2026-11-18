"use client";

import { useEffect, useRef, useState } from "react";
import { Lead } from "@/server/data/types";
import { LeadForm } from "./LeadForm";

export function LeadEditor({ lead }: { lead: Lead }) {
  const [editing, setEditing] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (editing) dialog.current?.showModal();
  }, [editing]);
  return <>
    <button className="button secondary" onClick={() => setEditing(true)}>编辑线索</button>
    {editing ? <dialog ref={dialog} className="sales-modal" onCancel={() => setEditing(false)} onClose={() => setEditing(false)} aria-label="编辑线索"><LeadForm key={lead.updatedAt} lead={lead} onCancel={() => setEditing(false)} /></dialog> : null}
  </>;
}
