import type { ProjectRevealProblem } from "../contracts/project-reveal.js";
import type { NativeProjectRevealResult, NativeProjectRevealValidation, TrustedProjectRevealTarget } from "../contracts/service-protocol.js";
import { nativeProjectFilesystem, verifyTrustedProjectRevealTarget, RevealFailure, type ProjectFilesystem } from "../service/project-filesystem.js";

export function createNativeProjectReveal(showItemInFolder: (path: string) => void | Promise<void>, filesystem: ProjectFilesystem = nativeProjectFilesystem) {
  return async (target: TrustedProjectRevealTarget, isCurrent: () => boolean,
    authorize?: () => Promise<NativeProjectRevealValidation>,
  ): Promise<NativeProjectRevealResult> => {
    const rejected = (problem: ProjectRevealProblem): NativeProjectRevealResult => ({ outcome: "rejected", problem });
    try {
      if (!isCurrent()) return rejected("request_expired");
      if (authorize) {
        const authorization = await authorize();
        if (authorization.outcome === "rejected") return authorization;
        if (!isCurrent()) return rejected("request_expired");
      }
      const path = verifyTrustedProjectRevealTarget(target, filesystem);
      if (!isCurrent()) return rejected("request_expired");
      // No await between evidence validation and this path-based native invocation.
      // A concurrent filesystem writer can still replace/move a path in that window.
      await showItemInFolder(path);
      if (!isCurrent()) return rejected("request_expired");
      verifyTrustedProjectRevealTarget(target, filesystem);
      return { outcome: "dispatched" };
    } catch (error) { return rejected(error instanceof RevealFailure ? error.problem : "native_error"); }
  };
}
