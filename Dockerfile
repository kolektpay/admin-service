# Build stage
FROM node:22-alpine AS builder

# Add system dependencies for Prisma
RUN apk add --no-cache openssl libc6-compat

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Fix: Remove stale lock file and use npm install to sync
RUN rm -f package-lock.json && \
    npm install --network-timeout=100000 --network-retries=5

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Prune devDependencies to keep the production image small
# This happens in the builder stage to avoid another network call in the runner
RUN npm prune --omit=dev

# Production stage
FROM node:22-alpine

# Add system dependencies for Prisma
RUN apk add --no-cache openssl libc6-compat

WORKDIR /usr/src/app

# Copy only the necessary files from the builder
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma

# Create a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /usr/src/app
USER appuser

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]