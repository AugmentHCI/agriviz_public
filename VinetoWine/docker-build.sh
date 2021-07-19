#!/bin/bash

docker build -t vine-wine .
docker run -dit --name vine-wine -p 3007:80 vine-wine
