FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3999
ENV PORT=3999
ENV NODE_ENV=production

CMD ["node", "server.js"]
