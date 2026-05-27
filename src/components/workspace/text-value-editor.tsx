import { useLayoutEffect, useRef } from "react";
import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type WorkspaceTextValueTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "rows"> & {
  readonly rows?: number;
};

function resizeTextValueTextarea(textarea: HTMLTextAreaElement | null) {
  if (!textarea) {
    return;
  }

  textarea.style.height = "0px";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

export function WorkspaceTextValueTextarea({
  className,
  defaultValue,
  onInput,
  rows = 1,
  ...props
}: WorkspaceTextValueTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    resizeTextValueTextarea(textareaRef.current);
  }, [defaultValue]);

  return (
    <textarea
      ref={textareaRef}
      rows={rows}
      defaultValue={defaultValue}
      data-slot="workspace-text-value-textarea"
      className={cn(
        "block min-h-8 w-full min-w-0 resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-2 py-1 text-sm leading-5 text-foreground shadow-none outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      onInput={(event) => {
        resizeTextValueTextarea(event.currentTarget);
        onInput?.(event);
      }}
      {...props}
    />
  );
}
