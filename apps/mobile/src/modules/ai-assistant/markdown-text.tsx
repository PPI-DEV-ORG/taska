import * as React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

type InlineSegment =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "code"; value: string };

/** Parse inline markdown (**bold**, *italic*, `code`) secara aman di Web & Native. */
function parseInline(input: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(input)) !== null) {
    if (match.index > lastIdx) {
      segments.push({ type: "text", value: input.slice(lastIdx, match.index) });
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      segments.push({ type: "bold", value: token.slice(2, -2) });
    } else if (token.startsWith("`") && token.endsWith("`")) {
      segments.push({ type: "code", value: token.slice(1, -1) });
    } else if (token.startsWith("*") && token.endsWith("*")) {
      segments.push({ type: "italic", value: token.slice(1, -1) });
    }
    lastIdx = match.index + token.length;
  }

  if (lastIdx < input.length) {
    segments.push({ type: "text", value: input.slice(lastIdx) });
  }
  return segments;
}

function renderInlineNodes(text: string, textClassName: string) {
  const parts = parseInline(text);
  return parts.map((seg, idx) => {
    if (seg.type === "bold") {
      return (
        <Text key={idx} className={cn(textClassName, "font-bold")}>
          {seg.value}
        </Text>
      );
    }
    if (seg.type === "italic") {
      return (
        <Text key={idx} className={cn(textClassName, "italic")}>
          {seg.value}
        </Text>
      );
    }
    if (seg.type === "code") {
      return (
        <Text
          key={idx}
          className={cn(textClassName, "font-mono text-xs bg-card/80 px-1 rounded")}
        >
          {seg.value}
        </Text>
      );
    }
    return <React.Fragment key={idx}>{seg.value}</React.Fragment>;
  });
}

export function MarkdownText({
  content,
  inverse = false,
}: {
  content: string;
  inverse?: boolean;
}) {
  const baseText = inverse
    ? "text-sm leading-relaxed text-primary-foreground"
    : "text-sm leading-relaxed text-foreground";
  const mutedText = inverse
    ? "text-sm leading-relaxed text-primary-foreground/85"
    : "text-sm leading-relaxed text-muted-foreground";

  const lines = content.replace(/\r\n/g, "\n").split("\n");

  return (
    <View className="gap-1.5">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trimEnd();
        const trimmed = line.trim();

        if (!trimmed) {
          return <View key={idx} className="h-1" />;
        }

        // Horizontal rule
        if (/^[-*_]{3,}$/.test(trimmed)) {
          return <View key={idx} className="border-border/60 border-b my-1" />;
        }

        // Headings (#, ##, ###)
        const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
        if (headingMatch) {
          const level = headingMatch[1]?.length ?? 3;
          const body = headingMatch[2] ?? "";
          const sizeClass =
            level === 1 ? "text-base font-bold mt-1" : level === 2 ? "text-[15px] font-bold mt-1" : "text-sm font-bold mt-1";
          return (
            <Text key={idx} className={cn(baseText, sizeClass)}>
              {renderInlineNodes(body, cn(baseText, sizeClass))}
            </Text>
          );
        }

        // Bullet list (*, -, •)
        const bulletMatch = line.match(/^(\s*)[*\-•]\s+(.+)$/);
        if (bulletMatch) {
          const indent = Math.min(2, Math.floor((bulletMatch[1]?.length ?? 0) / 2));
          const body = bulletMatch[2] ?? "";
          return (
            <View
              key={idx}
              className="flex-row items-start gap-2"
              style={{ paddingLeft: indent * 12 }}
            >
              <Text className={cn(mutedText, "font-bold")}>•</Text>
              <Text className={cn(baseText, "flex-1 min-w-0")}>
                {renderInlineNodes(body, baseText)}
              </Text>
            </View>
          );
        }

        // Numbered list (1. , 2. )
        const numMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
        if (numMatch) {
          const indent = Math.min(2, Math.floor((numMatch[1]?.length ?? 0) / 2));
          const num = numMatch[2] ?? "1";
          const body = numMatch[3] ?? "";
          return (
            <View
              key={idx}
              className="flex-row items-start gap-1.5"
              style={{ paddingLeft: indent * 12 }}
            >
              <Text className={cn(mutedText, "font-semibold")}>{num}.</Text>
              <Text className={cn(baseText, "flex-1 min-w-0")}>
                {renderInlineNodes(body, baseText)}
              </Text>
            </View>
          );
        }

        return (
          <Text key={idx} className={baseText}>
            {renderInlineNodes(trimmed, baseText)}
          </Text>
        );
      })}
    </View>
  );
}
