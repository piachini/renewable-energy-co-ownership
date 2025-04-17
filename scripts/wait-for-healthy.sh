#!/bin/bash

# Script per verificare lo stato di salute dei servizi
# Utilizzo: ./wait-for-healthy.sh <url>

set -e

URL=$1
MAX_RETRIES=30
RETRY_INTERVAL=10

echo "Waiting for service to be healthy at $URL..."

for i in $(seq 1 $MAX_RETRIES); do
    if curl -s -f $URL/health > /dev/null; then
        echo "Service is healthy!"
        exit 0
    fi
    
    echo "Attempt $i/$MAX_RETRIES: Service not ready, waiting $RETRY_INTERVAL seconds..."
    sleep $RETRY_INTERVAL
done

echo "Service failed to become healthy after $MAX_RETRIES attempts"
exit 1 