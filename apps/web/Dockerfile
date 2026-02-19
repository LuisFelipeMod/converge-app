FROM node:20-alpine AS builder

WORKDIR /app

# 1. Copiar package.json e lockfiles
COPY package*.json ./

# 2. [CORREÇÃO] Copiar as configs do TypeScript da raiz
# O erro acontece porque o pacote 'shared' procura esse arquivo e não acha
COPY tsconfig*.json ./

# 3. Copiar package.json dos workspaces
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

# 4. Instalar dependências
RUN npm ci

# 5. Copiar o código fonte (shared e web)
COPY packages/shared packages/shared
COPY apps/web apps/web

# 6. Buildar o web
# (O Vite vai conseguir resolver o extends do tsconfig agora)
RUN npm run build -w apps/web

# --- ESTÁGIO 2: Nginx (ou Node serve) ---
FROM nginx:alpine

# Copiar o build estático para o Nginx
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Opcional: Copiar config customizada do Nginx se tiver
# COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]