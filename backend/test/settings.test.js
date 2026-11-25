import './support/unitTestStorage.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import settingsRouter, { publicSettingsRouter } from '../src/Router/settings.js';
import SystemSettings from '../src/models/SystemSettings.js';
import User from '../src/models/User.js';
import AuditLog from '../src/models/Auditlog.js';
import LoginAttempt from '../src/models/LoginAttempt.js';
import { settingsDefaults, validateSettings } from '../src/config/settingsDefaults.js';
import { passwordError } from '../src/services/SettingsService.js';
import { login } from '../src/Controllers/authController.js';
import { protect } from '../src/middleware/authMiddleware.js';
import { sendEmail } from '../src/services/EmailService.js';
import { upload, permittedFile } from '../src/middleware/upload.js';
import { zonedDayStart } from '../src/services/TimeZoneService.js';
import fs from 'node:fs';

const chain = data => ({ maxTimeMS() { return this; }, select() { return this; }, session() { return this; }, lean: async () => data, then(resolve,reject) { return Promise.resolve(data).then(resolve,reject); } });
function mocks(t) {
  const restore=[]; t.after(()=>restore.reverse().forEach(fn=>fn()));
  return (obj,key,value)=>{ const before=obj[key]; restore.push(()=>obj[key]=before); obj[key]=value; };
}
test('settings validator rejects unsafe values, unknown fields and preserves compatibility defaults', () => {
  const baseline = { revision:0,...settingsDefaults() };
  assert.ok(validateSettings(baseline).value);
  assert.equal(baseline.security.sessionMinutes,10080);
  assert.equal(baseline.security.maxFailedLogins,0);
  assert.equal(baseline.attachments.maxSizeMB,5);
  for(const change of [s=>s.general.logoUrl='javascript:alert(1)',s=>s.general.timeZone='invalid/zone',s=>s.security.sessionMinutes=0,s=>s.security.password.minLength=100,s=>s.notifications.email.senderName='Name\r\nBcc:bad@example.com',s=>s.attachments.extensions=['.exe'],s=>s.extra='not allowed']) {
    const value=structuredClone(baseline);change(value);assert.equal(validateSettings(value).value,undefined);
  }
  const policy={minLength:12,uppercase:true,lowercase:true,number:true,special:true};
  assert.ok(passwordError('weak',policy));assert.equal(passwordError('StrongPass1!',policy),null);
  assert.equal(zonedDayStart('2026-11-18','Asia/Bangkok').toISOString(),'2026-11-17T17:00:00.000Z');
  assert.equal(zonedDayStart('2026-03-08','America/New_York').toISOString(),'2026-03-08T05:00:00.000Z');
  assert.equal(zonedDayStart('2026-03-09','America/New_York').toISOString(),'2026-03-09T04:00:00.000Z');
});

test('settings API enforces SYSTEM_ADMIN, validates, persists with audit atomically and rejects stale revisions', async t => {
  const mock=mocks(t), oldSecret=process.env.JWT_SECRET;
  process.env.JWT_SECRET='settings-test-secret';t.after(()=>oldSecret===undefined?delete process.env.JWT_SECRET:process.env.JWT_SECRET=oldSecret);
  const actor={_id:new mongoose.Types.ObjectId(),role:'SYSTEM_ADMIN',name:'Administrator',tokenVersion:0};
  let stored=null,audits=[],auditFails=false;
  mock(User,'findById',()=>chain(actor));
  mock(SystemSettings,'init',async()=>{});
  mock(SystemSettings,'findOne',()=>chain(stored));
  mock(SystemSettings,'create',async docs=>{stored={_id:new mongoose.Types.ObjectId(),...docs[0],updatedAt:new Date()};return[stored];});
  mock(SystemSettings,'findOneAndUpdate',async(filter,update)=>{if(stored.revision!==filter.revision)return null;stored={...stored,...update.$set,revision:stored.revision+1};return stored;});
  mock(AuditLog,'create',async docs=>{if(auditFails)throw new Error('Audit failed');audits.push(...docs);});
  mock(mongoose,'startSession',async()=>({endSession:async()=>{},withTransaction:async fn=>{const before=stored&&{...stored};const count=audits.length;try{await fn();}catch(e){stored=before;audits.length=count;throw e;}}}));
  const app=express();app.use(express.json());app.use('/admin/settings',settingsRouter);app.use('/public/settings',publicSettingsRouter);
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const token=jwt.sign({id:actor._id},process.env.JWT_SECRET);
  const call=(method='GET',body)=>fetch(base+'/admin/settings',{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body&&{body:JSON.stringify(body)})});
  assert.equal((await fetch(base+'/admin/settings')).status,401);
  for(const role of ['EMPLOYEE','MANAGER','DIRECTOR','HR_ADMIN','ACCOUNTANT']){actor.role=role;assert.equal((await call()).status,403);}
  actor.role='SYSTEM_ADMIN';
  const initial=await(await call()).json();assert.equal(initial.persisted,false);assert.equal(initial.revision,0);assert.equal(stored,null);
  const publicView=await(await fetch(base+'/public/settings')).json();assert.equal(publicView.security,undefined);assert.equal(publicView.notifications,undefined);assert.equal(publicView.general.systemName,initial.general.systemName);
  const body={revision:0,...settingsDefaults()};body.general.companyName='Company from administrator';
  const invalid=await call('PUT',{...body,role:'SYSTEM_ADMIN'});assert.equal(invalid.status,400);assert.equal(stored,null);
  assert.equal((await call('PUT',body)).status,200);assert.equal(stored.general.companyName,body.general.companyName);assert.equal(stored.revision,1);assert.equal(audits.length,1);assert.equal(audits[0].action,'UPDATE_SYSTEM_SETTINGS');
  assert.equal((await call('PUT',body)).status,409);assert.equal(stored.revision,1);
  auditFails=true;
  const failBody={...body,revision:1,general:{...body.general,companyName:'Must roll back'}};
  assert.equal((await call('PUT',failBody)).status,500);assert.equal(stored.general.companyName,body.general.companyName);assert.equal(stored.revision,1);assert.equal(audits.length,1);
  const view=await(await call()).json();assert.equal(view.updatedBy,'Administrator');assert.equal(view.revision,1);assert.ok(view.readOnly.workflow.length>0);assert.equal(JSON.stringify(view).includes('settings-test-secret'),false);
});

test('session duration and failed-login policy apply while existing passwords remain usable',async t=>{
 const mock=mocks(t), oldSecret=process.env.JWT_SECRET;process.env.JWT_SECRET='session-policy-test';t.after(()=>oldSecret===undefined?delete process.env.JWT_SECRET:process.env.JWT_SECRET=oldSecret);
 const config=settingsDefaults();config.security.sessionMinutes=5;config.security.maxFailedLogins=2;config.security.password.minLength=20;
 const actor={_id:new mongoose.Types.ObjectId(),role:'SYSTEM_ADMIN',name:'Admin',email:'admin@example.invalid',password:await bcrypt.hash('oldpass',4)};
 let attempt=null;
 mock(SystemSettings,'findOne',()=>chain(config));mock(User,'findOne',async()=>actor);mock(User,'findById',()=>chain(actor));
 mock(LoginAttempt,'findById',()=>chain(attempt));
 mock(LoginAttempt,'findOneAndUpdate',async(query,update)=>{if(update.$inc){if(!attempt)return null;attempt={...attempt,failures:attempt.failures+1};return attempt;}attempt={_id:query._id,...update.$set};return attempt;});
 mock(LoginAttempt,'updateOne',async(query,update)=>{attempt={...attempt,...update.$set};});mock(LoginAttempt,'deleteOne',async()=>{attempt=null;});
 const app=express();app.use(express.json());app.post('/login',login);app.get('/protected',protect,(req,res)=>res.json({ok:true}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}`;
 const signIn=password=>fetch(base+'/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:actor.email,password})});
 const good=await signIn('oldpass');assert.equal(good.status,200);const token=(await good.json()).token;const decoded=jwt.decode(token);assert.equal(decoded.exp-decoded.iat,300);
 const old=jwt.sign({id:actor._id,iat:Math.floor(Date.now()/1000)-600},process.env.JWT_SECRET,{expiresIn:'7d'});
 assert.equal((await fetch(base+'/protected',{headers:{Authorization:'Bearer '+old}})).status,401);
 assert.equal((await signIn('wrong')).status,400);assert.equal((await signIn('wrong')).status,400);
 assert.equal((await signIn('oldpass')).status,429);assert.ok(attempt.lockedUntil>new Date());assert.ok(!String(attempt._id).includes(actor.email));
 attempt.lockedUntil=new Date(Date.now()-1000);assert.equal((await signIn('oldpass')).status,200);assert.equal(attempt,null);
});

test('email toggle skips external delivery and provider rejection is reported',async t=>{
 const oldEnvironment=process.env.FLOWREQUEST_ENV,oldProductionKey=process.env.PRODUCTION_RESEND_API_KEY;
 process.env.FLOWREQUEST_ENV='production';process.env.PRODUCTION_RESEND_API_KEY='re_local_test';
 t.after(()=>{oldEnvironment===undefined?delete process.env.FLOWREQUEST_ENV:process.env.FLOWREQUEST_ENV=oldEnvironment;oldProductionKey===undefined?delete process.env.PRODUCTION_RESEND_API_KEY:process.env.PRODUCTION_RESEND_API_KEY=oldProductionKey;});
 const mock=mocks(t), config=settingsDefaults(), originalKey=process.env.RESEND_API_KEY;
 process.env.RESEND_API_KEY='re_local_test';t.after(()=>originalKey===undefined?delete process.env.RESEND_API_KEY:process.env.RESEND_API_KEY=originalKey);
 mock(SystemSettings,'findOne',()=>chain(config));let calls=0, payload;
 mock(globalThis,'fetch',async(url,options)=>{calls++;payload=JSON.parse(options.body);return new Response('{"id":"local-test"}',{status:200,headers:{'Content-Type':'application/json'}});});
 config.notifications.enabled=false;assert.equal((await sendEmail({to:'nobody@example.invalid',subject:'test',html:'test'})).skipped,true);assert.equal(calls,0);
 config.notifications.enabled=true;config.notifications.email.senderName='Configured Sender';config.notifications.email.senderEmail='sender@example.invalid';
 assert.equal((await sendEmail({to:'nobody@example.invalid',subject:'test',html:'test'})).success,true);assert.equal(payload.from,'Configured Sender <sender@example.invalid>');
 mock(globalThis,'fetch',async()=>new Response('{"name":"validation_error","message":"Rejected"}',{status:422,headers:{'Content-Type':'application/json'}}));
 assert.equal((await sendEmail({to:'nobody@example.invalid',subject:'test',html:'test'})).success,false);
});

test('upload enforces current size, extension and file signature; JSON requests remain compatible',async t=>{
 const mock=mocks(t),config=settingsDefaults();config.attachments={maxSizeMB:1,extensions:['.pdf']};mock(SystemSettings,'findOne',()=>chain(config));
 assert.equal(permittedFile({originalname:'x.exe',mimetype:'application/pdf'},config.attachments),false);
 const app=express();app.use(express.json());let filePath;
 app.post('/upload',upload.single('attachment'),(req,res)=>{filePath=req.file?.path;res.json({file:!!req.file,details:req.body.extraDetails||null});});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(async()=>{await new Promise(resolve=>server.close(resolve));if(filePath)await fs.promises.unlink(filePath).catch(()=>{});});
 const url=`http://127.0.0.1:${server.address().port}/upload`;
 const send=(body,name='file.pdf',type='application/pdf')=>{const form=new FormData();form.append('extraDetails',JSON.stringify({purpose:'stored'}));form.append('attachment',new Blob([body],{type}),name);return fetch(url,{method:'POST',body:form});};
 assert.equal((await send('not a pdf')).status,400);
 assert.equal((await send('%PDF-test','file.png','image/png')).status,400);
 assert.equal((await send('%PDF-'+ 'x'.repeat(1024*1024))).status,400);
 const good=await send('%PDF-1.4\nActual test fixture');assert.equal(good.status,200);assert.deepEqual((await good.json()).details,{purpose:'stored'});
 await fs.promises.unlink(filePath);filePath=null;
 const json=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'JSON is preserved'})});assert.equal(json.status,200);
});
