# Build multi-etapa: compila con Node y sirve los estáticos con Nginx.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.29-alpine
# Certificado autofirmado para la demostración (HTTPS). En producción se montan certificados
# reales en /etc/nginx/certs. openssl viene en la imagen base de nginx:alpine.
RUN mkdir -p /etc/nginx/certs && \
    openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
        -keyout /etc/nginx/certs/novakey.key \
        -out /etc/nginx/certs/novakey.crt \
        -subj "/C=CO/O=NovaKey/CN=localhost"
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/
EXPOSE 80 443
