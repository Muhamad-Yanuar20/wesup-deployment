import pg from 'pg';
import nextEnv from '@next/env';
import {readFile} from 'node:fs/promises';
nextEnv.loadEnvConfig(process.cwd());
const db=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
try {
 await db.connect(); await db.query('begin');
 await db.query("set local lock_timeout='8s'; set local statement_timeout='30s'");
 for(const [version,name] of [['20261002000200','order_status_integrity'],['20261002000300','payment_status_audit_context']]) {
 if((await db.query('select 1 from supabase_migrations.schema_migrations where version=$1',[version])).rowCount)console.log(`${name} already applied`);
 else {
  const sql=await readFile(`supabase/migrations/${version}_${name}.sql`,'utf8');
  await db.query(sql);
  await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[version,name,[sql]]);
  console.log(`${name} applied; business records unchanged`);
 }
 }
 await db.query('commit');
} catch(error){await db.query('rollback').catch(()=>{});console.error('Migration stopped:',error.code||error.message);process.exitCode=1;}finally{await db.end();}
