"use client";
import {useEffect,useState} from "react";
import type {MarketplaceItem} from "@/lib/marketplace/types";
export default function JoinIntentQuantity({item}:{item:MarketplaceItem}) {
 const [quantity,setQuantity]=useState(1);useEffect(()=>{const timer=setTimeout(()=>{try{const saved=Number(sessionStorage.getItem(`wesup:join:${item.id}`));if(Number.isSafeInteger(saved)&&saved>0)setQuantity(saved);}catch{}},0);return()=>clearTimeout(timer);},[item.id]);
 return <div className="space-y-2 text-sm"><label className="font-semibold" htmlFor="join-intent-quantity">Jumlah yang ingin dipesan ({item.unit})</label><input id="join-intent-quantity" type="number" min="1" step="1" value={quantity} onChange={e=>{const value=Number(e.target.value);setQuantity(value);try{sessionStorage.setItem(`wesup:join:${item.id}`,e.target.value);}catch{}}} className="block min-h-11 w-full rounded-lg border p-3"/><p>Total maksimum: {new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(quantity*item.basePrice)}. Jumlah tersimpan saat Anda masuk atau melengkapi profil; ringkasan dan persetujuan ditampilkan lagi setelahnya.</p></div>;
}
