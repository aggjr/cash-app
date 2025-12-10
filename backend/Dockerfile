FROM node:18-alpine

WORKDIR /app

# Install dependencies needed for some native modules if any (optional but good practice)
# RUN apk add --no-cache python3 make g++

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 3001

# Copy a startup script
COPY docker-entrypoint.js /app/docker-entrypoint.js

CMD ["node", "docker-entrypoint.js"]
