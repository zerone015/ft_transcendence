FROM node:lts-alpine3.17 AS builder

RUN apk update && \
    apk upgrade

WORKDIR /app

COPY frontend .

RUN npm install && \
    npm run build

FROM nginx:stable-alpine3.17

EXPOSE 80 443

RUN apk update && \
    apk upgrade && \
    apk add openssl && \
    mkdir -p /etc/nginx/tls && \
    openssl req -new -newkey rsa:4096 -x509 -sha256 -days 365 -nodes -out /etc/nginx/tls/6uidpong.com.crt -keyout /etc/nginx/tls/6uidpong.com.key -subj "/C=KR/ST=Seoul/L=Gaepo-dong/O=42/OU=42Seoul/CN=6uidpong.com"

COPY conf/nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder app/build /usr/share/nginx/html
