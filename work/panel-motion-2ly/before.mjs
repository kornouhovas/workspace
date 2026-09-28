import {_electron as electron} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
const dir='work/panel-motion-2ly/evidence';const f=JSON.parse(await readFile(`${dir}/fixture.json`));
const app=await electron.launch({executablePath:`${f.app}/Contents/MacOS/Electron`,args:['electron/main.js'],env:{...process.env,WORKSPACE_DEV:'1',WORKSPACE_DEV_DATA:f.metadata,WORKSPACE_DEV_URL:''}});
try{const p=await app.firstWindow();await p.getByRole('button',{name:'Project Alpha',exact:true}).click();
const out={previewHeading:await p.getByRole('heading',{name:'Project Alpha',exact:true}).count(),hoverClose:await p.getByRole('button',{name:'Close Project Alpha',exact:true}).count(),resizeMax:await p.getByRole('separator',{name:'Resize right panel'}).getAttribute('aria-valuemax')};
await p.getByTestId('workspace-right-panel').getByRole('button',{name:'Maximize pane'}).click();await p.getByRole('tab',{name:'Board',exact:true}).click();out.rightAfterView=await p.getByTestId('workspace-right-panel').boundingBox();out.tabs=await p.locator('[data-project-tab-id]').count();await p.screenshot({path:`${dir}/before-view.png`});await writeFile(`${dir}/before.json`,JSON.stringify(out,null,2));console.log(out);
}finally{await app.close()}
