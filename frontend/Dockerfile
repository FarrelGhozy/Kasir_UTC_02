# frontend/Dockerfile

FROM nginx:alpine

# 1. Hapus halaman default "Welcome to nginx" agar bersih
RUN rm -rf /usr/share/nginx/html/*

# 2. Copy isi folder 'public' langsung ke halaman utama
# (Asumsi: index.html, folder css, folder js, dan assets ada di dalam folder 'public')
COPY public /usr/share/nginx/html

# CATATAN:
# Jika folder 'js' dan 'css' Anda TERPISAH (ada di luar folder public),
# Anda perlu menambah baris copy manual seperti ini:
# COPY js /usr/share/nginx/html/js
# COPY css /usr/share/nginx/html/css

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]