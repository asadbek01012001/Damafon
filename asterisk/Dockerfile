FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    asterisk \
    asterisk-modules \
    asterisk-config \
    openssl \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY pjsip.conf /etc/asterisk/pjsip.conf
COPY extensions.conf /etc/asterisk/extensions.conf
COPY ari.conf /etc/asterisk/ari.conf
COPY http.conf /etc/asterisk/http.conf
COPY rtp.conf /etc/asterisk/rtp.conf
COPY modules.conf /etc/asterisk/modules.conf
COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

EXPOSE 5060/udp 5060/tcp 8088/tcp 10000-10200/udp

ENTRYPOINT ["/entrypoint.sh"]
