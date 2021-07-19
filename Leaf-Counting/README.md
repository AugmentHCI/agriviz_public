# Analysis of Plant Growth

Install Docker from https://docs.docker.com/get-docker/

Execute the following steps to run the dashboard.

```bash
cd Leaf-Counting
docker build -t leafcount .
docker run -d --name leafcount -p 8000:80 leafcount 
```
Open your web browser and go to http://localhost:8000 to see the app running.

Note: datasets and images have been removed for security reasons. The datasets should normally be placed under the '/data/' folder and images under the '/images/' folder.