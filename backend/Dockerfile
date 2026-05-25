# Gunakan Node.js LTS terbaru
FROM node:20-alpine

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Install su-exec untuk switch user di entrypoint
RUN apk add --no-cache su-exec

WORKDIR /app

# Copy package files dulu (efisien untuk Docker layer cache)
COPY package*.json ./

# Install production dependencies saja
RUN npm ci --only=production && npm cache clean --force

# Copy kode backend
COPY . .

# Hapus file yang tidak perlu di production
RUN rm -f test_*.js *.log

RUN chown -R appuser:appgroup /app

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/auth/login || exit 1

# Entrypoint: fix permission folder uploads lalu switch ke appuser
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["docker-entrypoint.sh"]

# Seed dijalankan TERPISAH via docker compose run backend npm run seed
CMD ["node", "server.js"]