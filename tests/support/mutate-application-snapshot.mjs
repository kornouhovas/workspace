import {createHash} from 'node:crypto';
import Database from 'better-sqlite3';

/** Corrupt data while preserving the exact trusted schema and envelope checksum. */
export function alteredSnapshot(content,mutate) {
 const envelope=JSON.parse(content),image=Buffer.from(envelope.database,'base64');image[18]=1;image[19]=1;
 const db=new Database(image);
 try {
  const triggers=db.prepare("SELECT name,sql FROM sqlite_schema WHERE type='trigger'").all();
  for(const {name} of triggers)db.exec(`DROP TRIGGER "${name}"`);
  mutate(db);
  for(const {sql} of triggers)db.exec(sql);
  const bytes=db.serialize();return JSON.stringify({...envelope,database:bytes.toString('base64'),checksum:createHash('sha256').update(bytes).digest('hex')});
 }finally{db.close();}
}
