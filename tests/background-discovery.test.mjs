import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { createBackgroundDiscovery } from "../src/service/background-discovery.ts";
import { scanDirectSource, scanGroupedSource } from "../src/service/discovery.ts";

for (const mode of ["direct","grouped"]) test(`${mode}: background scan yields the command thread, preserves complete native evidence and closes before root reuse`, async()=>{
  const directory=mkdtempSync(join(tmpdir(),"background-discovery-")), root=join(directory,"root");
  const parent=mode==="grouped"?join(root,"Category"):root;
  mkdirSync(parent,{recursive:true});
  for(let i=0;i<40;i++){mkdirSync(join(parent,`Project ${i}`));writeFileSync(join(parent,`Project ${i}`,"marker"),"unchanged");}
  const request={mode,canonicalRoot:root,archiveRelativePath:null,exclusions:[]};
  const scanner=createBackgroundDiscovery(resolve("dist/service/discovery-worker.cjs"));
  try {
    const expected=(mode==="grouped"?scanGroupedSource:scanDirectSource)(root,null,[]);
    let settled=false;
    const pending=scanner.scan(request).then(value=>{settled=true;return value;});
    await Promise.resolve();
    assert.equal(settled,false,"A source scan must leave the caller's command turn free");
    assert.deepEqual(await pending,expected,"Complete two-pass scanner evidence crosses the worker boundary unchanged");
    const cancelled=assert.rejects(scanner.scan(request),/closed/);
    scanner.close(); await cancelled;
    renameSync(root,`${root}-moved`);
    assert.equal(readFileSync(join(`${root}-moved`,mode==="grouped"?"Category":"","Project 0/marker"),"utf8"),"unchanged");
    await assert.rejects(scanner.scan(request),/closed/);
  } finally {scanner.close();rmSync(directory,{recursive:true,force:true});}
});
test("cooperative stop cannot turn an incomplete direct/grouped scan into accepted evidence",()=>{
  const directory=mkdtempSync(join(tmpdir(),"cancelled-discovery-"));
  try {
    mkdirSync(join(directory,"Category","Project"),{recursive:true});
    for(const scan of [scanDirectSource,scanGroupedSource]){
      const stopped=scan(realpathSync.native(directory),null,[],()=>true);
      assert.equal(stopped.state,"changed");assert.equal(stopped.snapshot,null);assert.deepEqual(stopped.entries,[]);
      assert.equal(scan(realpathSync.native(directory),null,[]).state,"ready");
    }
  }finally{rmSync(directory,{recursive:true,force:true});}
});
