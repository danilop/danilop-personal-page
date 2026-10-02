import test from "node:test";
import { execFileSync } from "node:child_process";

test("remote cleanup protects inventories, fails closed and soft-deletes only after grace", () => {
  execFileSync(
    "python3",
    [
      "-c",
      `
import importlib.util
from datetime import datetime,timedelta,timezone
spec=importlib.util.spec_from_file_location('cleanup','infrastructure/asset_cleanup.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
now=datetime(2026,10,2,tzinfo=timezone.utc)
def receipt(revision,state,days,key):
 return {'revision':revision,'state':state,'created':(now-timedelta(days=days)).isoformat(),'manifest':{'schemaVersion':1,'sources':{'file':{'key':'originals/'+key}},'outputs':{'file':{'key':'media/'+key}},'legacy':[]}}
records=[receipt('live','deployed',90,'live'),receipt('rollback','deployed',20,'rollback'),receipt('pending','pending',6,'pending'),receipt('old','deployed',31,'old'),receipt('abandoned','pending',8,'abandoned')]
keep=module.protected_keys(records,'live',now)
assert keep=={'originals/live','published/media/live','originals/rollback','published/media/rollback','originals/pending','published/media/pending'}
for extra,revision in [([], 'unknown'),([receipt('bad','unknown',1,'bad')],'live'),([receipt('bad','deployed',1,'../escape')],'live')]:
 try:module.protected_keys(records+extra,revision,now)
 except ValueError:pass
 else:raise AssertionError('Unknown or corrupt inventory must defer collection')
assert module.retention_expired(records[-1],'live',now)
assert not module.retention_expired(records[0],'live',now)
assert module.unused_action('originals/live',{'asset-unused-since':(now-timedelta(days=10)).isoformat()},keep,now)=='restore'
assert module.unused_action('originals/old',{},keep,now)=='mark'
assert module.unused_action('originals/old',{'asset-unused-since':(now-timedelta(days=6)).isoformat()},keep,now)=='keep'
assert module.unused_action('originals/old',{'asset-unused-since':(now-timedelta(days=8)).isoformat()},keep,now)=='quarantine'
class Fake:
 def __init__(self):self.writes=[];self.deletes=[]
 def get_paginator(self,_):return self
 def paginate(self,**kw):return [{'Contents':[{'Key':'originals/old'}]}] if kw['Prefix']=='originals/' else [{}]
 def get_object_tagging(self,**kw):return {'TagSet':[{'Key':'asset-managed','Value':'v1'},{'Key':'asset-unused-since','Value':(now-timedelta(days=8)).isoformat()}]}
 def head_object(self,**kw):return {'VersionId':'retained-version','ETag':'immutable-etag'}
 def put_object(self,**kw):self.writes.append(kw)
 def delete_object(self,**kw):self.deletes.append(kw)
fake=Fake();assert module.collect(fake,'bucket',keep,now,True)['quarantine']==1;assert not fake.writes and not fake.deletes
assert module.collect(fake,'bucket',keep,now,False)['quarantine']==1
fake.get_object_tagging=lambda **kw:{'TagSet':[]}
assert module.collect(fake,'bucket',keep,now,False)=={'mark':0,'restore':0,'quarantine':0}
assert len(fake.writes)==1 and fake.writes[0]['Key'].startswith('asset-trash/')
assert fake.deletes==[{'Bucket':'bucket','Key':'originals/old','IfMatch':'immutable-etag'}]
`,
    ],
    { stdio: "pipe" },
  );
});
