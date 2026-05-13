# Schedule Hairdresser

App de gestão de marcações para cabeleireiros (versão **MVP solo**, tablet-first).

> Esta é a primeira versão funcional. Tem calendário, clientes, serviços, lembretes WhatsApp (mock + Twilio), lista de espera com mensagens em cascata, aniversários, e definições.

---

## ✅ Pré-requisitos

- **Node.js 18+** instalado ([download](https://nodejs.org)). Confirma com `node --version`.
- **NPM** (vem com Node).
- Um terminal (PowerShell, Command Prompt, Git Bash...).

> Não precisas de base de dados, conta Twilio, conta Stripe, nem de mais nada para arrancar. Tudo corre localmente.

---

## 🚀 Instalação (primeira vez)

1. **Extrai** o ZIP para `D:\ScheduleHairdresser` (ou qualquer outra pasta que prefiras).

2. **Abre um terminal** nessa pasta. No Windows: navega até `D:\ScheduleHairdresser` no Explorador, clica com o botão direito → "Abrir no Terminal".

3. **Corre o setup** (instala dependências, cria base de dados, semeia dados de exemplo):

   ```bash
   npm run setup
   ```

   Isto faz tudo numa só linha: `npm install` + `prisma generate` + `prisma db push` + seed.
   Demora 1-2 minutos.

4. **Arranca o servidor**:

   ```bash
   npm run dev
   ```

5. **Abre** [http://localhost:3000](http://localhost:3000) no browser.

✨ **Vais ver o calendário com 4 marcações de hoje** (Maria, João, António, Cláudia), 3 entradas em lista de espera, e um aniversário (Sofia).

---

## 🧪 Como testar tudo

### Testar o calendário e marcações

- **Click numa marcação** → abre o detalhe; podes marcar como concluída, "não veio", enviar lembrete, ou cancelar.
- **Click num espaço vazio** entre marcações → cria nova marcação naquele horário (com snap a 15 min).
- **Faixa amarela "Almoço"** entre 12:30 e 14:00 → é uma indicação visual; podes na mesma marcar serviços por cima clicando lá.
- **Linha vermelha** mostra a hora atual em tempo real.
- **Setas no topo** para mudar de dia. Botão "Hoje" para voltar.

### Testar mensagens WhatsApp em modo MOCK (default)

Em modo mock, **as mensagens não saem para o WhatsApp real** — ficam guardadas em `/mensagens` para tu veres. Não precisas de qualquer conta nem credencial.

Experimenta:

1. **Lembrete de marcação**: Click numa marcação → "Enviar lembrete" → vai a `/mensagens` e vê a mensagem que seria enviada.
2. **Parabéns de aniversário**: No painel direito do calendário, cartão "Aniversário" → click "Enviar parabéns" → vai a `/mensagens`.
3. **Cascata da lista de espera** (o caso mais interessante):
   - Click na marcação do **António Costa** (14:30, pendente).
   - Click em "**Cancelar e notificar fila**".
   - Vais ver os clientes da lista de espera elegíveis para aquele slot. Por defeito todos pré-selecionados.
   - Click "Cancelar e notificar (X)".
   - Vai a `/mensagens` → vê a mensagem da oferta enviada ao primeiro da fila.
   - Vai a `/lista-espera` → vês a cascata em curso. Tem botões para testar manualmente sem ter de esperar o timer:
     - **"Forçar avanço (teste)"** → simula expiração do tempo do primeiro e envia ao seguinte.
     - **"Sim"** → simula a resposta SIM do cliente; cria a marcação e envia confirmação.
     - **"Não"** → simula recusa; passa ao seguinte.

> O tempo de espera entre clientes da cascata é configurável em `/definicoes` (default: 30 minutos).

### Testar mensagens WhatsApp em modo REAL (Twilio)

Quando estiveres pronto para enviar mensagens a sério:

1. **Cria conta Twilio** em [twilio.com/try-twilio](https://www.twilio.com/try-twilio) (tem $15 de crédito grátis).

2. **Ativa o WhatsApp Sandbox** em Console Twilio → Messaging → Try it out → Send a WhatsApp message. Segue as instruções para juntar-te ao sandbox enviando uma mensagem do teu WhatsApp para o número que te dão (ex: `+1 415 523 8886`).

3. **Copia as credenciais** do dashboard Twilio:
   - `Account SID`
   - `Auth Token`
   - O número WhatsApp Sandbox (formato `whatsapp:+14155238886`)

4. **Edita o ficheiro `.env`** na raiz do projeto:

   ```bash
   WHATSAPP_MODE="real"
   TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
   TWILIO_AUTH_TOKEN="o_teu_auth_token_aqui"
   TWILIO_WHATSAPP_FROM="whatsapp:+14155238886"
   ```

5. **Reinicia o servidor** (`Ctrl+C` no terminal, depois `npm run dev` outra vez).

6. **Importante para o sandbox Twilio**: só consegues enviar mensagens para números que se juntaram previamente ao teu sandbox. Para clientes reais, vais precisar de validar um número WhatsApp Business com a Meta (processo de produção do Twilio). Para testes, junta o teu próprio número ao sandbox.

7. **Os números dos clientes no seed** começam com `+351912345xxx` — números fictícios. Edita um cliente em `/clientes` e mete o teu número real (com indicativo, ex: `+351911234567`) para testar.

Depois quando enviares um lembrete ou parabéns, vais receber a mensagem no teu WhatsApp.

> **Nota:** mesmo em modo real, todas as mensagens ficam registadas em `/mensagens` com o estado (`Enviada` / `Falhou`).

---

## 📁 Estrutura do projeto

```
ScheduleHairdresser/
├── prisma/
│   ├── schema.prisma         # Modelo da base de dados
│   ├── seed.ts               # Dados de exemplo
│   └── dev.db                # Base de dados SQLite (criada após setup)
├── src/
│   ├── app/
│   │   ├── api/              # Endpoints REST (backend)
│   │   ├── calendario/       # Página do calendário
│   │   ├── clientes/         # Página de clientes
│   │   ├── servicos/         # Página de serviços
│   │   ├── lista-espera/     # Página da lista de espera
│   │   ├── mensagens/        # Log de mensagens enviadas
│   │   ├── estatisticas/     # Estatísticas
│   │   ├── definicoes/       # Configurações
│   │   ├── layout.tsx        # Layout principal
│   │   ├── page.tsx          # Redirect para /calendario
│   │   └── globals.css       # Estilos globais (Tailwind)
│   ├── components/
│   │   ├── calendar/         # Componentes do calendário
│   │   ├── layout/           # Sidebar
│   │   └── ui/               # Botão, Modal genéricos
│   └── lib/
│       ├── db.ts             # Cliente Prisma
│       ├── whatsapp.ts       # Serviço de envio (mock + Twilio)
│       ├── cascade.ts        # Lógica da cascata da lista de espera
│       └── utils.ts          # Helpers
├── .env                      # Variáveis de ambiente (NÃO comites)
├── .env.example              # Modelo
├── package.json              # Dependências
└── README.md
```

**Frontend** = Next.js 15 + React 19 + Tailwind CSS + Lucide icons
**Backend** = Next.js API routes (no mesmo projeto)
**Base de dados** = SQLite via Prisma (ficheiro local `prisma/dev.db`)

---

## 🛠 Comandos úteis

| Comando             | O que faz                                                  |
| ------------------- | ---------------------------------------------------------- |
| `npm run dev`       | Arranca em modo desenvolvimento (com hot-reload)           |
| `npm run build`     | Compila para produção                                      |
| `npm run start`     | Arranca a versão de produção (depois de `build`)           |
| `npm run db:reset`  | Apaga e recria a BD com dados de exemplo (cuidado, perdes-tudo) |
| `npm run db:seed`   | Volta a inserir os dados de exemplo                        |

---

## ⚙️ Configurações

Tudo em `/definicoes` na app:

- **Nome do salão** (aparece nas mensagens)
- **Horário de trabalho** (controla a vista do calendário)
- **Pausa de almoço** (faixa visual, marcações continuam permitidas)
- **Tempo de espera da cascata** (default: 30 min)
- **Antecedência dos lembretes** (default: 24 h)

---

## ❌ O que **NÃO** está incluído ainda (próxima iteração)

- **Multi-utilizador / multi-salão** (ainda é single-tenant; cada instalação é um salão)
- **Autenticação** (qualquer pessoa que abrir `localhost:3000` entra)
- **Stripe / subscrições** (a parte de cobrar aos cabeleireiros que vão usar o SaaS)
- **Vista semanal** (só vista dia por agora)
- **Drag-and-drop** para mover marcações
- **Lembretes automáticos agendados** (precisa de um cron / worker para correr em fundo; agora os lembretes são manuais ou via cascata)
- **Estatísticas avançadas** (gráficos, séries temporais)
- **Faturação AT** (deliberadamente fora do MVP)

A app está estruturada para que estas features sejam adicionadas sem grandes reescritas.

---

## ❓ Resolução de problemas

**`prisma not found` ou erros do Prisma ao correr `npm run setup`:**
Corre os passos manualmente:
```bash
npm install
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
```

**Porto 3000 ocupado:**
```bash
npm run dev -- -p 3001
```
E abre `http://localhost:3001`.

**Quero apagar tudo e começar do zero:**
```bash
npm run db:reset
```

**A página de mensagens está vazia:**
Ainda não enviaste nenhuma. Vai ao calendário, clica numa marcação, "Enviar lembrete".

**Mensagem em modo real falha:**
Vê em `/mensagens` o erro reportado. Os erros mais comuns são:
- Sandbox Twilio: o número de destino não está registado no sandbox (envia primeiro a frase de junção do teu WhatsApp)
- Credenciais erradas no `.env`
- Esqueceste-te de reiniciar `npm run dev` depois de alterar `.env`

---

Bom uso! 🪒
