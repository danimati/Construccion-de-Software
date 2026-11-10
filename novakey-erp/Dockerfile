# Requiere compilar antes: npm run build
FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/novakey-erp/browser/ /usr/share/nginx/html/
