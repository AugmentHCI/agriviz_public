# Correlation Analysis of Multivariate Data (GaCoVi)

Install Docker from https://docs.docker.com/get-docker/

Execute the following steps to run the dashboard.

```bash
cd gacovi
docker build -t gacovi .
docker run -d --name gacovi -p 8000:80  gacovi
```

Open your web browser and go to http://localhost:8000 to see the app running.
