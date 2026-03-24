FROM node:22-bookworm

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-pip bash && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

COPY server/package*.json ./server/
RUN npm install --prefix server --omit=dev

COPY client/package*.json ./client/
RUN npm install --prefix client

COPY . .

RUN npm run build --prefix client
RUN mkdir -p /app/data

EXPOSE 3001

CMD ["bash", "/app/docker/start.sh"]
