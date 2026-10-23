FROM node:22.23.4-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .

# Variáveis passadas em build-time pelo docker-compose
ARG VITE_API_URL=http://localhost:8000
ARG VITE_WS_URL=ws://localhost:8000/ws
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

RUN npm run build

# ── Nginx para servir o build ─────────────────────────────────────────────────
FROM nginx:1.31.8-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
