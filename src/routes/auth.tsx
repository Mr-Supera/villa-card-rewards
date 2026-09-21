import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route=createFileRoute("/auth")({head:()=>({meta:[{title:"Entrar · Villa Card"},{name:"description",content:"Aceda à sua conta Villa Card."}]}),component:AuthPage});

function AuthPage(){
 const navigate=useNavigate();const [loading,setLoading]=useState(false);const [email,setEmail]=useState("");const [password,setPassword]=useState("");
 useEffect(()=>{supabase.auth.getSession().then(({data})=>{if(data.session)navigate({to:"/painel",replace:true});});},[navigate]);
 async function entrar(e:React.FormEvent){e.preventDefault();setLoading(true);const {error}=await supabase.auth.signInWithPassword({email,password});setLoading(false);if(error){toast.error("Não foi possível entrar",{description:error.message});return;}navigate({to:"/painel",replace:true});}
 async function recuperar(){if(!email){toast.error("Introduza primeiro o seu email.");return;}setLoading(true);const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+"/auth"});setLoading(false);if(error)toast.error("Não foi possível enviar o email",{description:error.message});else toast.success("Email enviado",{description:"Verifique a sua caixa de correio para redefinir a palavra-passe."});}
 return <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12"><Link to="/" className="mb-8 text-center"><p className="text-xs uppercase tracking-[0.35em] text-primary">Villa das Palmeiras</p><h1 className="mt-2 text-4xl text-gold-gradient">Villa Card</h1></Link><div className="card-premium w-full max-w-md rounded-3xl p-6 sm:p-8"><div><p className="text-xs uppercase tracking-[0.25em] text-primary">Área reservada</p><h2 className="mt-2 text-2xl">Entrar na sua conta</h2><p className="mt-2 text-sm text-muted-foreground">As contas são criadas exclusivamente pela equipa Villa das Palmeiras no momento da emissão do cartão.</p></div><form onSubmit={entrar} className="mt-6 space-y-4"><div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="nome@exemplo.co.mz"/></div><div className="space-y-2"><Label htmlFor="password">Palavra-passe</Label><Input id="password" type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></div><Button type="submit" disabled={loading} className="w-full surface-gold">{loading?"A entrar…":"Entrar"}</Button><Button type="button" variant="link" className="w-full" disabled={loading} onClick={recuperar}>Esqueci-me da palavra-passe</Button></form></div></main>;
}