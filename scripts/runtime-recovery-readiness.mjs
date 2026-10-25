// Contextual workspace settings load the owned source asynchronously.
export async function waitForRuntimeRecoverySource(page, canonicalRoot) {
  const settings=page.locator('.settings-page:not([hidden])');
  await settings.getByRole('button',{name:canonicalRoot,exact:true})
    .or(settings.getByRole('region',{name:canonicalRoot,exact:true})).waitFor();
}
