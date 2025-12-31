# Stage 1: Build Frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Production Backend
FROM node:22-alpine
WORKDIR /app

# Copy backend manifest
# Cache buster: 2024-12-31-eva-llm
COPY backend/package*.json ./

RUN npm install --production

# Copy backend code
COPY backend/ .

# Copy built frontend from Stage 1 to 'public' folder which server.js expects
COPY --from=frontend-build /app/dist ./public

EXPOSE 3000

CMD ["node", "docker-entrypoint.js"]
