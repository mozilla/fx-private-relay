FROM python:3.7.6

RUN apt-get update && apt-get -y install libpq-dev
RUN pip install --upgrade pip

RUN groupadd --gid 10001 app && \
    useradd -g app --uid 10001 --shell /usr/sbin/nologin --create-home --home-dir /app app

WORKDIR /app

EXPOSE 8000

USER app

COPY . /app
COPY .env-dist /app/.env

RUN pip install -r requirements.txt

RUN mkdir -p /app/staticfiles
RUN python manage.py collectstatic

ENTRYPOINT ["/app/.local/bin/gunicorn"]

CMD ["--config", "gunicorn.conf", "privaterelay.wsgi:application"]
