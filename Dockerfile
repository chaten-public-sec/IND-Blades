# Base image
FROM node:22

# Install Python
RUN apt-get update && \
    apt-get install -y python3 python3-pip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first (cache optimization)
COPY server/package*.json ./server/
COPY client/package*.json ./client/
COPY requirements.txt ./

# Install backend deps
WORKDIR /app/server
RUN npm install --production

# Install Python deps
WORKDIR /app
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Install frontend deps and build
WORKDIR /app/client
RUN npm install && npm run build

# Copy rest of files
WORKDIR /app
COPY . .

# Create required folders
RUN mkdir -p /app/data

# Expose port
EXPOSE 10000

# Start server (which starts bot)
CMD ["node", "server/server.js"]