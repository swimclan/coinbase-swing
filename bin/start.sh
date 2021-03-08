#!/bin/bash

docker stop coinbase-swing-node
docker stop coinbase-swing-nginx

docker rm coinbase-swing-node
docker rm coinbase-swing-nginx

docker build -f Dockerfile.nginx -t coinbase-swing-nginx:latest .
docker build -f Dockerfile.node -t coinbase-swing-node:latest .

docker run -d --name coinbase-swing-node -p 3333:3333 coinbase-swing-node:latest
docker run -d --name coinbase-swing-nginx -p 80:80 coinbase-swing-nginx:latest