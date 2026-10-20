// Metadata-only correctness reads use the same complete source snapshot as the
// displayed-view API. The service still validates revision/ownership/membership
// and reads current values, filters and layout. Filesystem checks stay explicit.
export function createPerformanceQueries(workspaceId, snapshot, query) {
  let projection={revision:snapshot.revision,projectIds:[...snapshot.projects,...(snapshot.retainedProjects??[])].map(project=>project.projectId)};
  return {
    query(name,fields={}) {
      return query({type:`workspace.${name}`,workspaceId,...fields,
        ...(name==='queryView'&&projection?{projection}:{})});
    },
    beginFilesystemPhase(){projection=undefined;},
  };
}
