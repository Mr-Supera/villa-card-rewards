import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
Deno.serve(async (req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 try{
  const auth=req.headers.get("Authorization");if(!auth)throw new Error("Não autenticado");
  const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}}});
  const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Sessão inválida");
  const {data:staff}=await supabase.from("staff").select("id,cargo,permissoes").eq("id",user.id).maybeSingle();
  if(!staff)throw new Error("Apenas staff/admin pode criar contas");
  const perms=staff.permissoes as Record<string,unknown>|null;const admin=["admin","administrador"].includes(String(staff.cargo).toLowerCase());
  if(!admin && perms && perms.clientes_write!==true)throw new Error("Sem permissão para criar clientes");
  const body=await req.json();const {nome,email,password,contacto,codigo_nfc}=body;
  if(!nome||!email||!password||!codigo_nfc)throw new Error("Nome, email, password e código NFC são obrigatórios");
  const service=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const {data:created,error:ce}=await service.auth.admin.createUser({email,password,email_confirm:true});
  if(ce)throw ce;
  const {data:cliente,error:cle}=await service.from("clientes").insert({auth_user_id:created.user.id,nome,contacto:contacto||null,email}).select("id").single();
  if(cle){await service.auth.admin.deleteUser(created.user.id);throw cle;}
  const {data:card,error:ca}=await service.from("cartoes").insert({cliente_id:cliente.id,codigo_nfc,estado:"ativo"}).select("id").single();
  if(ca){await service.from("clientes").delete().eq("id",cliente.id);await service.auth.admin.deleteUser(created.user.id);throw ca;}
  await service.from("clientes").update({cartao_nfc_id:card.id}).eq("id",cliente.id);
  return new Response(JSON.stringify({ok:true,user_id:created.user.id,cliente_id:cliente.id,cartao_id:card.id}),{headers:{...cors,"Content-Type":"application/json"}});
 }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:"Erro interno"}),{status:400,headers:{...cors,"Content-Type":"application/json"}})}
});