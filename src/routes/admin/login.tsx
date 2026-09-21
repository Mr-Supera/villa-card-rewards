import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route=createFileRoute("/admin/login")({head:()=>({meta:[{title:"Admin · Villa Card Rewards"}]}),component:AdminLogin});

function AdminLogin(){
 const navigate=useNavigate();const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [loading,setLoading]=useState(false);
 async function verificar(userId:string){const {data,error}=await supabase.from("staff").select("id,nome,cargo,permissoes").eq("id",userId).maybeSingle();if(error)throw error;if(!data)throw new Error("Esta conta não tem acesso ao Painel Admin/Staff.");const cargo=String(data.cargo).toLowerCase();if(!["admin","administrador","staff"].includes(cargo))throw new Error("A sua conta não possui uma função autorizada.");return data;}
 useEffect(()=>{supabase.auth.getSession().then(async({data})=>{if(data.session){try{await verificar(data.session.user.id);navigate({to:"/staff",replace:true});}catch{await supabase.auth.signOut();}}});},[navigate]);
 async function entrar(e:React.FormEvent){e.preventDefault();setLoading(true);try{const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;await verificar(data.user.id);navigate({to:"/staff",replace:true});}catch(e){await supabase.auth.signOut();toast.error("Acesso negado",{description:(e as Error).message});}finally{setLoading(false);}}
 async function recuperar(){if(!email)return toast.error("Introduza o email.");setLoading(true);const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+"/admin/login"});setLoading(false);if(error)toast.error("Não foi possível enviar o email",{description:error.message});else toast.success("Email enviado.");}
 return <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12"><Link to="/" className="mb-8 text-center"><p className="text-xs uppercase tracking-[0.35em] text-primary">Villa das Palmeiras</p><h1 className="mt-2 text-4xl text-gold-gradient">Villa Card · Admin</h1></Link><div className="card-premium w-full max-w-md rounded-3xl p-6 sm:p-8"><p className="text-xs uppercase tracking-[0.25em] text-primary">Acesso da equipa</p><h2 className="mt-2 text-2xl">Painel Admin / Staff</h2><p className="mt-2 text-sm text-muted-foreground">Apenas contas registadas na tabela staff podem entrar.</p><form onSubmit={entrar} className="mt-6 space-y-4"><div className="space-y-2"><Label>Email</Label><Input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></div><div className="space-y-2"><Label>Palavra-passe</Label><Input type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></div><Button className="w-full surface-gold" disabled={loading}>{loading?"A verificar…":"Entrar no Painel"}</Button><Button type="button" variant="link" className="w-full" onClick={recuperar} disabled={loading}>Esqueci-me da palavra-passe</Button></form></div></main>;
}