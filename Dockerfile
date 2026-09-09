# syntax=docker/dockerfile:1
FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

# Install production dependencies first for better layer caching.
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the rest of the application.
COPY . .

# Drop root: the base image ships an unprivileged `node` user. Running as it
# limits what a compromised process can touch. Files copied above are owned by
# root but world-readable, which is all the app needs.
USER node

EXPOSE 3000

# Basic container healthcheck hitting the app's own endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
