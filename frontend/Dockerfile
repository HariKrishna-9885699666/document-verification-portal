FROM node:22-alpine

ARG API_URL
ENV API_URL=${API_URL}

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
