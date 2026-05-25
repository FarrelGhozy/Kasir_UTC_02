# frontend/Dockerfile
FROM nginx:1.25-alpine

# Build time variables (set via --build-arg or docker compose build.args)
ARG API_PROXY_PASS=http://backend:5000

# Security headers with API reverse proxy
RUN echo 'server {\
  listen 80;\
  server_name _;\
  root /usr/share/nginx/html;\
  index index.html;\
  add_header X-Frame-Options "SAMEORIGIN" always;\
  add_header X-Content-Type-Options "nosniff" always;\
  add_header X-XSS-Protection "1; mode=block" always;\
  location ^~ /api/ {\
    proxy_pass '"$API_PROXY_PASS"';\
    proxy_http_version 1.1;\
    proxy_set_header Upgrade $http_upgrade;\
    proxy_set_header Connection "upgrade";\
    proxy_set_header Host $host;\
    proxy_set_header X-Real-IP $remote_addr;\
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
    proxy_set_header X-Forwarded-Proto $scheme;\
    proxy_read_timeout 60s;\
    proxy_send_timeout 60s;\
  }\
  location /backend/uploads/services/ {\
    proxy_pass '"$API_PROXY_PASS"';\
    proxy_set_header Host $host;\
    proxy_set_header X-Real-IP $remote_addr;\
  }\
  location / {\
    try_files $uri $uri/ /index.html;\
  }\
  location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|webp|woff2?)$ {\
    expires 1d;\
    add_header Cache-Control "public, must-revalidate";\
  }\
}' > /etc/nginx/conf.d/default.conf

COPY public /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]