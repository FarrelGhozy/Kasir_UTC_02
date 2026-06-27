#!/bin/sh
set -e

# Buat folder uploads & backups dengan permission yang benar (volume mount mungkin override ownership)
mkdir -p /app/uploads/services /app/uploads/items /app/uploads/notas /app/backups
chmod -R 777 /app/uploads
chmod -R 777 /app/backups

# Jalankan aplikasi sebagai appuser
exec su-exec appuser node server.js
