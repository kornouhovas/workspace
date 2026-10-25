import {savedFolderRoles,rolePlacement,folderRole,validRolePath} from "./folder-roles.js";
import type Database from "better-sqlite3";

/** Final-state counterparts of migration guards. Historical intent/stage/locator
 * checks cannot be replayed: valid receipts outlive workspaces and configuration.
 * Keep this inventory aligned with any accepted schema/format adapter. */
export function validateSnapshotRelations(db: Database.Database): void {
  function rejectRows(sql: string) {
    if (db.prepare(`${sql} LIMIT 1`).get()) throw new Error("Invalid snapshot relationships");
  }
  const valueTypes = [
    ["text_property_values", "text"], ["number_property_values", "number"],
    ["date_property_values", "date"], ["select_property_values", "single_select"],
    ["multi_select_property_values", "multi_select"],
  ] as const;
  for (const [table, type] of valueTypes) {
    rejectRows(`SELECT 1 FROM ${table} v JOIN property_definitions d ON d.id=v.property_id WHERE d.property_type!='${type}'`);
  }
  rejectRows(`SELECT 1 FROM select_options o JOIN property_definitions d ON d.id=o.property_id
    WHERE d.property_type NOT IN ('single_select','multi_select')`);
  rejectRows(`SELECT 1 FROM select_option_visibility v JOIN workspaces w ON w.id=v.workspace_id
    JOIN select_options o ON o.id=v.option_id WHERE w.source_id!=o.source_id`);
  rejectRows(`SELECT 1 FROM category_presentation v JOIN workspaces w ON w.id=v.workspace_id
    JOIN categories c ON c.id=v.category_id WHERE w.source_id!=c.source_id`);
  const roleSchema=(db.prepare("PRAGMA table_info(sources)").all() as {name:string}[]).some(column=>column.name==="folder_roles");
  const legacy=roleSchema ? "s.folder_roles IS NULL AND " : "";
  rejectRows(`SELECT 1 FROM categories c JOIN sources s ON s.id=c.source_id
    WHERE ${legacy}(instr(c.relative_path,'/')!=0 OR (c.mode_inactive=0 AND s.discovery_mode IS NOT 'grouped'))`);
  rejectRows(`SELECT 1 FROM projects p JOIN sources s ON s.id=p.source_id
    WHERE (p.category_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM categories c WHERE c.id=p.category_id AND c.source_id=p.source_id))
    OR (${legacy}p.mode_inactive=0 AND (
      (s.discovery_mode IS NOT 'grouped' AND (p.category_id IS NOT NULL OR instr(p.relative_path,'/')!=0))
      OR (s.discovery_mode='grouped' AND NOT EXISTS(SELECT 1 FROM categories c WHERE c.id=p.category_id AND c.source_id=p.source_id
        AND (p.association_state!='active' OR (c.association_state='active' AND c.mode_inactive=0
          AND substr(p.relative_path,1,length(c.relative_path)+1)=c.relative_path||'/'
          AND length(p.relative_path)>length(c.relative_path)+1 AND instr(substr(p.relative_path,length(c.relative_path)+2),'/')=0))))
    ))`);
  if (roleSchema) for (const source of db.prepare("SELECT id,folder_roles,discovery_mode FROM sources WHERE folder_roles IS NOT NULL").all() as {id:string;folder_roles:string;discovery_mode:"direct"|"grouped"}[]) {
    const roles=savedFolderRoles({folderRoles:source.folder_roles})!;
    const categories=db.prepare("SELECT id,relative_path,association_state,mode_inactive FROM categories WHERE source_id=?").all(source.id) as {id:string;relative_path:string;association_state:string;mode_inactive:number}[];
    for (const category of categories) if (!validRolePath(category.relative_path) || !category.mode_inactive && category.association_state==="active" && folderRole(category.relative_path,roles,source.discovery_mode)!=="status") throw new Error("Invalid role status");
    for (const project of db.prepare("SELECT relative_path,category_id,association_state,mode_inactive FROM projects WHERE source_id=?").all(source.id) as {relative_path:string;category_id:string|null;association_state:string;mode_inactive:number}[]) {
      if (!validRolePath(project.relative_path)) throw new Error("Invalid role project path");
      if (project.mode_inactive || project.association_state!=="active") continue;
      const placement=rolePlacement(project.relative_path,roles,source.discovery_mode);
      const category=categories.find(category=>category.id===project.category_id);
      if (!placement.recognized || (placement.categoryPath===null ? project.category_id!==null : !category || category.mode_inactive || category.association_state!=="active" || category.relative_path!==placement.categoryPath)) throw new Error("Invalid role project status");
    }
  }
  rejectRows(`SELECT 1 FROM project_archives a WHERE NOT EXISTS(SELECT 1 FROM projects p
    WHERE p.id=a.project_id AND p.source_id=a.source_id AND p.mode_inactive=1 AND p.relative_path=a.original_relative_path)`);

  // Distinct journal IDs are guarded at command insertion. Creation/Rename are
  // historically allowed to share an ID; a removal attempt also owns its Move ID.
  rejectRows(`WITH history AS (
      SELECT operation_id id,'creation' kind FROM project_creation_operations
      UNION ALL SELECT operation_id,'rename' FROM project_rename_operations
      UNION ALL SELECT operation_id,'move' FROM project_category_move_operations
      UNION ALL SELECT operation_id,'folder' FROM category_folder_operations
      UNION ALL SELECT operation_id,'removal' FROM category_removal_operations
      UNION ALL SELECT operation_id,'archive' FROM project_archive_operations
      UNION ALL SELECT move_id,'attempt' FROM category_removal_attempts)
    SELECT id FROM history GROUP BY id HAVING count(*)>1 AND NOT(count(*)=2 AND
      ((min(kind)='creation' AND max(kind)='rename') OR (min(kind)='attempt' AND max(kind)='move')))`);
  for (const [table, stages, paths] of [
    ["project_rename_operations", "'intent','staged','destination_recorded','uncertain'", ["original_relative_path", "requested_relative_path", "staging_relative_path"]],
    ["project_category_move_operations", "'intent','destination_recorded','uncertain'", ["original_relative_path", "requested_relative_path"]],
  ] as const) {
    const overlap = paths.map(path => `a.${path} IN (${paths.map(other => `b.${other}`).join()})`).join(" OR ");
    rejectRows(`SELECT 1 FROM ${table} a JOIN ${table} b ON a.source_id=b.source_id AND a.operation_id!=b.operation_id
      WHERE a.stage IN (${stages}) AND b.stage IN (${stages}) AND (${overlap})`);
  }
  rejectRows(`SELECT 1 FROM category_removal_attempts a JOIN category_removal_operations r ON r.operation_id=a.removal_id
    JOIN projects p ON p.id=a.project_id WHERE p.source_id!=r.source_id OR NOT EXISTS(
      SELECT 1 FROM json_each(r.binding,'$.members') m WHERE json_extract(m.value,'$.id')=a.project_id)`);
  rejectRows(`SELECT 1 FROM project_category_move_operations m JOIN category_removal_attempts a ON a.move_id=m.operation_id
    JOIN category_removal_operations r ON r.operation_id=a.removal_id WHERE a.project_id!=m.project_id
      OR a.workspace_id!=m.initiating_workspace_id OR a.expected_revision!=m.expected_revision OR r.source_id!=m.source_id
      OR r.category_id!=m.original_category_id OR r.destination_category_id IS NOT m.destination_category_id
      OR r.original_relative_path!=m.original_parent_relative_path OR r.requested_relative_path IS NOT m.destination_parent_relative_path`);
}
