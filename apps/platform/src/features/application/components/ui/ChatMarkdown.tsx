import { Fragment } from "react";

function inline(text: string, keyBase: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g);
  return parts.map((part, i) => {
    const key = `${keyBase}-${i}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
      return <strong key={key} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2)
      return (
        <code key={key} className="rounded bg-white/10 px-1 py-px font-label text-[12px]">
          {part.slice(1, -1)}
        </code>
      );
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2)
      return <em key={key}>{part.slice(1, -1)}</em>;
    return <Fragment key={key}>{part}</Fragment>;
  });
}

export function ChatMarkdown({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className="flex flex-col gap-2.5">
      {blocks.map((block, b) => {
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        if (lines.length === 0) return null;
        const bullet = lines.every((l) => /^\s*[-*•]\s+/.test(l));
        const numbered = lines.every((l) => /^\s*\d+[.)]\s+/.test(l));
        if (bullet || numbered) {
          const Tag = numbered ? "ol" : "ul";
          return (
            <Tag
              key={b}
              className={`flex flex-col gap-1 pl-4 ${numbered ? "list-decimal" : "list-disc"} marker:text-white/30`}
            >
              {lines.map((l, i) => (
                <li key={i}>{inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ""), `${b}-${i}`)}</li>
              ))}
            </Tag>
          );
        }
        const heading = lines[0].match(/^#{1,4}\s+(.*)$/);
        if (heading && lines.length === 1) {
          return (
            <p key={b} className="font-semibold text-white">
              {inline(heading[1], `${b}`)}
            </p>
          );
        }
        return (
          <p key={b}>
            {lines.map((l, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                {inline(l.replace(/^#{1,4}\s+/, ""), `${b}-${i}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
