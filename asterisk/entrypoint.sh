#!/bin/bash
set -e

CERT_DIR=/etc/asterisk/keys

mkdir -p "$CERT_DIR"

if [ ! -f "$CERT_DIR/asterisk.pem" ]; then
    echo "Generating self-signed TLS certificate for WebRTC..."
    openssl req -new -newkey rsa:2048 -days 3650 -nodes -x509 \
        -subj "/C=UZ/ST=Tashkent/L=Tashkent/O=Damafon/CN=asterisk.local" \
        -keyout "$CERT_DIR/asterisk.key" \
        -out "$CERT_DIR/asterisk.crt"
    cat "$CERT_DIR/asterisk.key" "$CERT_DIR/asterisk.crt" > "$CERT_DIR/asterisk.pem"
    echo "Certificate generated."
fi

exec asterisk -f -vvv
