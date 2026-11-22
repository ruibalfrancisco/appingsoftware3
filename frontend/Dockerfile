# Etapa 1: construir el build estático de Vite.
FROM node:26-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Vite incrusta estas variables al construir. Railway pasa las variables del
# servicio como build args solo si están declaradas con ARG.
ARG VITE_API_URL
ARG VITE_GOOGLE_MAPS_API_KEY
ARG VITE_GOOGLE_MAPS_MAP_ID
ENV VITE_API_URL=$VITE_API_URL \
    VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY \
    VITE_GOOGLE_MAPS_MAP_ID=$VITE_GOOGLE_MAPS_MAP_ID

RUN npm run build

# Etapa 2: servir los archivos con nginx.
FROM nginx:1.31-alpine
# La imagen oficial reemplaza ${PORT} en las plantillas al arrancar.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV PORT=8080
EXPOSE 8080
