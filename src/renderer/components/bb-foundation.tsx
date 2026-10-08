import type { ChangeEvent, ReactNode } from "react";

export interface LanguageSelectProps {
  id: string;
  label: string;
  value: "en" | "ru";
  onChange: (language: "en" | "ru") => void;
  disabled?: boolean;
}

export function LanguageSelect({
  id,
  label,
  value,
  onChange,
  disabled = false,
}: LanguageSelectProps) {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextValue = event.currentTarget.value;
    if (nextValue === "en" || nextValue === "ru") onChange(nextValue);
  };

  return (
    <div className="bb-field">
      <label className="bb-label" htmlFor={id}>
        {label}
      </label>
      <select
        className="bb-select"
        id={id}
        value={value}
        onChange={handleChange}
        disabled={disabled}
      >
        <option value="en">English</option>
        <option value="ru">Русский</option>
      </select>
    </div>
  );
}

export interface StatusMessageProps {
  kind: "info" | "error";
  title: string;
  children?: ReactNode;
}

export function StatusMessage({ kind, title, children }: StatusMessageProps) {
  return (
    <section
      className={`bb-status bb-status--${kind}`}
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? "assertive" : "polite"}
    >
      <h2 className="bb-status__title">{title}</h2>
      {children && <div className="bb-status__description">{children}</div>}
    </section>
  );
}

export function EmptyStatePanel({ children }: { children: ReactNode }) {
  return <div className="bb-empty-state">{children}</div>;
}
