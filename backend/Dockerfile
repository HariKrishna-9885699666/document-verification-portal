FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 4000
CMD ["node", "dist/main"]
