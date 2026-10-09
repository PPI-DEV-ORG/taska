import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, MoreVertical, Search, Trash2, Edit } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Cell, Chip } from "@/components/taska/basics";
import { StatusBadge } from "@/components/taska/status-badge";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { colors } from "@/tokens";
import { cn } from "@/lib/utils";
import type { Col } from "@/mock/modules";
import type { Row } from "@/mock/data";

const DEFAULT_PAGE_SIZE = 8;

export function FilterBar({
  search, onSearch, statuses, status, onStatus, right, placeholder = "Cari",
}: {
  search: string; onSearch: (v: string) => void; statuses?: string[]; status?: string; onStatus?: (v: string) => void;
  right?: React.ReactNode; placeholder?: string;
}) {
  return (
    <View className="mb-4 gap-3">
      <View className="flex-row items-center gap-3">
        <View className="bg-card border-border/80 h-10 max-w-md flex-1 flex-row items-center gap-2.5 rounded-xl border px-3 shadow-sm">
          <Search size={15} color={colors.muted} />
          <Input
            value={search}
            onChangeText={onSearch}
            placeholder={placeholder}
            className="h-8 flex-1 border-0 bg-transparent px-0 shadow-none text-xs sm:h-8"
          />
        </View>
        <Text className="text-muted-foreground hidden text-xs md:flex">Urutan: terbaru</Text>
        {right}
      </View>
      {statuses && statuses.length > 1 && onStatus ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          <Chip label="Semua" active={!status} onPress={() => onStatus("")} />
          {statuses.map((s) => (
            <Chip key={s} label={s} active={status === s} onPress={() => onStatus(s === status ? "" : s)} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

export function DataTable({
  columns,
  rows,
  onRowPress,
  selectedId,
  selectable = false,
  onSelectionChange,
  pageSize = DEFAULT_PAGE_SIZE,
  renderActions,
  actionsWidth,
}: {
  columns: Col[];
  rows: Row[];
  onRowPress?: (r: Row) => void;
  selectedId?: string;
  selectable?: boolean;
  onSelectionChange?: (selectedIds: string[]) => void;
  pageSize?: number;
  renderActions?: (r: Row) => React.ReactNode;
  actionsWidth?: number;
}) {
  const { isMobile } = useBreakpoint();
  const effectiveActionsWidth = actionsWidth ?? (renderActions ? 136 : 64);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("asc");

  const [prevRowCount, setPrevRowCount] = React.useState(rows ? rows.length : 0);
  const rowCount = rows ? rows.length : 0;

  if (rowCount !== prevRowCount) {
    setPrevRowCount(rowCount);
    setCurrentPage(1);
  }

  // Sort logic
  const sortedRows = React.useMemo(() => {
    if (!rows || !rows.length) return [];
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA === valB) return 0;
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;
      const res = String(valA).localeCompare(String(valB), undefined, { numeric: true });
      return sortOrder === "asc" ? res : -res;
    });
  }, [rows, sortKey, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const validPage = Math.min(currentPage, totalPages);
  const startIndex = (validPage - 1) * pageSize;
  const currentRows = sortedRows.slice(startIndex, startIndex + pageSize);

  function handleSelectAll() {
    if (selectedIds.length === currentRows.length && currentRows.length > 0) {
      setSelectedIds([]);
      onSelectionChange?.([]);
    } else {
      const ids = currentRows.map((r) => r.id);
      setSelectedIds(ids);
      onSelectionChange?.(ids);
    }
  }

  function handleToggleRow(id: string) {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    setSelectedIds(next);
    onSelectionChange?.(next);
  }

  function handleSort(key: string) {
    if (sortKey === key) {
      if (sortOrder === "asc") setSortOrder("desc");
      else {
        setSortKey(null);
        setSortOrder("asc");
      }
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  }

  const allSelected = currentRows.length > 0 && currentRows.every((r) => selectedIds.includes(r.id));

  return (
    <View className="bg-card border-border/80 w-full overflow-hidden rounded-2xl border shadow-sm">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={isMobile}
        contentContainerStyle={{ minWidth: "100%", width: isMobile ? "auto" : "100%" }}
      >
        <View className="w-full flex-1" style={{ minWidth: isMobile ? 760 : undefined }}>
          {/* Header Row */}
          <View className="border-border/70 bg-card/60 flex-row items-center border-b px-4 py-3.5 w-full">
            {selectable && (
              <View className="w-9 items-center justify-center pr-2">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                />
              </View>
            )}

            {columns.map((c) => {
              const colStyle = isMobile
                ? { width: (c.width ? c.width : Math.max(140, (c.flex ?? 1) * 140)) as any }
                : { flex: c.flex ?? 1, minWidth: (c.width ? c.width : 100) as any };
              return (
                <Pressable
                  key={c.key}
                  onPress={() => handleSort(c.key)}
                  style={colStyle}
                  className="flex-row items-center gap-1.5 pr-4"
                >
                  <Text className="text-muted-foreground text-xs font-semibold tracking-wider" numberOfLines={1}>
                    {c.label}
                  </Text>
                  {sortKey === c.key ? (
                    sortOrder === "asc" ? (
                      <ArrowUp size={12} color={colors.primary} />
                    ) : (
                      <ArrowDown size={12} color={colors.primary} />
                    )
                  ) : (
                    <ArrowUpDown size={11} color={colors.muted} />
                  )}
                </Pressable>
              );
            })}

            <View style={{ width: effectiveActionsWidth }} className="items-center justify-center pr-2">
              <Text className="text-muted-foreground text-xs font-semibold">Aksi</Text>
            </View>
          </View>

          {/* Table Rows */}
          {currentRows.map((r) => {
            const isRowSelected = selectedIds.includes(r.id) || selectedId === r.id;
            return (
              <Pressable
                key={r.id}
                onPress={() => onRowPress?.(r)}
                className={cn(
                  "border-border/40 hover:bg-panel/40 active:bg-panel/60 flex-row items-center border-b px-4 py-3.5 transition-colors w-full",
                  isRowSelected ? "bg-primary/5" : "bg-card"
                )}
              >
                {selectable && (
                  <View
                    className="w-9 items-center justify-center pr-2"
                    onStartShouldSetResponder={() => true}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      handleToggleRow(r.id);
                    }}
                  >
                    <Checkbox
                      checked={selectedIds.includes(r.id)}
                      onCheckedChange={() => handleToggleRow(r.id)}
                    />
                  </View>
                )}

                {columns.map((c) => {
                  const cellStyle = isMobile
                    ? { width: (c.width ? c.width : Math.max(140, (c.flex ?? 1) * 140)) as any }
                    : { flex: c.flex ?? 1, minWidth: (c.width ? c.width : 100) as any };
                  return (
                    <View
                      key={c.key}
                      style={cellStyle}
                      className="pr-4 justify-center"
                    >
                      {c.primary ? (
                        <Text className="text-sm font-semibold text-foreground" numberOfLines={1} ellipsizeMode="tail">
                          {String(r[c.key] ?? "-")}
                        </Text>
                      ) : (
                        <Cell fmt={c.fmt} value={r[c.key]} />
                      )}
                    </View>
                  );
                })}

                {/* Actions column */}
                <View
                  style={{ width: effectiveActionsWidth }}
                  className="flex-row items-center justify-center gap-1.5 pr-2"
                  onStartShouldSetResponder={() => true}
                  onTouchEnd={(e) => e.stopPropagation()}
                >
                  {renderActions ? (
                    renderActions(r)
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-lg hover:bg-panel"
                      onPress={() => onRowPress?.(r)}
                    >
                      <ChevronRight size={16} color={colors.muted} />
                    </Button>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Pagination Footer */}
      <View className="border-border/60 bg-card/60 flex-row items-center justify-between border-t px-4 py-3">
        <Button
          variant="outline"
          size="sm"
          disabled={validPage <= 1}
          onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
          className={cn("h-9 rounded-xl px-3 border-border/80 flex-row items-center gap-1.5", validPage <= 1 && "opacity-40")}
        >
          <ChevronLeft size={15} color={colors.text} />
          <Text className="text-xs font-semibold">Previous</Text>
        </Button>

        {/* Page numbers indicator */}
        <View className="flex-row items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const p = i + 1;
            const isActive = p === validPage;
            return (
              <Pressable
                key={p}
                onPress={() => setCurrentPage(p)}
                className={cn(
                  "size-8 items-center justify-center rounded-lg border",
                  isActive
                    ? "bg-primary border-primary"
                    : "border-transparent hover:bg-panel"
                )}
              >
                <Text
                  className={cn(
                    "text-xs font-semibold",
                    isActive ? "text-primary-foreground font-bold" : "text-muted-foreground"
                  )}
                >
                  {p}
                </Text>
              </Pressable>
            );
          })}
          {totalPages > 5 && (
            <>
              <Text className="text-muted-foreground text-xs px-1">...</Text>
              <Pressable
                onPress={() => setCurrentPage(totalPages)}
                className={cn(
                  "size-8 items-center justify-center rounded-lg border",
                  validPage === totalPages
                    ? "bg-primary border-primary"
                    : "border-transparent hover:bg-panel"
                )}
              >
                <Text
                  className={cn(
                    "text-xs font-semibold",
                    validPage === totalPages ? "text-primary-foreground font-bold" : "text-muted-foreground"
                  )}
                >
                  {totalPages}
                </Text>
              </Pressable>
            </>
          )}
        </View>

        <Button
          variant="outline"
          size="sm"
          disabled={validPage >= totalPages}
          onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          className={cn("h-9 rounded-xl px-3 border-border/80 flex-row items-center gap-1.5", validPage >= totalPages && "opacity-40")}
        >
          <Text className="text-xs font-semibold">Next</Text>
          <ChevronRight size={15} color={colors.text} />
        </Button>
      </View>
    </View>
  );
}
