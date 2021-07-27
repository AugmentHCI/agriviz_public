# Analysis of Biological Efficacy in By-Products

Install Docker from https://docs.docker.com/get-docker/

Execute the following steps to run the dashboard.

```bash
cd biological-efficacy
docker build -t biological-efficacy .
docker run -d --name biological-efficacy -p 8000:80 biological-efficacy
```
Open your web browser and go to http://localhost:8000 to see the app running.
