"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
export default function OfferDraftList() {
 const [items,setItems]=useState<Array<{id:string;step:number;payload:{title?:string}}>>([]);const [error,setError]=useState("");
 useEffect(()=>{const controller=new AbortController();void fetch('/api/suppliers/offers',{cache:'no-store',signal:controller.signal}).then(async r=>{const b=await r.json();if(!r.ok)throw Error(b.error??'Draft belum dapat dimuat.');setItems(b.items??[]);}).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>controller.abort();},[]);
 if(!items.length&&!error)return null;
 return <section className="mb-6 rounded-xl border bg-white p-5"><h2 className="font-bold">Draft belum selesai</h2>{error&&<p className="text-sm text-red-700">{error}</p>}<ul className="mt-3 space-y-3">{items.map(d=><li key={d.id}><Link className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-slate-50 p-3" href={`/supplier/catalog/new?draft=${d.id}`}><span>{d.payload.title||'Penawaran tanpa nama'}</span><span className="text-xs font-semibold text-blue-700">Lanjut langkah {d.step} →</span></Link></li>)}</ul></section>;
}
