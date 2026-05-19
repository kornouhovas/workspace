import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from "@/lib/lucide-icons";

type WorkspaceDateValueEditorProps = {
  readonly value: unknown;
  readonly dismissSignal?: number;
  readonly triggerClassName?: string;
  readonly onValueChange: (value: string | null) => void;
};

const weekDayLabels = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function stopDateEditorActivation(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

function getDateValue(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function formatDate(year: number, month: number, day: number) {
  return [
    String(year).padStart(4, "0"),
    String(month + 1).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function getMonthStart(value: string) {
  if (!value) {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }

  const [year, month] = value.split("-").map((part) => Number(part));
  return new Date(year, month - 1, 1);
}

function getMondayFirstOffset(day: number) {
  return (day + 6) % 7;
}

function getMonthDays(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingSlots = getMondayFirstOffset(firstDay);

  return [
    ...Array.from({ length: leadingSlots }, () => null),
    ...Array.from({ length: daysInMonth }, (_unused, index) => index + 1),
  ];
}

function getMonthLabel(monthDate: Date) {
  return monthDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function WorkspaceDateValueEditor({
  value,
  dismissSignal,
  triggerClassName,
  onValueChange,
}: WorkspaceDateValueEditorProps) {
  const dateValue = getDateValue(value);
  const [open, setOpen] = useState(false);
  const [monthDate, setMonthDate] = useState(() => getMonthStart(dateValue));
  const [typedDate, setTypedDate] = useState(dateValue);
  const monthDays = useMemo(() => getMonthDays(monthDate), [monthDate]);

  useEffect(() => {
    setOpen(false);
  }, [dismissSignal]);

  function moveMonth(offset: number) {
    setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function selectDate(day: number) {
    const nextValue = formatDate(monthDate.getFullYear(), monthDate.getMonth(), day);
    setTypedDate(nextValue);
    onValueChange(nextValue);
    setOpen(false);
  }

  function clearDate() {
    setTypedDate("");
    onValueChange(null);
    setOpen(false);
  }

  function commitTypedDate() {
    const nextDate = getDateValue(typedDate);
    if (!typedDate.trim()) {
      clearDate();
      return;
    }
    if (!nextDate) {
      setTypedDate(dateValue);
      return;
    }

    setMonthDate(getMonthStart(nextDate));
    onValueChange(nextDate);
    setOpen(false);
  }

  return (
    <div onClick={stopDateEditorActivation} onPointerDown={stopDateEditorActivation}>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (nextOpen) {
            setTypedDate(dateValue);
            setMonthDate(getMonthStart(dateValue));
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className={triggerClassName || "h-8 w-full min-w-0 justify-start px-2 font-normal"}
            aria-label="Pick date"
          >
            <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span
              className={[
                dateValue ? "workspace-table-text-value" : "workspace-table-empty-value",
                "-mx-1 min-w-0 truncate rounded-md px-1 py-0.5",
              ].join(" ")}
            >
              {dateValue || "Empty"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-72"
          onClick={stopDateEditorActivation}
          onPointerDown={stopDateEditorActivation}
        >
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => moveMonth(-1)}>
                <ChevronLeftIcon className="size-4" aria-hidden="true" />
              </Button>
              <div className="truncate text-sm font-medium">{getMonthLabel(monthDate)}</div>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => moveMonth(1)}>
                <ChevronRightIcon className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
              {weekDayLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthDays.map((day, index) => {
                const currentDate = day
                  ? formatDate(monthDate.getFullYear(), monthDate.getMonth(), day)
                  : "";
                const selected = currentDate === dateValue;

                return day ? (
                  <Button
                    key={currentDate}
                    type="button"
                    variant={selected ? "default" : "ghost"}
                    size="icon-sm"
                    className="h-8 w-full"
                    onClick={() => selectDate(day)}
                  >
                    {day}
                  </Button>
                ) : (
                  <span key={`empty-${index}`} className="h-8" aria-hidden="true" />
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={typedDate}
                placeholder="YYYY-MM-DD"
                aria-label="Date value"
                className="h-8"
                onChange={(event) => setTypedDate(event.target.value)}
                onBlur={commitTypedDate}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitTypedDate();
                  }
                }}
              />
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Clear date" onClick={clearDate}>
                <XIcon className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
