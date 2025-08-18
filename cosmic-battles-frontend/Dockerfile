# Stage 1: dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# Stage 2: development image (vite dev server)
FROM node:20-alpine AS dev
WORKDIR /app
ENV NODE_ENV=development
# Useful to silence vite telemetry in CI/containers
ENV CI=true
# Set default port for Vite and preview via env
ENV PORT=5173
ENV PREVIEW_PORT=4173

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Expose the Vite dev server port; overridable at runtime
EXPOSE 5173 4173

# Allow overriding port and host from docker-compose or docker run
CMD ["npm", "run", "dev"]
