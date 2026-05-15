import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

export function createFilePropertyStore(filePath) {
  let storeOperation = Promise.resolve();

  function runStoreOperation(action) {
    const result = storeOperation.then(action, action);
    storeOperation = result.catch(() => {});
    return result;
  }

  return {
    async listProperties(workspaceId, options = {}) {
      return runStoreOperation(async () => {
        const data = await readPropertyStoreData(filePath);
        return Object.values(data.properties)
          .filter((property) => property.workspaceId === workspaceId)
          .filter((property) => options.includeDeleted === true || !property.deletedAt)
          .sort(compareStoreDocuments)
          .map(clone);
      });
    },
    async getProperty(workspaceId, propertyId) {
      return runStoreOperation(async () => {
        const data = await readPropertyStoreData(filePath);
        const property = data.properties[propertyId];
        return property?.workspaceId === workspaceId ? clone(property) : null;
      });
    },
    async saveProperty(property) {
      return runStoreOperation(async () => {
        const data = await readPropertyStoreData(filePath);
        data.properties[property.id] = clone(property);
        await writePropertyStoreData(filePath, data);
        return clone(property);
      });
    },
    async listSelectValues(workspaceId, options = {}) {
      return runStoreOperation(async () => {
        const data = await readPropertyStoreData(filePath);
        return Object.values(data.selectValues)
          .filter((value) => value.workspaceId === workspaceId)
          .filter((value) => !options.propertyId || value.propertyId === options.propertyId)
          .filter((value) => options.includeDeleted === true || !value.deletedAt)
          .sort(compareStoreDocuments)
          .map(clone);
      });
    },
    async getSelectValue(workspaceId, selectValueId) {
      return runStoreOperation(async () => {
        const data = await readPropertyStoreData(filePath);
        const selectValue = data.selectValues[selectValueId];
        return selectValue?.workspaceId === workspaceId ? clone(selectValue) : null;
      });
    },
    async saveSelectValue(selectValue) {
      return runStoreOperation(async () => {
        const data = await readPropertyStoreData(filePath);
        data.selectValues[selectValue.id] = clone(selectValue);
        await writePropertyStoreData(filePath, data);
        return clone(selectValue);
      });
    },
    async listProjectPropertyValues(workspaceId, options = {}) {
      return runStoreOperation(async () => {
        const data = await readPropertyStoreData(filePath);
        return Object.values(data.propertyValues)
          .filter((value) => value.workspaceId === workspaceId)
          .filter((value) => !options.projectId || value.projectId === options.projectId)
          .filter((value) => !options.propertyId || value.propertyId === options.propertyId)
          .filter((value) => options.includeDeleted === true || !value.deletedAt)
          .sort((left, right) => (
            String(left.projectId).localeCompare(String(right.projectId))
            || String(left.propertyId).localeCompare(String(right.propertyId))
            || String(left.id).localeCompare(String(right.id))
          ))
          .map(clone);
      });
    },
    async getProjectPropertyValue(workspaceId, projectId, propertyId) {
      return runStoreOperation(async () => {
        const data = await readPropertyStoreData(filePath);
        const value = data.propertyValues[createProjectPropertyValueKey(workspaceId, projectId, propertyId)];
        return value && !value.deletedAt ? clone(value) : null;
      });
    },
    async saveProjectPropertyValue(valueDocument) {
      return runStoreOperation(async () => {
        const data = await readPropertyStoreData(filePath);
        data.propertyValues[createProjectPropertyValueKey(
          valueDocument.workspaceId,
          valueDocument.projectId,
          valueDocument.propertyId,
        )] = clone(valueDocument);
        await writePropertyStoreData(filePath, data);
        return clone(valueDocument);
      });
    },
    async appendPropertyHistory(historyDocument) {
      return runStoreOperation(async () => {
        const data = await readPropertyStoreData(filePath);
        data.history.push(clone(historyDocument));
        await writePropertyStoreData(filePath, data);
        return clone(historyDocument);
      });
    },
    async listPropertyHistory(workspaceId, options = {}) {
      return runStoreOperation(async () => {
        const data = await readPropertyStoreData(filePath);
        return data.history
          .filter((history) => history.workspaceId === workspaceId)
          .filter((history) => !options.projectId || history.projectId === options.projectId)
          .filter((history) => !options.propertyId || history.propertyId === options.propertyId)
          .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)))
          .map(clone);
      });
    },
  };
}

function createEmptyPropertyStoreData() {
  return {
    schemaVersion: 1,
    properties: {},
    selectValues: {},
    propertyValues: {},
    history: [],
  };
}

async function readPropertyStoreData(filePath) {
  try {
    const data = JSON.parse(await readFile(filePath, "utf8"));
    return {
      schemaVersion: 1,
      properties: data?.properties && typeof data.properties === "object" ? data.properties : {},
      selectValues: data?.selectValues && typeof data.selectValues === "object" ? data.selectValues : {},
      propertyValues: data?.propertyValues && typeof data.propertyValues === "object" ? data.propertyValues : {},
      history: Array.isArray(data?.history) ? data.history : [],
    };
  } catch (error) {
    if (error.code === "ENOENT" || error instanceof SyntaxError) {
      return createEmptyPropertyStoreData();
    }

    throw error;
  }
}

async function writePropertyStoreData(filePath, data) {
  const directory = dirname(filePath);
  const tempPath = join(directory, `.${basename(filePath)}.${randomUUID()}.tmp`);
  await mkdir(directory, { recursive: true });

  try {
    await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`);
    await rename(tempPath, filePath);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }
}

function createProjectPropertyValueKey(workspaceId, projectId, propertyId) {
  return [workspaceId, projectId, propertyId].map((part) => encodeURIComponent(String(part))).join("/");
}

function compareStoreDocuments(left, right) {
  return (
    Number(left.order || 0) - Number(right.order || 0)
    || String(left.createdAt).localeCompare(String(right.createdAt))
    || String(left.id).localeCompare(String(right.id))
  );
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}
