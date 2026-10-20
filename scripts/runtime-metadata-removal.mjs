/* global document, innerWidth */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
export async function exerciseMetadataRemoval({ page, query, rootPath, language, evidenceDirectory }) {
  const en = language === 'en';
  await mkdir(join(rootPath, 'Project'), { recursive: true });
  await writeFile(join(rootPath, 'Project', 'keep'), 'unchanged');
  const one = await query(page, { type: 'workspace.create', rootPath, name: `Removal ${language}` });
  const sibling = await query(page, { type: 'workspace.create', rootPath, name: `Removal sibling ${language}` });
  const { workspaceId, viewId } = one;
  const call = (type, fields = {}) => query(page, { type: `workspace.${type}`, workspaceId, ...fields });
  const projectId = (await call('applyDiscovery', { previewToken: (await call('previewDiscovery')).previewToken })).projects[0].projectId;
  const checks = [];
  const enabled = locator => locator.and(page.locator(':enabled'));
  const press = async locator => { await enabled(locator).focus(); await enabled(locator).press('Enter'); };
  const button = name => page.getByRole('button', { name, exact: true });
  const confirm = () => button(en ? 'Confirm deletion' : 'Подтвердить удаление');
  const review = () => button(en ? 'Review usages' : 'Проверить использования');
  for (const propertyType of ['single_select', 'multi_select']) for (const layout of ['table', 'board']) {
    await call('activate'); await call('setViewLayout', { viewId, kind: layout });
    const name = `Removal ${propertyType} ${layout}`;
    const propertyId = (await call('createProperty', { propertyType, name })).propertyId;
    const options = {};
    for (const name of ['Old', 'Next', 'Other']) options[name] = (await call('createSelectOption', { propertyId, name, color: 'blue' })).snapshot.selectOptions.find(o => o.propertyId === propertyId && o.name === name).optionId;
    await call(propertyType === 'single_select' ? 'setSelectValue' : 'setMultiSelectValue', { propertyId, projectId, ...(propertyType === 'single_select' ? { optionId: options.Old } : { optionIds: [options.Old, options.Next, options.Other] }) });
    for (const target of [one, sibling]) {
      const ids = { workspaceId: target.workspaceId, viewId: target.viewId };
      await call('setViewFilter', { ...ids, config: { search: '', rules: [{ propertyId, operator: 'any', operand: [options.Old] }] } });
      await call('setViewGrouping', { ...ids, config: { propertyId, settings: [] } });
      await call('setTableLayout', { ...ids, config: { columns: [{ propertyId, hidden: false, width: 230, wrap: false }], rowOrder: [projectId] } });
      await call('setBoardLayout', { ...ids, config: { properties: [{ propertyId, hidden: false }], widths: [{ propertyId, key: JSON.stringify(options.Old), width: 500 }], wrap: true } });
    }
    await page.reload();
    const editor = page.locator('.select-options').filter({ has: page.locator('summary', { hasText: name }) });
    await editor.locator('summary').press('Enter');
    const removeOption = editor.getByRole('button', { name: `${en ? 'Delete option' : 'Удалить вариант'}: Old`, exact: true });
    await press(removeOption);
    const panel = page.locator('.metadata-removal');
    await panel.getByText(`Removal sibling ${language} / Table`, { exact: true }).waitFor();
    await panel.getByRole('heading').first().press('Escape');
    await panel.waitFor({ state: 'detached' });
    await page.waitForFunction(label => document.activeElement?.getAttribute('aria-label') === label, `${en ? 'Delete option' : 'Удалить вариант'}: Old`);
    assert.equal((await call('listTextProperties')).selectOptions.filter(o => o.propertyId === propertyId).length, 3);
    await press(removeOption);
    await enabled(confirm()).waitFor();
    await page.getByLabel(en ? 'Values and references' : 'Значения и ссылки', { exact: true }).selectOption(options.Next);
    assert.equal(await confirm().isDisabled(), true);
    await press(review()); await press(confirm()); await panel.waitFor({ state: 'detached' });
    let snapshot = await call('listTextProperties');
    assert.deepEqual(snapshot.selectOptions.filter(o => o.propertyId === propertyId).map(o => o.optionId), [options.Next, options.Other]);
    assert.deepEqual((propertyType === 'single_select' ? snapshot.selectValues : snapshot.multiSelectValues).filter(v => v.propertyId === propertyId).map(v => v.optionId).sort(), (propertyType === 'single_select' ? [options.Next] : [options.Next, options.Other]).sort());
    const filters = button(en ? 'Search and filters' : 'Поиск и фильтры');
    if (await filters.getAttribute('aria-expanded') !== 'true') await press(filters);
    await page.waitForFunction(({ propertyId, next }) => {
      const operands = [...document.querySelectorAll('.view-filters select[multiple]')];
      return operands.some(s => [...s.selectedOptions].some(o => o.value === next)) && !document.querySelector(`.project-group[aria-label="Old"]`) && document.querySelector(`[data-column-id="${propertyId}"]`);
    }, { propertyId, next: options.Next });
    await page.locator('.text-properties details').filter({ has: page.locator('summary', { hasText: en ? 'Remove custom properties' : 'Удаление пользовательских свойств' }) }).locator('summary').press('Enter');
    await press(button(`${en ? 'Delete property' : 'Удалить свойство'}: ${name}`));
    await enabled(confirm()).waitFor();
    for (const width of [360, 1440]) {
      await page.setViewportSize({ width, height: width === 360 ? 720 : 960 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await panel.screenshot({ path: join(evidenceDirectory, `${language}-${layout}-${propertyType}-${width}-metadata-removal.png`) });
    }
    await press(confirm()); await panel.waitFor({ state: 'detached' });
    await page.waitForFunction(propertyId => !document.querySelector(`[data-column-id="${propertyId}"]`), propertyId);
    for (const target of [one, sibling]) {
      const ids = { workspaceId: target.workspaceId, viewId: target.viewId };
      assert.equal((await call('getViewFilter', ids)).config.rules.length, 0);
      assert.equal((await call('getViewGrouping', ids)).config.propertyId, null);
      assert.equal((await call('getTableLayout', ids)).config.columns.length, 0);
      assert.equal((await call('getBoardLayout', ids)).config.properties.length, 0);
    }
    await page.reload(); assert.ok(!(await call('listTextProperties')).definitions.some(p => p.propertyId === propertyId));
    assert.equal(await readFile(join(rootPath, 'Project', 'keep'), 'utf8'), 'unchanged');
    checks.push({ propertyType, layout, keyboard: true, cancel: true, focus: true, reassign: true, deleteProperty: true, siblingViews: true, reload: true, widths: [360, 1440], filesUnchanged: true });
  }
  return { checks };
}
