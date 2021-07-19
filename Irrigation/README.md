# Analysis of Water Stress and Irrigation Requirements

Install Docker from https://docs.docker.com/get-docker/

Execute the following steps to run the dashboard.

```bash
git clone https://github.com/AugmentHCI/Irrigation.git
cd Irrigation
docker build -t irrigation .
docker run -d --name irrigation -p 8000:80 irrigation 
```
Open your web browser and go to http://localhost:8000 to see the app running.
