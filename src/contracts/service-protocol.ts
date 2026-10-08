import type { ServiceResult, Settings } from "./settings.js";

export type ServiceRequest = {
  id: number;
  input: unknown;
};

export type ServiceResponse = {
  id: number;
  result: ServiceResult<Settings>;
};

export type ServicePort = {
  postMessage(message: unknown): void;
  on(event: "message", listener: (event: { data: unknown }) => void): void;
  start?(): void;
  close(): void;
};

export function isServiceRequest(value: unknown): value is ServiceRequest {
  return typeof value === "object" && value !== null &&
    typeof (value as { id?: unknown }).id === "number" &&
    Object.hasOwn(value, "input");
}

export function isServiceResponse(value: unknown): value is ServiceResponse {
  return typeof value === "object" && value !== null &&
    typeof (value as { id?: unknown }).id === "number" &&
    Object.hasOwn(value, "result");
}
