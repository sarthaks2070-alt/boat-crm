FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY db.js ./
COPY ai-engine.js ./
COPY server.js ./
COPY public ./public

ENV PORT=3000
EXPOSE 3000

CMD ["node", "--experimental-sqlite", "server.js"]
