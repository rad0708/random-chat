FROM node:18
WORKDIR /app
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm install
WORKDIR /app
COPY client/package*.json ./client/
WORKDIR /app/client
RUN npm install && npm run build
WORKDIR /app/server
COPY server .
CMD ["node", "index.js"]
