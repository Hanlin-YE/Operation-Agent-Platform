"use client";

type InlineSegment = {
  text: string;
  strong: boolean;
};

function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) segments.push({ text: text.slice(lastIndex, match.index), strong: false });
    segments.push({ text: match[1], strong: true });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), strong: false });
  return segments;
}

function InlineMarkdown({ text }: { text: string }) {
  return <>{parseInline(text).map((segment, index) => segment.strong ? <strong key={index}>{segment.text}</strong> : <span key={index}>{segment.text}</span>)}</>;
}

function renderBlock(block: string, index: number) {
  const lines = block.split("\n").map((line) => line.trimEnd()).filter(Boolean);
  const firstLine = lines[0]?.trim() || "";

  if (/^#{1,3}\s+/.test(firstLine)) {
    const level = firstLine.match(/^#{1,3}/)?.[0].length || 2;
    const text = firstLine.replace(/^#{1,3}\s+/, "");
    return level === 1 ? <h3 key={index}><InlineMarkdown text={text} /></h3> : <h4 key={index}><InlineMarkdown text={text} /></h4>;
  }

  const listLines = lines.filter((line) => /^([-*]\s+|\d+[.)]\s+)/.test(line.trim()));
  if (listLines.length === lines.length && listLines.length > 0) {
    const ordered = listLines.every((line) => /^\d+[.)]\s+/.test(line.trim()));
    const items = listLines.map((line) => line.trim().replace(/^([-*]\s+|\d+[.)]\s+)/, ""));
    return ordered
      ? <ol key={index}>{items.map((item, itemIndex) => <li key={itemIndex}><InlineMarkdown text={item} /></li>)}</ol>
      : <ul key={index}>{items.map((item, itemIndex) => <li key={itemIndex}><InlineMarkdown text={item} /></li>)}</ul>;
  }

  return <p key={index}>{lines.map((line, lineIndex) => <span key={lineIndex}><InlineMarkdown text={line.trim()} />{lineIndex < lines.length - 1 ? <br /> : null}</span>)}</p>;
}

export function MarkdownMessage({ content }: { content: string }) {
  const blocks = content.trim().split(/\n{2,}/).filter(Boolean);
  return <div className="learning-markdown">{blocks.map(renderBlock)}</div>;
}
