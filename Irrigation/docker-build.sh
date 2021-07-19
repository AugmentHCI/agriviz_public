#!/bin/bash

docker build -t irrigation .
docker run -dit --name irrigation -p 3005:80  irrigation
