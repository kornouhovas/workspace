import type { Story } from "@ladle/react";
import "./bb-foundation.css";
import {
  EmptyStatePanel,
  LanguageSelect,
  StatusMessage,
} from "./bb-foundation";

export const English: Story = () => (
  <div className="bb-foundation-preview" lang="en">
    <LanguageSelect id="language-en" label="Interface language" value="en" onChange={() => {}} />
    <StatusMessage kind="info" title="Starting local service">
      Workspace is getting ready.
    </StatusMessage>
    <StatusMessage kind="error" title="Could not save language">
      Your saved preference has not changed.
    </StatusMessage>
    <EmptyStatePanel>No projects yet.</EmptyStatePanel>
  </div>
);

export const Russian: Story = () => (
  <div className="bb-foundation-preview" lang="ru">
    <LanguageSelect id="language-ru" label="Язык интерфейса" value="ru" onChange={() => {}} />
    <StatusMessage kind="info" title="Запуск локальной службы">
      Workspace готовит приложение к работе.
    </StatusMessage>
    <StatusMessage kind="error" title="Не удалось сохранить язык">
      Сохранённая настройка не изменилась.
    </StatusMessage>
    <EmptyStatePanel>Проектов пока нет.</EmptyStatePanel>
  </div>
);
