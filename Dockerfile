# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage using Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Nginx default configuration for SPA client routing
RUN printf 'server {\n    listen 8080;\n    server_name localhost;\n    location / {\n        root /usr/share/nginx/html;\n        index index.html;\n        try_files $uri $uri/ /index.html;\n    }\n}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
