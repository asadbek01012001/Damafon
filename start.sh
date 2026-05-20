#!/bin/bash
export HOST_IP=$(ip route get 1 | awk '{print $7; exit}')
echo "Starting with IP: $HOST_IP"
docker compose up -d
