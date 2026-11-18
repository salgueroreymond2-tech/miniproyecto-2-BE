import { Fragment } from 'react';

function safeExternalLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch { return null; }
}

function renderInline(text, keyPrefix) {
  const expression = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const result = [];
  let previous = 0;
  for (const match of text.matchAll(expression)) {
    const start = match.index;
    if (start > previous) result.push(text.slice(previous, start));
    const token = match[0];
    const key = `${keyPrefix}-${start}`;
    if (token.startsWith('**')) result.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith('*')) result.push(<em key={key}>{token.slice(1, -1)}</em>);
    else if (token.startsWith('`')) result.push(<code key={key}>{token.slice(1, -1)}</code>);
    else {
      const parsed = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      const href = parsed && safeExternalLink(parsed[2]);
      result.push(href ? <a key={key} href={href} target="_blank" rel="noopener noreferrer">{parsed[1]}</a> : parsed?.[1] || token);
    }
    previous = start + token.length;
  }
  if (previous < text.length) result.push(text.slice(previous));
  return result.map((item, index) => typeof item === 'string' ? <Fragment key={`${keyPrefix}-text-${index}`}>{item}</Fragment> : item);
}

export function MarkdownContent({ content = '' }) {
  const blocks = String(content).split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  return <div className="markdown-content">
    {blocks.map((block, index) => {
      const lines = block.split('\n');
      if (lines.every((line) => /^\s*[-*]\s+/.test(line))) return <ul key={index}>{lines.map((line, itemIndex) => <li key={itemIndex}>{renderInline(line.replace(/^\s*[-*]\s+/, ''), `${index}-${itemIndex}`)}</li>)}</ul>;
      if (lines.every((line) => /^\s*\d+\.\s+/.test(line))) return <ol key={index}>{lines.map((line, itemIndex) => <li key={itemIndex}>{renderInline(line.replace(/^\s*\d+\.\s+/, ''), `${index}-${itemIndex}`)}</li>)}</ol>;
      const heading = /^(#{1,3})\s+(.+)$/.exec(block);
      if (heading) {
        const level = Math.min(3, heading[1].length);
        const Heading = `h${level + 2}`;
        return <Heading key={index}>{renderInline(heading[2], `${index}-heading`)}</Heading>;
      }
      return <p key={index}>{lines.map((line, lineIndex) => <Fragment key={lineIndex}>{lineIndex > 0 && <br />}{renderInline(line, `${index}-${lineIndex}`)}</Fragment>)}</p>;
    })}
  </div>;
}
