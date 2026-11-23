# Etapa 1: construir el build estático de Vite.
FROM node:26-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Vite incrusta estas variables al construir. Railway pasa las variables del
# servicio como build args solo si están declaradas con ARG.
ARG VITE_GOOGLE_MAPS_API_KEY
ARG VITE_GOOGLE_MAPS_MAP_ID
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY \
    VITE_GOOGLE_MAPS_MAP_ID=$VITE_GOOGLE_MAPS_MAP_ID

RUN npm run build

# Etapa 2: servir los archivos y hacer de proxy hacia la API con nginx.
FROM nginx:1.30-alpine
# La imagen oficial reemplaza ${VARIABLES} en las plantillas al arrancar.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY nginx-seguridad.conf /etc/nginx/snippets/seguridad.conf
COPY --from=build /app/dist /usr/share/nginx/html

# PORT lo define Railway. API_INTERNAL_URL apunta a la API por la red privada, por ejemplo
# http://api.railway.internal:8080 (en Railway es una referencia a las variables de api).
ENV PORT=8080 \
    API_INTERNAL_URL=http://localhost:8000 \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
EXPOSE 8080
