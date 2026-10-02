// Executes the same assertions in a private schema on the configured PostgreSQL.
// All schema, grants, fixture rows and role changes are rolled back afterwards.
import pg from 'pg';
import nextEnv from '@next/env';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
nextEnv.loadEnvConfig(process.cwd());
const client=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
const schema=`integrity_fixture_${randomUUID().replaceAll('-','')}`;
const transform=sql=>sql.replaceAll('public.',`${schema}.`).replaceAll('search_path=public',`search_path=${schema}`).replaceAll('search_path = public',`search_path = ${schema}`)
 .replace(/create role (?:anon|authenticated|service_role);/g,'')
 .replace('create schema auth; create function auth.uid() returns uuid language sql as $$select null::uuid$$;','')
 .replaceAll('begin; select set_config', 'savepoint fixture_recovery; select set_config')
 .replaceAll('; rollback;', '; rollback to savepoint fixture_recovery; release savepoint fixture_recovery;')
 .replaceAll('; commit;', '; release savepoint fixture_recovery;');
async function statement(sql,params) {
 await client.query('savepoint fixture_statement');
 try{const result=await client.query(transform(sql),params);await client.query('release savepoint fixture_statement');return result;}
 catch(error){await client.query('rollback to savepoint fixture_statement');await client.query('release savepoint fixture_statement');throw error;}
}
const db={exec:statement,query:statement,close:async()=>{}};
try {
 await client.connect();await client.query('begin');await client.query("set local statement_timeout='20s'; set local lock_timeout='8s'");
 await client.query(`create schema ${schema}; set local search_path=${schema},public`);
 let source=await readFile('tests/database/order-status-integrity.mjs','utf8');
 source=source.replace(/import .*;\n/g,'').replace("const {PGlite}=await import(pathToFileURL(process.argv[2]).href);\nconst db=new PGlite();\n",'');
 const assert=(await import('node:assert/strict')).default;
 await new (Object.getPrototypeOf(async function(){}).constructor)('db','readFile','assert',source)(db,readFile,assert);
 await client.query('rollback');console.log('PASS remote PostgreSQL fixtures rolled back; public business rows untouched');
} catch(error){await client.query('rollback').catch(()=>{});console.error('Remote fixture failed:',error.code||error.message);process.exitCode=1;}finally{await client.end();}
