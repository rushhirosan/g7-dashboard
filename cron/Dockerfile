FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends cron \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
COPY crontab /etc/cron.d/g7-news
RUN chmod 0644 /etc/cron.d/g7-news && crontab /etc/cron.d/g7-news

# Forward cron logs to Docker stdout
RUN touch /var/log/g7-news.log

CMD cron && tail -f /var/log/g7-news.log
