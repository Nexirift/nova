#!/usr/bin/env bash
# Use this script to start a docker container for a local development redis

# TO RUN ON WINDOWS:
# 1. Install WSL (Windows Subsystem for Linux) - https://learn.microsoft.com/en-us/windows/wsl/install
# 2. Install Docker Desktop for Windows - https://docs.docker.com/docker-for-windows/install/
# 3. Open WSL - `wsl`
# 4. Run this script - `./start-redis.sh`

# On Linux and macOS you can run this script directly - `./start-redis.sh`

REDIS_CONTAINER_NAME="nova-keydb"

if ! [ -x "$(command -v docker)" ]; then
  echo -e "Docker is not installed. Please install docker and try again.\nDocker install guide: https://docs.docker.com/engine/install/"
  exit 1
fi

if [ "$(docker ps -q -f name=$REDIS_CONTAINER_NAME)" ]; then
  echo "Redis container '$REDIS_CONTAINER_NAME' already running"
  exit 0
fi

if [ "$(docker ps -q -a -f name=$REDIS_CONTAINER_NAME)" ]; then
  docker start "$REDIS_CONTAINER_NAME"
  echo "Existing redis container '$REDIS_CONTAINER_NAME' started"
  exit 0
fi

# import env variables from .env
set -a
source .env

docker run -d \
  --name $REDIS_CONTAINER_NAME \
  -p 6379:6379 \
  docker.io/eqalpha/keydb && echo "Redis container '$REDIS_CONTAINER_NAME' was successfully created"
