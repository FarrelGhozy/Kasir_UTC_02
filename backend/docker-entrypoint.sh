#!/bin/sh
set -e

# Buat folder uploads dengan permission yang benar (volume mount mungkin override ownership)
mkdir -p /app/uploads/services /app/uploads/items
chmod -R 777 /app/uploads

# Jalankan aplikasi sebagai appuser
exec su-exec appuser node server.js
