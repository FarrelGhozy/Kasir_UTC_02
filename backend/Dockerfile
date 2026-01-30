# Gunakan Node.js versi ringan
FROM node:18-alpine

# Buat folder kerja di dalam container
WORKDIR /app

# Copy file package.json dulu (biar cache efisien)
COPY package*.json ./

# Install library
RUN npm install

# Copy semua kode backend ke dalam container
COPY . .

# Buka port 5000
EXPOSE 5000

# Jalankan server
CMD ["node", "server.js"]