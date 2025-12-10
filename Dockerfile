# Stage 1: Build Frontend
FROM node:18-alpine AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Setup Backend & Runtime
FROM node:18-alpine
WORKDIR /app

# Setup Backend
# Create backend directory and move into it
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --production
COPY backend/ .

# Setup Frontend Assets
# Copy dist from stage 1 to /app/dist (which is ../dist relative to /app/backend)
COPY --from=frontend-build /app/dist ../dist

# Environment Configuration
ENV NODE_ENV=production
ENV PORT=3000

# Expose the port
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
