import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

test('Demo and Production uploads and private vouchers are written to independent storage roots', async () => {
  const backupRoot = fileURLToPath(new URL('../../.backups/', import.meta.url));
  const prefix = path.join(backupRoot, 'production-env-storage-'), root = await mkdtemp(prefix);
  const demo = path.join(root, 'demo'), production = path.join(root, 'production');
  try {
    for (const environment of ['demo', 'production']) {
      const code = `
        import express from ${JSON.stringify(new URL('../node_modules/express/index.js',import.meta.url).href)};
        import SystemSettings from ${JSON.stringify(new URL('../src/models/SystemSettings.js',import.meta.url).href)};
        SystemSettings.findOne=()=>({maxTimeMS(){return this},lean:async()=>null});
        const {upload}=await import(${JSON.stringify(new URL('../src/middleware/upload.js',import.meta.url).href)});
        const app=express();app.post('/public',upload.single('attachment'),(req,res)=>res.json({path:req.file.path}));app.post('/private',upload.single('attachment',{privateStorage:true}),(req,res)=>res.json({path:req.file.path}));
        const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
        const results=[];try{for(const route of ['public','private']){const form=new FormData();form.set('attachment',new Blob(['%PDF-1.4\\nIndependent storage test'],{type:'application/pdf'}),'storage.pdf');const response=await fetch('http://127.0.0.1:'+server.address().port+'/'+route,{method:'POST',body:form});if(!response.ok)throw new Error('Upload status '+response.status);results.push(await response.json());}console.log(JSON.stringify(results));}finally{await new Promise(resolve=>server.close(resolve));}
      `;
      const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', timeout: 15000, env: { ...process.env, FLOWREQUEST_ENV: environment, DEMO_STORAGE_ROOT: demo, PRODUCTION_STORAGE_ROOT: production } });
      assert.equal(child.status, 0, child.stderr);
      const rows = JSON.parse(child.stdout.trim());
      const chosen = environment === 'demo' ? demo : production;
      assert.equal(path.dirname(rows[0].path), path.join(chosen, 'uploads')); assert.equal(path.dirname(rows[1].path), path.join(chosen, 'private-vouchers'));
      for (const row of rows) assert.ok((await readFile(row.path,'utf8')).startsWith('%PDF-'));
    }
    for (const chosen of [demo,production]) for (const folder of ['uploads','private-vouchers']) assert.equal((await readdir(path.join(chosen,folder))).length,1);
  } finally {
    if (!root.startsWith(prefix) || path.dirname(root) !== path.resolve(backupRoot)) throw new Error('Refuse cleanup outside the owned storage fixture directory');
    await rm(root, { recursive: true, force: true });
  }
});
