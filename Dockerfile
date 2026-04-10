FROM node:18-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production

COPY src/ src/

RUN mkdir -p output

ENTRYPOINT ["node", "src/main.js"]
