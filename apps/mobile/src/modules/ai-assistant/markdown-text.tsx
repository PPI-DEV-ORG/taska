import * as React from "react";
import { Platform, Pressable, ScrollView, Share, View } from "react-native";
import { useRouter } from "expo-router";
import { Check, Code2, Copy, Share2 } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";

type InlineSegment =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "code"; value: string }
  | { type: "link"; label: string; href: string };

/** Parse inline markdown (**bold**, *italic*, `code`, [label](/route)) secara aman di Web & Native. */
function parseInline(input: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const regex = /(\[[^\]]+\]\(\/[^)\s]+\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(input)) !== null) {
    if (match.index > lastIdx) {
      segments.push({ type: "text", value: input.slice(lastIdx, match.index) });
    }
    const token = match[0];
    if (token.startsWith("[") && token.includes("](/")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\((\/[^)\s]+)\)$/);
      if (linkMatch) {
        segments.push({
          type: "link",
          label: linkMatch[1] ?? token,
          href: linkMatch[2] ?? "/dashboard",
        });
      } else {
        segments.push({ type: "text", value: token });
      }
    } else if (token.startsWith("**") && token.endsWith("**")) {
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

function isTableRow(line: string): boolean {
  const t = line.trim();
  return t.startsWith("|") && t.endsWith("|") && t.split("|").length >= 3;
}

function isTableSeparator(line: string): boolean {
  const t = line.trim();
  if (!isTableRow(t)) return false;
  const cells = t
    .slice(1, -1)
    .split("|")
    .map((c) => c.trim());
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

function splitTableCells(line: string): string[] {
  return line
    .trim()
    .slice(1, -1)
    .split("|")
    .map((c) => c.trim());
}

type Block =
  | { type: "line"; raw: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "code"; lang: string; content: string };

function groupBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const cur = lines[i] ?? "";
    const trimmed = cur.trim();

    // Fenced code / plain text block (```text ... ```)
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim() || "Plain text";
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? "").trim().startsWith("```")) {
        codeLines.push(lines[i] ?? "");
        i += 1;
      }
      if (i < lines.length && (lines[i] ?? "").trim().startsWith("```")) {
        i += 1;
      }
      blocks.push({ type: "code", lang, content: codeLines.join("\n") });
      continue;
    }

    const next = lines[i + 1] ?? "";
    if (isTableRow(cur) && isTableSeparator(next)) {
      const headers = splitTableCells(cur);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && isTableRow(lines[i] ?? "")) {
        rows.push(splitTableCells(lines[i] ?? ""));
        i += 1;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }
    blocks.push({ type: "line", raw: cur });
    i += 1;
  }
  return blocks;
}

function CodeBlockBox({ lang, content }: { lang: string; content: string }) {
  const [copied, setCopied] = React.useState(false);

  const label =
    lang.toLowerCase() === "text" || lang.toLowerCase() === "txt" || lang.toLowerCase() === "plaintext"
      ? "Plain text"
      : lang;

  const handleCopy = async () => {
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(content);
      } else {
        await Share.share({ message: content });
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Abaikan jika user membatalkan dialog share
    }
  };

  return (
    <View className="bg-card border-border/80 rounded-xl border overflow-hidden my-1.5 w-full">
      <View className="bg-panel/90 border-border/70 flex-row items-center justify-between gap-2 border-b px-3 py-2">
        <View className="flex-row items-center gap-1.5">
          <Code2 size={13} color={colors.muted} />
          <Text className="text-muted-foreground text-xs font-semibold">{label}</Text>
        </View>
        <Pressable
          onPress={() => void handleCopy()}
          hitSlop={8}
          className="flex-row items-center gap-1 rounded-md px-2 py-1 hover:bg-card active:opacity-70"
        >
          {copied ? (
            <Check size={13} color={colors.primary} />
          ) : Platform.OS === "web" ? (
            <Copy size={13} color={colors.muted} />
          ) : (
            <Share2 size={13} color={colors.muted} />
          )}
          <Text
            className={cn(
              "text-[11px] font-medium",
              copied ? "text-primary" : "text-muted-foreground",
            )}
          >
            {copied ? "Tersalin" : Platform.OS === "web" ? "Salin" : "Bagikan"}
          </Text>
        </Pressable>
      </View>
      <ScrollView
        className="max-h-[280px]"
        contentContainerClassName="p-3"
        nestedScrollEnabled
        showsVerticalScrollIndicator={true}
      >
        <Text selectable className="font-mono text-xs leading-5 text-foreground">
          {content}
        </Text>
      </ScrollView>
    </View>
  );
}

function stripMarkdownSyntax(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*|`|(?<!\*)\*(?!\*)/g, "")
    .trim();
}

function isNumericCell(s: string): boolean {
  const plain = stripMarkdownSyntax(s);
  return /^[+\-(]?(Rp\s*)?[\d.,]+(\s*%)?\)?$/i.test(plain);
}

function computeColumnWidths(headers: string[], rows: string[][]): number[] {
  return headers.map((h, cIdx) => {
    let maxLen = stripMarkdownSyntax(h).length;
    for (const r of rows) {
      const len = stripMarkdownSyntax(r[cIdx] ?? "").length;
      if (len > maxLen) maxLen = len;
    }
    return Math.min(260, Math.max(115, Math.round(maxLen * 7.5) + 28));
  });
}

export function MarkdownText({
  content,
  inverse = false,
}: {
  content: string;
  inverse?: boolean;
}) {
  const router = useRouter();
  const baseText = inverse
    ? "text-sm leading-relaxed text-primary-foreground"
    : "text-sm leading-relaxed text-foreground";
  const mutedText = inverse
    ? "text-sm leading-relaxed text-primary-foreground/85"
    : "text-sm leading-relaxed text-muted-foreground";

  const renderInlineNodes = (text: string, textClassName: string) => {
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
      if (seg.type === "link") {
        return (
          <Text
            key={idx}
            onPress={() => router.push(seg.href as never)}
            className={cn(textClassName, "text-primary font-semibold underline")}
          >
            {seg.label}
          </Text>
        );
      }
      return <React.Fragment key={idx}>{seg.value}</React.Fragment>;
    });
  };

  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks = groupBlocks(lines);

  return (
    <View className="gap-1.5">
      {blocks.map((block, idx) => {
        if (block.type === "code") {
          return <CodeBlockBox key={idx} lang={block.lang} content={block.content} />;
        }

        if (block.type === "table") {
          const colWidths = computeColumnWidths(block.headers, block.rows);
          const colAlignRight = block.headers.map((_, cIdx) => {
            const nonEmpty = block.rows
              .map((r) => (r[cIdx] ?? "").trim())
              .filter((v) => v && v !== "-");
            return nonEmpty.length > 0 && nonEmpty.every(isNumericCell);
          });
          return (
            <ScrollView
              key={idx}
              horizontal
              showsHorizontalScrollIndicator={false}
              className="my-1.5"
            >
              <View className="bg-card border-border/80 rounded-xl border overflow-hidden">
                <View className="bg-panel/80 border-border/70 flex-row border-b">
                  {block.headers.map((h, hIdx) => (
                    <View
                      key={hIdx}
                      style={{ width: colWidths[hIdx] }}
                      className="px-3 py-2 border-r border-border/50 last:border-r-0 shrink-0"
                    >
                      <Text
                        className={cn(
                          "text-xs font-bold text-foreground",
                          colAlignRight[hIdx] && "text-right",
                        )}
                      >
                        {renderInlineNodes(h, "text-xs font-bold text-foreground")}
                      </Text>
                    </View>
                  ))}
                </View>
                {block.rows.map((row, rIdx) => (
                  <View
                    key={rIdx}
                    className={cn(
                      "flex-row border-b border-border/40 last:border-b-0",
                      rIdx % 2 === 1 && "bg-panel/30",
                    )}
                  >
                    {block.headers.map((_, cIdx) => {
                      const cell = row[cIdx] ?? "-";
                      return (
                        <View
                          key={cIdx}
                          style={{ width: colWidths[cIdx] }}
                          className="px-3 py-1.5 border-r border-border/40 last:border-r-0 shrink-0"
                        >
                          <Text
                            className={cn(
                              "text-xs text-foreground leading-snug",
                              colAlignRight[cIdx] && "text-right",
                            )}
                          >
                            {renderInlineNodes(cell, "text-xs text-foreground leading-snug")}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
          );
        }

        const rawLine = block.raw;
        const line = rawLine.trimEnd();
        const trimmed = line.trim();

        if (!trimmed) {
          return <View key={idx} className="h-1" />;
        }

        if (/^[-*_]{3,}$/.test(trimmed)) {
          return <View key={idx} className="border-border/60 border-b my-1" />;
        }

        const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
        if (headingMatch) {
          const level = headingMatch[1]?.length ?? 3;
          const body = headingMatch[2] ?? "";
          const sizeClass =
            level === 1
              ? "text-base font-bold mt-1"
              : level === 2
                ? "text-[15px] font-bold mt-1"
                : "text-sm font-bold mt-1";
          return (
            <Text key={idx} className={cn(baseText, sizeClass)}>
              {renderInlineNodes(body, cn(baseText, sizeClass))}
            </Text>
          );
        }

        // Standalone link pill jika satu baris hanya berisi [Label](/route)
        const standaloneLink = trimmed.match(/^\[([^\]]+)\]\((\/[^)\s]+)\)$/);
        if (standaloneLink) {
          const label = standaloneLink[1] ?? "Buka";
          const href = standaloneLink[2] ?? "/dashboard";
          return (
            <Pressable
              key={idx}
              onPress={() => router.push(href as never)}
              className="self-start bg-primary/10 border-primary/30 rounded-lg border px-2.5 py-1 my-0.5 active:opacity-80"
            >
              <Text className="text-primary text-xs font-semibold">{label} →</Text>
            </Pressable>
          );
        }

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
