# Exploratory Analysis of Heterogeneous Data

Install Docker from https://docs.docker.com/get-docker/

Execute the following steps to run the dashboard.

```bash
cd VinetoWine
docker build -t vinetowine .
docker run -d --name vinetowine -p 8000:80 vinetowine
```
Open your web browser and go to http://localhost:8000 to see the app running.

Note: datasets have been removed for security reasons. The datasets should normally be placed under the '/data/' folder.