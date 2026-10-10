import type { ProjectRevealProblem } from "../contracts/project-reveal.js";
import type { NativeProjectRevealResult, NativeProjectRevealValidation, TrustedProjectRevealTarget } from "../contracts/service-protocol.js";
import { nativeProjectFilesystem, verifyTrustedProjectRevealTarget, RevealFailure, type ProjectFilesystem } from "../service/project-filesystem.js";

export type NativeRevealContext = {
  isCurrent(): boolean;
  // Windows calls this after readiness, immediately before its one permit.
  permit(dispatchSync: () => void): Promise<void>;
  signal?: AbortSignal;
};

export function createNativeProjectReveal(showItemInFolder: (path: string, context: NativeRevealContext) => void | Promise<void>, filesystem: ProjectFilesystem = nativeProjectFilesystem) {
  return async (target: TrustedProjectRevealTarget, isCurrent: () => boolean,
    authorize?: () => Promise<NativeProjectRevealValidation>, signal?: AbortSignal,
  ): Promise<NativeProjectRevealResult> => {
    const rejected = (problem: ProjectRevealProblem): NativeProjectRevealResult => ({ outcome: "rejected", problem });
    try {
      if (!isCurrent() || signal?.aborted) return rejected("request_expired");
      if (authorize) {
        const authorization = await authorize();
        if (authorization.outcome === "rejected") return authorization;
        if (!isCurrent() || signal?.aborted) return rejected("request_expired");
      }
      const path = verifyTrustedProjectRevealTarget(target, filesystem);
      if (!isCurrent() || signal?.aborted) return rejected("request_expired");
      const permit = async (dispatchSync: () => void) => {
        if (!isCurrent() || signal?.aborted) throw new RevealFailure("request_expired");
        if (authorize) {
          const authorization = await authorize();
          if (authorization.outcome === "rejected") throw new RevealFailure(authorization.problem);
        }
        if (!isCurrent() || signal?.aborted) throw new RevealFailure("request_expired");
        verifyTrustedProjectRevealTarget(target, filesystem);
        if (!isCurrent() || signal?.aborted) throw new RevealFailure("request_expired");
        // No await or promise continuation may separate validation from GO.
        dispatchSync();
      };
      // macOS dispatches synchronously here. Windows repeats these guards through
      // permit after readiness; GO begins its irreversible cross-process dispatch.
      // Neither path checks nor an IPC permit lock policy or the filesystem.
      await showItemInFolder(path, { permit, isCurrent, signal });
      if (!isCurrent() || signal?.aborted) return rejected("request_expired");
      verifyTrustedProjectRevealTarget(target, filesystem);
      return { outcome: "dispatched" };
    } catch (error) { return rejected(error instanceof RevealFailure ? error.problem : "native_error"); }
  };
}
