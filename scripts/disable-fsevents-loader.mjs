const disabledFsEventsModule = "data:text/javascript,export default undefined";

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "fsevents") {
    return {
      shortCircuit: true,
      url: disabledFsEventsModule,
    };
  }

  return nextResolve(specifier, context);
}
