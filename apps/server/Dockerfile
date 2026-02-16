FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace=apps/server --workspace=packages/shared
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN npm run build -w packages/shared
RUN npx prisma generate --schema=apps/server/src/prisma/schema.prisma
RUN npm run build -w apps/server

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/node_modules ./apps/server/node_modules 2>/dev/null || true
COPY --from=builder /app/packages/shared ./packages/shared
COPY apps/server/src/prisma/schema.prisma ./prisma/schema.prisma
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/main.js"]
