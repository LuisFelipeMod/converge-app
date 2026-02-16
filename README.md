# Realtime Collab

Plataforma de colaboração em tempo real (estilo Figma/Miro Lite) com canvas compartilhado, presence indicators e sincronização via CRDTs.

## Por que CRDTs em vez de Operational Transformation (OT)?

A escolha entre CRDTs e OT é uma decisão arquitetural fundamental em qualquer sistema colaborativo. Optamos por **CRDTs (Conflict-free Replicated Data Types)** — especificamente a biblioteca **Yjs** — pelos seguintes motivos:

### 1. Arquitetura descentralizada vs. servidor central obrigatório

OT exige um **servidor central que ordene as operações**. Cada edição precisa passar pelo servidor, ser transformada contra operações concorrentes, e só então ser aplicada. Isso cria um acoplamento forte: se o servidor cair ou atrasar, toda a colaboração trava.

CRDTs eliminam essa dependência. Cada cliente opera sobre sua cópia local do documento e as operações convergem automaticamente, independente da ordem em que chegam. No nosso projeto, o servidor atua como **relay e persistência**, não como autoridade de transformação — o que significa que ele pode ser stateless e horizontalmente escalável.

### 2. Convergência garantida por construção matemática

OT depende de **funções de transformação** corretas para cada par de tipos de operação. Na prática, isso é notoriamente difícil de implementar sem bugs — o Google Docs levou anos para estabilizar o OT deles, e o algoritmo do Jupiter (usado internamente) tem edge cases documentados.

CRDTs garantem convergência por **propriedade matemática** (comutatividade, associatividade, idempotência). Se dois usuários moverem o mesmo retângulo simultaneamente, o Yjs resolve deterministicamente sem precisar de lógica de transformação customizada. No nosso `collaboration.service.ts`, basta chamar `Y.applyUpdate()` — o merge é automático.

### 3. Suporte nativo a offline e latência alta

Com OT, um cliente offline acumula operações que precisam ser transformadas sequencialmente contra todas as operações que aconteceram no servidor durante a ausência. Isso é computacionalmente caro e pode gerar conflitos complexos.

CRDTs, por definição, permitem que **qualquer número de edições offline** sejam aplicadas e sincronizadas depois. O Yjs codifica o estado como um vetor de versão binário — quando o cliente reconecta, o sync protocol troca apenas os diffs necessários:

```
Cliente → SyncStep1 (meu state vector) → Servidor
Servidor → SyncStep2 (diff do que você não tem) → Cliente
```

Isso é exatamente o que implementamos no `collaboration.gateway.ts`.

### 4. Modelo de dados adequado para canvas

OT foi projetado originalmente para **texto sequencial** (inserir caractere na posição X, deletar range Y-Z). Adaptar OT para um canvas com objetos independentes (retângulos, círculos, cada um com posição, cor, tamanho) requer inventar operações de transformação para cada combinação de atributos — uma explosão combinatória.

CRDTs como `Y.Map` modelam isso naturalmente. Cada shape é uma entrada no mapa com um ID único. Edições concorrentes no mesmo atributo usam **last-writer-wins** por padrão, e edições em atributos diferentes não conflitam de forma alguma:

```typescript
// Dois usuários editando o mesmo shape simultaneamente:
// User A: move shape para x=100
// User B: muda fill para "#ff0000"
// Resultado: x=100 E fill="#ff0000" — sem conflito.
```

### 5. Persistência eficiente como binary state

O estado do Yjs é serializado como **binary updates compactos** (Uint8Array). Isso nos permite:

- Salvar updates incrementais no PostgreSQL (tabela `yjs_updates`, campo `Bytes`)
- Compactar N updates em 1 com `Y.mergeUpdates()` — nosso serviço faz isso automaticamente a cada 50 updates
- Restaurar o documento inteiro aplicando o merge de todos os updates — sem replay de operações

Com OT, a persistência exigiria salvar o log de operações completo ou snapshots periódicos com lógica de replay, significativamente mais complexo.

### 6. Ecossistema e maturidade do Yjs

O Yjs é a implementação CRDT mais madura do ecossistema JavaScript:

- ~13k stars no GitHub, usado em produção por Notion, Nimbus Note, entre outros
- Providers prontos para WebSocket, WebRTC, e IndexedDB
- Awareness protocol embutido (que usamos para os cursores/presence)
- Encoding binário extremamente eficiente (ordens de magnitude menor que JSON)

### Trade-offs que aceitamos

CRDTs não são perfeitos. Os principais trade-offs:

| Aspecto | CRDT (Yjs) | OT |
|---------|-----------|-----|
| **Memória** | Mantém metadados de tombstones (items deletados) | Mais enxuto após GC |
| **Intenção do usuário** | Last-writer-wins pode não capturar intenção complexa | Transformações podem preservar intenção melhor |
| **Complexidade conceitual** | O modelo matemático é mais difícil de entender | Mais intuitivo conceitualmente |

Para o nosso caso — um canvas com shapes independentes e edições majoritariamente não-conflitantes — os trade-offs dos CRDTs são negligíveis, enquanto os benefícios em simplicidade de implementação, robustez e escalabilidade são significativos.

## Tech Stack

- **Frontend:** Vue.js 3 (Composition API, TypeScript, Vite, Tailwind CSS)
- **Backend:** NestJS (TypeScript, WebSocket Gateway, Socket.io)
- **Sync:** Yjs (CRDTs) com sync protocol customizado
- **Persistência:** PostgreSQL (Prisma ORM) para documents e binary Yjs state
- **Cache/Pub-Sub:** Redis (preparado para scaling horizontal)

## Estrutura

```
realtime-collab/
├── apps/
│   ├── web/          # Frontend Vue.js 3
│   └── server/       # Backend NestJS
└── packages/
    └── shared/       # Tipos e constantes compartilhados
```

## Pré-requisitos

- **Node.js** >= 18
- **npm** >= 9 (usa workspaces)
- **Docker** e **Docker Compose** (para PostgreSQL e Redis)

## Setup

### 1. Clonar e instalar dependências

```bash
git clone <repo-url>
cd realtime-collab
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

O `.env` padrão já vem configurado para uso local:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/realtime_collab?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="change-me-in-production"
PORT=3000
```

### 3. Subir PostgreSQL e Redis com Docker

```bash
docker compose up -d
```

Isso inicia:
- **PostgreSQL 16** na porta `5432`
- **Redis 7** na porta `6379`

Para verificar se estão rodando:

```bash
docker compose ps
```

### 4. Rodar as migrations do banco de dados

```bash
# Gerar o Prisma Client
npm run prisma:generate -w apps/server

# Aplicar migrations (precisa do .env carregado)
cd apps/server
export $(cat ../../.env | xargs) && npx prisma migrate dev --schema=src/prisma/schema.prisma
cd ../..
```

### 5. Iniciar o projeto (modo desenvolvimento)

```bash
npm run dev
```

Isso inicia simultaneamente:
- **Backend NestJS** em http://localhost:3000
- **Frontend Vite + Vue** em http://localhost:5173

O frontend faz proxy automático das rotas `/api/*` e `/socket.io/*` para o backend.

### Scripts disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia server + web em modo dev |
| `npm run dev:server` | Inicia apenas o backend NestJS |
| `npm run dev:web` | Inicia apenas o frontend Vite |
| `npm run build:server` | Build de produção do backend |
| `npm run build:web` | Build de produção do frontend |
| `npm run prisma:studio -w apps/server` | Abre o Prisma Studio (GUI do banco) |

## Funcionalidades do Canvas

| Ação | Como usar |
|------|-----------|
| Criar retângulo | Selecionar tool **Rectangle**, arrastar no canvas |
| Criar círculo/elipse | Selecionar tool **Circle**, arrastar no canvas |
| Selecionar forma | Tool **Select**, clicar na forma |
| Mover forma | Tool **Select**, arrastar a forma selecionada |
| Apagar forma | Selecionar a forma + tecla **Delete** ou **Backspace** |
| Desfazer | **Ctrl+Z** (desfaz apenas ações locais) |
| Texto dentro de forma | **Duplo-clique** em uma forma → digitar → **Enter** para confirmar |
| Texto solto | Selecionar tool **Text**, clicar no canvas → digitar → **Enter** |
| Cursores remotos | Automático — outros usuários veem seu cursor em tempo real |
