FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl

RUN apk add --no-cache openssl

# Install dependencies first (cached layer)
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Copy source and build
COPY . .
RUN npx prisma generate
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

# Push schema and start app
CMD ["sh", "-c", "npx prisma db push && npm start"]
