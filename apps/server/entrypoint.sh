#!/bin/sh

# O 'set -e' faz o script parar em qualquer erro. 
# Vamos desativá-lo temporariamente para a migração.
set +e

echo "--- Iniciando Deploy de Migrações ---"

# Tenta rodar a migração
npx prisma migrate deploy --schema=./prisma/schema.prisma
MIGRATE_STATUS=$?

if [ $MIGRATE_STATUS -ne 0 ]; then
  echo "⚠️ AVISO: Prisma migrate falhou (Código: $MIGRATE_STATUS)."
  echo "Verifique se há migrações travadas (P3009) ou erro de Lock."
  echo "Tentando subir a aplicação mesmo assim..."
else
  echo "✅ Migrações aplicadas com sucesso."
fi

# Reativa o 'set -e' para o processo principal
set -e

echo "--- Iniciando Servidor Nest.js ---"
exec node dist/main.js