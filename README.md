# Villa Card Rewards

Cria uma aplicação web (PWA) chamada "Villa Card" para o resort Villa das Palmeiras

(Maputo, Moçambique). É um sistema de cartão de fidelidade físico com chip NFC,

onde os clientes recarregam saldo e usufruem de descontos/vantagens no resort.

O sistema tem DOIS PAINÉIS distintos dentro da mesma app, com login separado:

═══════════════════════════════════════

1. PAINEL DO CLIENTE (app pública)

═══════════════════════════════════════

Autenticação:

- Registo por telefone (Moçambique, formato +258) ou email

- Login com password ou OTP por SMS

- Após registo, o cliente fica com uma conta SEM cartão associado (o cartão físico

  é associado depois, presencialmente, por um admin)

Dashboard do cliente:

- Saldo atual em destaque (formato: MZN)

- Nível de fidelidade atual (Bronze / Prata / Ouro / Platina) com badge visual

- Percentagem de desconto do nível atual

- Botão "Pedir Recarga" (abre um pedido que o admin confirma manualmente, ou

  integração futura com M-Pesa — por agora, apenas gera um pedido pendente)

- Histórico de transações (lista com: data, tipo [recarga/débito], descrição,

  valor, saldo após transação) — com filtro por período

- Secção "Minhas Vantagens" — lista de benefícios do nível atual (ex: desconto

  em restaurante, acesso a zonas exclusivas, brinde de aniversário)

- QR Code pessoal (gerado a partir do ID do cliente) como alternativa de

  identificação caso o cartão físico não esteja disponível

- Perfil: nome, telefone, email, data de nascimento, editar dados

═══════════════════════════════════════

2. PAINEL ADMIN/STAFF (área protegida)

═══════════════════════════════════════

Autenticação:

- Login apenas para staff (email + password), com dois níveis de acesso:

  - "Operador de Balcão" — pode fazer débitos, consultar saldo, ver histórico

  - "Administrador" — tudo o que o operador faz + gerir clientes, associar

    cartões NFC, gerir níveis de fidelidade, ver relatórios financeiros

Funcionalidades do Operador de Balcão:

- Ecrã principal: campo para inserir manualmente o UID do cartão NFC OU

  escanear QR code (usando câmara do dispositivo) — ao identificar o cliente,

  mostra imediatamente: nome, foto, saldo, nível, desconto aplicável

- Botão "Debitar" — insere valor da compra, sistema calcula automaticamente

  o desconto do nível do cliente, mostra valor final, confirma e deduz do saldo

- Botão "Recarregar" — insere valor e método de pagamento (Numerário /

  M-Pesa / e-Mola / Cartão bancário / Transferência), confirma e adiciona ao saldo

- Histórico de transações do dia (para conferência de caixa no fecho)

- Alerta visual se o saldo for insuficiente para a transação

Funcionalidades exclusivas do Administrador:

- Gestão de Clientes: criar novo cliente, editar dados, desativar conta

- Associar Cartão NFC: fluxo para ligar um UID de cartão físico novo a um

  cliente (campo para "aproximar o cartão do leitor" ou inserir UID manualmente)

- Gestão de Níveis de Fidelidade: criar/editar níveis (nome, percentagem de

  desconto, saldo mínimo acumulado para subir de nível, benefícios em texto livre)

- Relatórios: total recarregado no período, total gasto no período, clientes

  mais ativos, saldo total em circulação (passivo do resort), exportação para CSV

- Gestão de Staff: criar contas de operadores, definir permissões

═══════════════════════════════════════

BASE DE DADOS (usar Supabase)

═══════════════════════════════════════

Tabelas principais:

clientes

- id (uuid, pk)

- nome_completo

- telefone (único)

- email (único, opcional)

- data_nascimento

- nfc_uid (único, nullable — preenchido quando o cartão físico é associado)

- nivel_fidelidade_id (fk)

- saldo (numeric, default 0)

- ativo (boolean, default true)

- criado_em (timestamp)

niveis_fidelidade

- id (uuid, pk)

- nome (ex: Bronze, Prata, Ouro, Platina)

- percentagem_desconto (numeric)

- saldo_minimo_acumulado (numeric — total histórico recarregado para atingir o nível)

- beneficios (text)

- cor_badge (text, para UI)

transacoes

- id (uuid, pk)

- cliente_id (fk)

- tipo (enum: 'recarga', 'debito', 'estorno')

- valor (numeric)

- metodo_pagamento (enum: 'numerario', 'mpesa', 'emola', 'cartao', 'transferencia', null)

- descricao (text, ex: "Consumo no Restaurante", "Recarga balcão")

- saldo_resultante (numeric — saldo do cliente após esta transação)

- processado_por (fk para staff, nullable)

- criado_em (timestamp)

staff

- id (uuid, pk)

- nome_completo

- email (único)

- cargo (enum: 'operador', 'administrador')

- ativo (boolean, default true)

pedidos_recarga (para pedidos feitos pelo cliente via app, pendentes de confirmação)

- id (uuid, pk)

- cliente_id (fk)

- valor_solicitado (numeric)

- status (enum: 'pendente', 'confirmado', 'rejeitado')

- criado_em (timestamp)

═══════════════════════════════════════

REGRAS DE NEGÓCIO IMPORTANTES

═══════════════════════════════════════

- Toda transação de débito ou recarga deve ser registada de forma atómica

  (transação de base de dados) — nunca alterar o campo "saldo" sem criar o

  registo correspondente em "transacoes"

- O desconto do nível de fidelidade é aplicado automaticamente no momento do

  débito, com base no nível ATUAL do cliente

  do valor total recarregado historicamente pelo cliente (soma de todas as

  transações tipo 'recarga')

- Não permitir débito se saldo insuficiente (bloquear e mostrar mensagem clara)

- Row Level Security (RLS) no Supabase: clientes só veem os seus próprios

  dados; operadores só podem criar transações, não editar/apagar; apenas

  administradores podem editar níveis de fidelidade e gerir staff

═══════════════════════════════════════

DESIGN

═══════════════════════════════════════

- Estilo moderno, elegante, alinhado com identidade de resort/hospitality de luxo

- Paleta de cores: tons terrosos/verdes tropicais (ligados à natureza/zoo da

  Villa das Palmeiras) combinados com dourado/bege para transmitir "cartão

  premium" — evitar visual "banco genérico"

- O saldo do cliente deve ser o elemento visualmente mais destacado no dashboard

- Badge do nível de fidelidade com ícone/cor distintiva por nível

- Totalmente responsivo — o painel do cliente será usado principalmente em

  telemóvel; o painel admin/staff será usado em tablet no balcão

- Idioma: Português (Moçambique/Europeu)

Começa pela estrutura de autenticação, as tabelas em Supabase e o dashboard

do cliente. Depois avançamos para o painel de staff/admin.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d7680240-6d40-4607-8582-6276c8b8d039).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
