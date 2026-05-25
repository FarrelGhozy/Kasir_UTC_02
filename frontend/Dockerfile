# frontend/Dockerfile
FROM nginx:1.25-alpine

# Security headers
RUN echo 'server {\
  listen 80;\
  server_name _;\
  root /usr/share/nginx/html;\
  index index.html;\
  add_header X-Frame-Options "SAMEORIGIN" always;\
  add_header X-Content-Type-Options "nosniff" always;\
  add_header X-XSS-Protection "1; mode=block" always;\
  location / {\
    try_files $uri $uri/ /index.html;\
  }\
  location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|webp|woff2?)$ {\
    expires 30d;\
    add_header Cache-Control "public, immutable";\
  }\
}' > /etc/nginx/conf.d/default.conf

COPY public /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]