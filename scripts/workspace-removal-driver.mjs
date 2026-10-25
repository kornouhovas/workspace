import assert from 'node:assert/strict';
// Navigate to an unsubmitted removal confirmation using the stable workspace ID.
// Session updates may consume a tools gesture; no removal command is replayed.
export async function enterWorkspaceRemoval(page,workspaceId,name) {
 const confirm=page.getByRole('button',{name:/^(Remove configuration|Удалить конфигурацию)$/});
 const group=page.getByRole('group',{name:new RegExp(`^(Workspace actions|Действия с рабочим пространством): ${name}$`)});
 const row=page.locator('.sidebar-workspace-row').filter({has:page.locator(`button[data-workspace-id="${workspaceId}"]`)});
 const deadline=Date.now()+15000;
 while(!await confirm.isVisible()){
  const left=()=>{const ms=deadline-Date.now();assert.ok(ms>0,'Workspace removal entry exceeded15000ms');return Math.min(1000,ms);};
  try{
   if(!await group.isVisible()){
    await row.getByRole('button',{name:/^(Workspace actions|Действия с рабочим пространством):/}).and(page.locator(':enabled')).press('Enter',{timeout:left()});
    await group.waitFor({timeout:left()});
   }
   await group.getByRole('button',{name:/^(Remove workspace|Удалить рабочее пространство)$/}).and(page.locator(':enabled')).press('Enter',{timeout:left()});
   await confirm.waitFor({timeout:left()});
  }catch(error){if(Date.now()>=deadline)throw error;}
 }
 return confirm;
}
