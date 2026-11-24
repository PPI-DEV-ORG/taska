import { TextClassContext } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import * as TabsPrimitive from "@rn-primitives/tabs";
import { Platform } from "react-native";

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "bg-muted flex min-h-9 h-auto flex-row flex-wrap items-center justify-start sm:justify-center gap-1 rounded-lg p-[3px] w-full sm:w-fit max-w-full",
        Platform.select({ web: "flex", native: "mr-auto" }),
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const { value } = TabsPrimitive.useRootContext();
  return (
    <TextClassContext.Provider
      value={cn(
        "text-foreground dark:text-muted-foreground text-sm font-medium",
        value === props.value && "dark:text-foreground",
      )}
    >
      <TabsPrimitive.Trigger
        className={cn(
          "flex min-h-8 h-auto flex-row items-center justify-center gap-1.5 rounded-md border border-transparent px-2.5 py-1.5 shadow-none shadow-black/5",
          Platform.select({
            web: "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring inline-flex cursor-default whitespace-nowrap transition-[color,box-shadow] focus-visible:outline-1 focus-visible:ring-[3px] disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
          }),
          props.disabled && "opacity-50",
          props.value === value &&
            "bg-background dark:border-foreground/10 dark:bg-input/30",
          className,
        )}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn(Platform.select({ web: "flex-1 outline-none" }), className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
