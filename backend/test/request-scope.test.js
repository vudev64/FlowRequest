import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Request from '../src/models/Request.js';
import {requestScopeQuery,requestDetailQuery} from '../src/services/RequestAccessService.js';
import {getRequests,getDashboard} from '../src/Controllers/requestController.js';

const values=(row,keys)=>!keys.length?(Array.isArray(row)?row:[row]):Array.isArray(row)?row.flatMap(item=>values(item,keys)):values(row?.[keys[0]],keys.slice(1));
const same=(a,b)=>String(a?._id||a)===String(b?._id||b);
function matches(row,q){return Object.entries(q).every(([k,v])=>k==='$and'?v.every(x=>matches(row,x)):k==='$or'?v.some(x=>matches(row,x)):v&&typeof v==='object'&&'$in'in v?values(row,k.split('.')).some(x=>v.$in.some(y=>same(x,y))):v&&typeof v==='object'&&'$ne'in v?values(row,k.split('.')).every(x=>!same(x,v.$ne)):values(row,k.split('.')).some(x=>same(x,v)));}
const response=()=>({code:200,status(n){this.code=n;return this;},json(body){this.body=body;return this;}});

test('all six roles use identical list/detail/stat scopes, hide other drafts and support role-based Director access',async t=>{
 const users=Object.fromEntries(['EMPLOYEE','MANAGER','DIRECTOR','HR_ADMIN','ACCOUNTANT','SYSTEM_ADMIN'].map(role=>[role,{_id:new mongoose.Types.ObjectId(),role}]));
 const secondEmployee=new mongoose.Types.ObjectId(),secondManager=new mongoose.Types.ObjectId(),secondDirector={_id:new mongoose.Types.ObjectId(),role:'DIRECTOR'};
 const fixture=(extra)=>({_id:new mongoose.Types.ObjectId(),author:secondEmployee,type:'LEAVE',status:'PENDING_MANAGER',currentApprover:secondManager,amount:0,approvalHistory:[],...extra});
 const rows=[fixture({author:users.EMPLOYEE._id,status:'DRAFT'}),fixture({author:users.EMPLOYEE._id,currentApprover:users.MANAGER._id}),fixture({status:'DRAFT',type:'PURCHASE',requiresDirector:true}),fixture({type:'PURCHASE',requiresDirector:true}),fixture({status:'PENDING_DIRECTOR',currentApprover:users.DIRECTOR._id}),fixture({status:'APPROVED',type:'PURCHASE',approvalHistory:[{approverId:users.DIRECTOR._id}]}),fixture({status:'APPROVED',type:'WFH'}),fixture({type:'RECRUITMENT',status:'PENDING_HRADMIN'}),fixture({type:'TRAINING',status:'PENDING_ACCOUNTANT'}),fixture({author:users.MANAGER._id,status:'PENDING_DIRECTOR',currentApprover:users.DIRECTOR._id})];
 const oldFind=Request.find,oldAggregate=Request.aggregate; t.after(()=>{Request.find=oldFind;Request.aggregate=oldAggregate;});
 let actor;
 Request.find=query=>({populate(){return this;},sort:async()=>rows.filter(row=>matches(row,query))});
 Request.aggregate=async pipeline=>{assert.deepEqual(pipeline[0],{$match:requestScopeQuery(actor)});const scoped=rows.filter(row=>matches(row,pipeline[0].$match)),key=pipeline.at(-1).$group._id.slice(1);return [...new Set(scoped.map(row=>row[key]))].map(value=>({_id:value,count:scoped.filter(row=>row[key]===value).length}));};
 for(actor of [...Object.values(users),{_id:secondManager,role:'MANAGER'},secondDirector]){
  const scope=requestScopeQuery(actor);assert.ok(scope);
  const list=response();await getRequests({user:actor},list);assert.equal(list.code,200);
  for(const row of rows)assert.equal(matches(row,requestDetailQuery(actor,row._id)),list.body.data.includes(row),actor.role+':'+row._id);
  assert.equal(list.body.data.some(row=>row.status==='DRAFT'&&!same(row.author,actor._id)),false);
  const stats=response();await getDashboard({user:actor},stats);assert.equal(stats.code,200);assert.equal(stats.body.data.statusOverview.reduce((n,r)=>n+r.count,0),list.body.data.length);
  if(actor===secondDirector)assert.ok(list.body.data.includes(rows[4]));
 }
 assert.equal(requestScopeQuery({_id:new mongoose.Types.ObjectId(),role:'UNKNOWN'}),null);
});
