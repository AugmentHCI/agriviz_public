#!/bin/bash

docker build -t leaf-counting .
docker run -dit --name leaf-counting -p 3006:80 leaf-counting
