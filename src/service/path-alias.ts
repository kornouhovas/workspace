// Reservation keys are deliberately conservative on every filesystem. Uppercase
// expansion covers aliases such as long s, final sigma and ligatures; the second
// uppercase pass also expands capital sharp s after it has become lowercase.
// This key is never a persisted locator or proof of folder identity.
export function filesystemAlias(path: string): string {
  return path.normalize("NFD").toUpperCase().toLowerCase().toUpperCase().normalize("NFD");
}
