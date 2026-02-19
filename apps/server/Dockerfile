# --- ESTÁGIO 1: BUILD ---
FROM node:20-alpine AS builder

WORKDIR /app

# 1. Copiar arquivos de definição de dependência
COPY package*.json ./
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/

# 2. Instalar dependências (Hoisting vai colocar tudo em /app/node_modules)
RUN npm ci

# 3. Copiar o código fonte do projeto inteiro
# (É mais seguro copiar tudo e deixar o .dockerignore filtrar o que não deve ir)
COPY . .

# 4. Gerar o Prisma Client (Isso cria arquivos dentro de node_modules na raiz)
RUN npx prisma generate --schema=apps/server/src/prisma/schema.prisma

# 5. Buildar a aplicação
RUN npm run build -w apps/server

# --- ESTÁGIO 2: PRODUÇÃO ---
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# 1. Copiar node_modules da raiz (Onde as deps realmente estão)
COPY --from=builder /app/node_modules ./node_modules

# 2. Copiar os artefatos de build (dist)
COPY --from=builder /app/apps/server/dist ./dist

# 3. Copiar packages/shared (caso seu dist referencie arquivos raw de lá, se for buildado não precisaria, mas por segurança mantemos)
COPY --from=builder /app/packages/shared ./packages/shared

# 4. Arquivos do Prisma para migrações em produção
COPY apps/server/src/prisma/schema.prisma ./prisma/schema.prisma
COPY apps/server/src/prisma/migrations ./prisma/migrations

# 5. Entrypoint
COPY apps/server/entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

EXPOSE 3000

CMD ["./entrypoint.sh"]