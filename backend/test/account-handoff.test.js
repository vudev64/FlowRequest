import { testStorageRoot } from './support/unitTestStorage.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import requestRouter from '../src/Router/request.js';
import Request from '../src/models/Request.js';
import User from '../src/models/User.js';
import Department from '../src/models/Department.js';
import AuditLog from '../src/models/Auditlog.js';
import SystemSettings from '../src/models/SystemSettings.js';
import { settingsDefaults } from '../src/config/settingsDefaults.js';
import { REQUEST_TYPES as T } from '../src/constants/enums.js';
import { writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';

test('request API hands off employee/manager/HR requests to accounting and returns final history to the sender', async t => {
  // Isolated persistence adapter: no production database connection or outbound email.
  const rows = [], users = ['EMPLOYEE','MANAGER','DIRECTOR','HR_ADMIN','ACCOUNTANT'].map(role => ({ _id: new mongoose.Types.ObjectId(), role, name: role, email: `${role.toLowerCase()}@example.invalid`, department: 'Engineering', status: 'ACTIVE' }));
  const [employee, manager, director, hr, accountant] = users;
  for (const user of users) user.managerId = manager._id;
  const originalSecret = process.env.JWT_SECRET, patches = [];
  process.env.JWT_SECRET = 'isolated-handoff-test-key';
  const patch = (object, key, value) => { const old = object[key]; patches.push(() => { object[key] = old; }); object[key] = value; };
  const valuesAt = (object, path) => { if (!path.length) return Array.isArray(object) ? object : [object]; if (Array.isArray(object)) return object.flatMap(item => valuesAt(item, path)); return valuesAt(object?.[path[0]], path.slice(1)); };
  const same = (a,b) => String(a?._id || a) === String(b?._id || b);
  const matches = (row, query) => Object.entries(query).every(([field, value]) => {
    if (field === '$and') return value.every(part => matches(row, part));
    if (field === '$or') return value.some(part => matches(row, part));
    const actual = valuesAt(row, field.split('.'));
    if (value && typeof value === 'object' && '$in' in value) return actual.some(a => value.$in.some(v => same(a,v)));
    if (value && typeof value === 'object' && '$ne' in value) return actual.every(a => !same(a,value.$ne));
    return actual.some(a => same(a,value));
  });
  const populate = row => row && ({ ...row, author: users.find(user => same(user._id,row.author)) || row.author, approvalHistory: (row.approvalHistory || []).map(entry => ({ ...entry, approverId: users.find(user => same(user._id,entry.approverId)) || entry.approverId })) });
  const chain = resolveValue => ({ select() { return this; }, populate() { return this; }, maxTimeMS() { return this; }, session() { return this; }, lean() { return Promise.resolve(resolveValue()); }, sort() { return Promise.resolve(resolveValue()); }, then(resolve,reject) { return Promise.resolve(resolveValue()).then(resolve,reject); } });
  const config = settingsDefaults(); config.notifications.enabled = false;
  patch(SystemSettings,'findOne',()=>chain(()=>config));
  patch(User,'findById',id=>chain(()=>users.find(user=>same(user._id,id))));
  patch(User,'findOne',async query=>users.find(user=>matches(user,query)) || null);
  const department = { _id: new mongoose.Types.ObjectId(), name: 'Engineering', annualBudget: 1_000_000_000, usedBudget: 0 };
  patch(Department,'findOne',async()=>department);
  patch(Department,'findOneAndUpdate',async (_query,update)=>{ department.usedBudget += update.$inc.usedBudget; return department; });
  patch(AuditLog,'create',async()=>({}));
  patch(mongoose,'startSession',async()=>({ withTransaction:async callback=>callback(), endSession:async()=>{} }));
  patch(Request,'create',async values=>{ const document = new Request(values); await document.validate(); const row = { ...document.toObject(), createdAt: new Date() }; rows.push(row); return row; });
  patch(Request,'find',query=>chain(()=>rows.filter(row=>matches(row,query)).map(populate)));
  patch(Request,'findOne',query=>chain(()=>populate(rows.find(row=>matches(row,query)))));
  patch(Request,'findById',id=>chain(()=>populate(rows.find(row=>same(row._id,id)))));
  patch(Request,'findOneAndUpdate',async(query,update)=>{ const row=rows.find(item=>matches(item,query));if(!row)return null;Object.assign(row,update.$set);row.approvalHistory.push(update.$push.approvalHistory);return {...row}; });
  const app = express(); app.use(express.json()); app.use('/api/request',requestRouter);
  const server = app.listen(0,'127.0.0.1'); await new Promise(resolve=>server.once('listening',resolve));
  t.after(async()=>{ await new Promise(resolve=>server.close(resolve)); for(const restore of patches.reverse())restore(); if(originalSecret===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=originalSecret; });
  const call = async(actor,path='',method='GET',body)=>{ const token=jwt.sign({id:actor._id,role:actor.role},process.env.JWT_SECRET,{expiresIn:'1h'});const response=await fetch(`http://127.0.0.1:${server.address().port}/api/request${path}`,{method,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,body:await response.json()}; };
  const payload = (type,amount=1000)=>({type,amount,title:`Handoff ${type}`,content:'Isolated workflow integration test',...(type===T.PURCHASE?{category:'EQUIPMENT',purchaseDetails:{deviceName:'Test device',quantity:1,unitPrice:amount}}:type===T.BUSINESS_TRIP?{extraDetails:{fromDate:'2026-11-20',toDate:'2026-11-21',destination:'Test destination',purpose:'Test purpose'}}:type===T.TRAINING?{extraDetails:{courseName:'Test course',provider:'Test provider',fromDate:'2026-11-20',toDate:'2026-11-21'}}:{leaveType:'ANNUAL',startDate:'2026-11-20',endDate:'2026-11-20'})});
  for (const scenario of [
    {type:T.PURCHASE,author:employee,stages:[manager]},
    {type:T.PURCHASE,author:employee,amount:50_000_000,stages:[manager,director]},
    {type:T.PURCHASE,author:manager,stages:[director]},
    {type:T.BUSINESS_TRIP,author:employee,stages:[manager]},
    {type:T.BUSINESS_TRIP,author:manager,stages:[director]},
    {type:T.TRAINING,author:employee,stages:[manager,hr]},
    {type:T.TRAINING,author:manager,stages:[director,hr]},
  ]) {
    const created=await call(scenario.author,'','POST',payload(scenario.type,scenario.amount));assert.equal(created.status,201,JSON.stringify(created.body));const id=created.body.data._id;
    assert.equal((await call(accountant,`/${id}/status`,'PATCH',{action:'APPROVED'})).status,403,'Accountant must not review before handoff');
    for(const actor of scenario.stages){const inbox=await call(actor);assert.ok(inbox.body.data.some(row=>row._id===id));const approved=await call(actor,`/${id}/status`,'PATCH',{action:'APPROVED'});assert.equal(approved.status,200,JSON.stringify(approved.body));}
    const inbox=await call(accountant);const received=inbox.body.data.find(row=>row._id===id);assert.ok(received);assert.equal(received.status,'PENDING_ACCOUNTANT');
    const detail=await call(accountant,`/${id}`);assert.equal(detail.status,200);assert.deepEqual(detail.body.data.approvalHistory.map(h=>h.role),scenario.stages.map(actor=>actor.role));
    assert.equal((await call(accountant,`/${id}/status`,'PATCH',{action:'APPROVED',comment:'Accounting reviewed'})).status,200);
    const sender=await call(scenario.author,`/${id}`);assert.equal(sender.status,200);assert.equal(sender.body.data.status,'APPROVED');assert.equal(sender.body.data.approvalHistory.at(-1).role,'ACCOUNTANT');
    if(scenario.stages.includes(director)) {
      const historical=await call(director,`/${id}`);assert.equal(historical.status,200,'Director must retain access after forwarding');
      assert.equal(historical.body.data.status,'APPROVED');
      assert.ok((await call(director)).body.data.some(row=>row._id===id),'Director history must include previously reviewed manager requests');
    }
  }
  const rejected=await call(employee,'','POST',payload(T.PURCHASE));const rejectId=rejected.body.data._id;
  await call(manager,`/${rejectId}/status`,'PATCH',{action:'APPROVED'});
  assert.equal((await call(accountant,`/${rejectId}/status`,'PATCH',{action:'REJECTED',comment:'Missing supporting document'})).status,200);
  const returned=await call(employee,`/${rejectId}`);assert.equal(returned.body.data.status,'REJECTED');assert.equal(returned.body.data.approvalHistory.at(-1).comment,'Missing supporting document');
  const own=await call(accountant,'','POST',payload(T.PURCHASE));await call(manager,`/${own.body.data._id}/status`,'PATCH',{action:'APPROVED'});assert.equal((await call(accountant,`/${own.body.data._id}/status`,'PATCH',{action:'APPROVED'})).status,403);
  const draft=await call(employee,'','POST',{...payload(T.PURCHASE),isDraft:true});assert.equal(draft.status,201);assert.ok(!(await call(accountant)).body.data.some(row=>row._id===draft.body.data._id));
  const leave=await call(employee,'','POST',payload(T.LEAVE,0));await call(manager,`/${leave.body.data._id}/status`,'PATCH',{action:'APPROVED'});assert.ok(!(await call(accountant)).body.data.some(row=>row._id===leave.body.data._id));assert.equal((await call(accountant,`/${leave.body.data._id}`)).status,404);
  assert.equal((await call(director,`/${leave.body.data._id}`)).status,404,'Unrelated HR request must stay outside Director scope');
  assert.equal((await call(director,`/${draft.body.data._id}`)).status,404,'Director must not see another user draft');
  // Read-protected attachment endpoint uses the same scope as request details.
  const fileName=`director-test-${new mongoose.Types.ObjectId()}.pdf`;
  const filePath=path.join(testStorageRoot,'uploads',fileName);
  await writeFile(filePath,'%PDF-1.4\nIsolated test document');
  t.after(async()=>{await unlink(filePath).catch(()=>{});});
  const reviewedRow=rows.find(row=>row.approvalHistory.some(h=>String(h.approverId)===String(director._id)));
  reviewedRow.attachment=`/uploads/${fileName}`;
  const fileURL=`http://127.0.0.1:${server.address().port}/api/request/${reviewedRow._id}/attachment`;
  const directorToken=jwt.sign({id:director._id,role:director.role},process.env.JWT_SECRET,{expiresIn:'1h'});
  assert.equal((await fetch(fileURL)).status,401);
  const download=await fetch(fileURL,{headers:{Authorization:`Bearer ${directorToken}`}});
  assert.equal(download.status,200);assert.ok((await download.text()).startsWith('%PDF-'));assert.equal(download.headers.get('cache-control'),'private, no-store');
  const employeeDownload = await fetch(fileURL, { headers: { Authorization: `Bearer ${jwt.sign({ id: employee._id }, process.env.JWT_SECRET, { expiresIn: '1h' })}` } });
  assert.equal(employeeDownload.status, 200); assert.ok((await employeeDownload.text()).startsWith('%PDF-'));
  const otherEmployee = { _id: new mongoose.Types.ObjectId(), role: 'EMPLOYEE', name: 'Other employee', status: 'ACTIVE' }; users.push(otherEmployee);
  assert.equal((await call(otherEmployee, `/${reviewedRow._id}/attachment`)).status, 404);
  const otherDirector={_id:new mongoose.Types.ObjectId(),role:'DIRECTOR',name:'Other director',status:'ACTIVE'};users.push(otherDirector);
  const assignedRow=rows.find(row=>!row.requiresDirector&&row.approvalHistory.some(h=>String(h.approverId)===String(director._id)));
  assignedRow.attachment=`/uploads/${fileName}`;
  assert.equal((await call(otherDirector,`/${assignedRow._id}/attachment`)).status,404);
  assignedRow.attachment='/uploads/..';assert.equal((await call(director,`/${assignedRow._id}/attachment`)).status,404);
  const wrongStage=await call(employee,'','POST',payload(T.PURCHASE));
  assert.equal((await call(director,`/${wrongStage.body.data._id}/status`,'PATCH',{action:'APPROVED'})).status,403);
  assert.equal((await call(employee,`/${wrongStage.body.data._id}/status`,'PATCH',{action:'APPROVED'})).status,403);
  const ownDirectorRow={...rows[0],_id:new mongoose.Types.ObjectId(),author:director._id,status:'PENDING_DIRECTOR',currentApprover:director._id,approvalHistory:[]};rows.push(ownDirectorRow);
  assert.equal((await call(director,`/${ownDirectorRow._id}/status`,'PATCH',{action:'APPROVED'})).status,403);
  const rejectAtDirector=await call(manager,'','POST',payload(T.TRAINING));
  assert.equal((await call(director,`/${rejectAtDirector.body.data._id}/status`,'PATCH',{action:'REJECTED',comment:''})).status,400);
  assert.equal((await call(director,`/${rejectAtDirector.body.data._id}/status`,'PATCH',{action:'REJECTED',comment:'Director rejected test request'})).status,200);
  assert.equal((await call(manager,`/${rejectAtDirector.body.data._id}`)).body.data.status,'REJECTED');
});
