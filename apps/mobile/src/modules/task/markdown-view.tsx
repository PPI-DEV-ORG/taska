import * as React from "react";
import { View, ScrollView } from "react-native";
import { Text } from "@/components/ui/text";
import { CheckSquare, Square } from "lucide-react-native";
import { colors } from "@/tokens";

/**
 * Render inline markdown elements (bold, italic, inline code)
 */
function renderInline(text: string): React.ReactNode {
  // Split by inline code, bold, italic
  const parts: React.ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <Text
          key={match.index}
          className="font-mono text-xs bg-muted/50 px-1 py-0.5 rounded text-primary border border-border/60"
        >
          {token.slice(1, -1)}
        </Text>
      );
    } else if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <Text key={match.index} className="font-bold text-foreground">
          {token.slice(2, -2)}
        </Text>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(
        <Text key={match.index} className="italic text-foreground">
          {token.slice(1, -1)}
        </Text>
      );
    }
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }

  return parts.length > 0 ? parts : text;
}

export function MarkdownView({ content }: { content: string }) {
  if (!content || !content.trim()) {
    return <Text className="text-sm text-muted-foreground italic">Tidak ada deskripsi.</Text>;
  }

  const rawLines = content.replace(/\r\n/g, "\n").split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];

    // 1. Code Block (``` ... ```)
    if (line.trim().startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < rawLines.length && !rawLines[i].trim().startsWith("```")) {
        codeLines.push(rawLines[i]);
        i++;
      }
      elements.push(
        <View
          key={`code-${i}`}
          className="my-2 p-3 bg-muted/80 border border-border/80 rounded-xl overflow-x-auto"
        >
          <Text className="font-mono text-xs text-foreground leading-relaxed">
            {codeLines.join("\n")}
          </Text>
        </View>
      );
      i++;
      continue;
    }

    // 2. Table (| col 1 | col 2 |)
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      const tableLines: string[] = [];
      while (i < rawLines.length && rawLines[i].trim().startsWith("|") && rawLines[i].trim().endsWith("|")) {
        tableLines.push(rawLines[i]);
        i++;
      }

      if (tableLines.length >= 2) {
        const headerCells = tableLines[0]
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim());
        const bodyLines = tableLines.slice(2); // Skip separator (|---|)

        elements.push(
          <ScrollView
            key={`table-${i}`}
            horizontal
            showsHorizontalScrollIndicator
            className="my-2 border border-border/80 rounded-xl overflow-hidden"
          >
            <View className="min-w-full">
              {/* Table Header */}
              <View className="flex-row bg-muted/70 border-b border-border">
                {headerCells.map((h, colIdx) => (
                  <View
                    key={colIdx}
                    className="px-3 py-2 border-r border-border/60 last:border-r-0 min-w-[100px]"
                  >
                    <Text className="text-xs font-bold text-foreground">{h}</Text>
                  </View>
                ))}
              </View>

              {/* Table Body */}
              {bodyLines.map((rowLine, rowIdx) => {
                const cells = rowLine
                  .split("|")
                  .slice(1, -1)
                  .map((c) => c.trim());
                return (
                  <View
                    key={rowIdx}
                    className={`flex-row border-b border-border/50 last:border-b-0 ${
                      rowIdx % 2 === 1 ? "bg-muted/20" : "bg-card"
                    }`}
                  >
                    {cells.map((cell, colIdx) => (
                      <View
                        key={colIdx}
                        className="px-3 py-2 border-r border-border/50 last:border-r-0 min-w-[100px]"
                      >
                        <Text className="text-xs text-foreground">{renderInline(cell)}</Text>
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        );
        continue;
      }
    }

    // 3. Headings
    if (line.startsWith("### ")) {
      elements.push(
        <Text key={`h3-${i}`} className="text-sm font-bold text-foreground mt-3 mb-1">
          {renderInline(line.slice(4))}
        </Text>
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <Text key={`h2-${i}`} className="text-base font-bold text-foreground mt-3.5 mb-1.5 pb-1 border-b border-border/60">
          {renderInline(line.slice(3))}
        </Text>
      );
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      elements.push(
        <Text key={`h1-${i}`} className="text-lg font-black text-foreground mt-4 mb-2 pb-1 border-b border-border">
          {renderInline(line.slice(2))}
        </Text>
      );
      i++;
      continue;
    }

    // 4. Horizontal Rule (--- or ***)
    if (line.trim() === "---" || line.trim() === "***") {
      elements.push(<View key={`hr-${i}`} className="my-2.5 h-[1px] bg-border/80 w-full" />);
      i++;
      continue;
    }

    // 5. Blockquote (> text)
    if (line.startsWith("> ")) {
      elements.push(
        <View
          key={`quote-${i}`}
          className="my-1.5 pl-3 py-1 border-l-2 border-primary/70 bg-primary/5 rounded-r-lg"
        >
          <Text className="text-xs text-muted-foreground italic leading-relaxed">
            {renderInline(line.slice(2))}
          </Text>
        </View>
      );
      i++;
      continue;
    }

    // 6. Checklist (- [ ] or - [x])
    const checklistMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (checklistMatch) {
      const isChecked = checklistMatch[1].toLowerCase() === "x";
      const itemText = checklistMatch[2];
      elements.push(
        <View key={`check-${i}`} className="flex-row items-center gap-2 my-1">
          {isChecked ? (
            <CheckSquare size={14} color={colors.success} />
          ) : (
            <Square size={14} color={colors.muted} />
          )}
          <Text
            className={`text-xs flex-1 ${
              isChecked ? "line-through text-muted-foreground" : "text-foreground"
            }`}
          >
            {renderInline(itemText)}
          </Text>
        </View>
      );
      i++;
      continue;
    }

    // 7. Bullet Lists (- text or * text)
    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      elements.push(
        <View key={`bullet-${i}`} className="flex-row items-start gap-2 my-0.5 ml-1">
          <Text className="text-primary text-xs leading-5">•</Text>
          <Text className="text-xs text-foreground flex-1 leading-5">
            {renderInline(bulletMatch[1])}
          </Text>
        </View>
      );
      i++;
      continue;
    }

    // 8. Numbered Lists (1. text)
    const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      elements.push(
        <View key={`num-${i}`} className="flex-row items-start gap-1.5 my-0.5 ml-1">
          <Text className="text-xs font-semibold text-muted-foreground min-w-[18px]">
            {numMatch[1]}.
          </Text>
          <Text className="text-xs text-foreground flex-1 leading-5">
            {renderInline(numMatch[2])}
          </Text>
        </View>
      );
      i++;
      continue;
    }

    // 9. Blank line or Regular Paragraph
    if (!line.trim()) {
      elements.push(<View key={`empty-${i}`} className="h-1.5" />);
    } else {
      elements.push(
        <Text key={`p-${i}`} className="text-xs text-foreground leading-relaxed my-0.5">
          {renderInline(line)}
        </Text>
      );
    }
    i++;
  }

  return <View className="gap-0.5">{elements}</View>;
}

