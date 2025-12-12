FROM node:22-alpine

WORKDIR /app

# Copy backend manifest
COPY backend/package*.json ./

RUN npm install --production

# Copy backend code
COPY backend/ .

EXPOSE 3000

# Copy startup script (it's in backend/ already, so it's copied by above)
# But verify path if needed.
# backend/docker-entrypoint.js is now at /app/docker-entrypoint.js

CMD ["node", "docker-entrypoint.js"]
