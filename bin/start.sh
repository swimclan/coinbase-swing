#!/bin/bash

echo Disconnecting from network...
docker network disconnect swing-net coinbase-swing-node
docker network disconnect swing-net coinbase-swing-nginx

echo Removing network...
docker network rm swing-net

echo Creating network...
docker network create --driver bridge swing-net

echo Stopping containers...
docker stop coinbase-swing-node
docker stop coinbase-swing-nginx

echo Removing containers...
docker rm coinbase-swing-node
docker rm coinbase-swing-nginx

echo Removing images...
docker rmi coinbase-swing-nginx:latest
docker rmi coinbase-swing-node:latest

echo Building images...
docker build -f Dockerfile.nginx -t coinbase-swing-nginx:latest .
docker build -f Dockerfile.node -t coinbase-swing-node:latest .

echo Running containers
docker run -d --name coinbase-swing-node --network swing-net -p 3333:3333 coinbase-swing-node:latest
docker run -d --name coinbase-swing-nginx --network swing-net -p 80:80 -p 443:443 coinbase-swing-nginx:latest

# echo Connecting to network...
# docker network connect coinbase-swing-node swing-net
# docker network connect coinbase-swing-nginx swing-net