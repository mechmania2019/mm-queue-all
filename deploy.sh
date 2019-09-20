#!/bin/bash

docker build . -t gcr.io/mechmania2017/queue-all:latest
docker push gcr.io/mechmania2017/queue-all:latest
kubectl apply -f app.yaml
kubectl delete pods -l app=queue-all