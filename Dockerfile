FROM hoosin/alpine-nginx-nodejs:latest

ENV NGINX_STATIC /usr/share/nginx/html/
ENV NGINX_CONF /etc/nginx/

RUN apk update && apk add bash

WORKDIR /opt/app/coinbase-swing
RUN mkdir logs

# Stream the nginx logs to stdout and stderr
RUN ln -sf /dev/stdout logs/access.log && \
    ln -sf /dev/stderr logs/error.log

EXPOSE 80

COPY nginx/ /etc/nginx
COPY . .

RUN npm i

RUN nginx -t

CMD ["nginx", "&", "node", "server.js"]

