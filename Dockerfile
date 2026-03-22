# Base image
FROM node:22

# Install Python
RUN apt-get update && \
    apt-get install -y python3 python3-pip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy all files first
COPY . .

# Install Python deps
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Install backend deps
WORKDIR /app/server
RUN npm install --production

# Install frontend deps and build
WORKDIR /app/client
RUN npm install && npm run build

# Create required folders
WORKDIR /app
RUN mkdir -p /app/data

# Expose port
EXPOSE 10000

# Start server (which starts bot)
CMD ["node", "server/server.js"]
