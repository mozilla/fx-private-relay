# See https://discuss.circleci.com/t/docker-build-fails-with-nonsensical-eperm-operation-not-permitted-copyfile/37364/12 for the .8 version pin:
FROM node:14.8 AS builder
WORKDIR /app

COPY privaterelay/locales ./privaterelay/locales/
COPY package*.json ./
COPY static ./static/
RUN npm install @mozilla-protocol/core@14.0.3
RUN mkdir --parents /static/scss/libs/protocol/
RUN mv node_modules/@mozilla-protocol/core/protocol /static/scss/libs/

COPY react-ui ./react-ui/
WORKDIR /app/react-ui
RUN npm install
RUN npm run build -- --outdir=out

FROM python:3.7.9

WORKDIR /app
RUN apt-get update && apt-get install -y libpq-dev
RUN pip install --upgrade pip

RUN groupadd --gid 10001 app && \
    useradd -g app --uid 10001 --shell /usr/sbin/nologin --create-home --home-dir /app app

WORKDIR /app

EXPOSE 8000

USER app
COPY --from=builder --chown=app /app/static ./static

COPY --chown=app ./requirements.txt /app/requirements.txt
RUN pip install -r requirements.txt
COPY --chown=app . /app
COPY --chown=app .env-dist /app/.env

RUN mkdir -p /app/staticfiles
RUN python manage.py collectstatic --no-input -v 2

ENTRYPOINT ["/app/.local/bin/gunicorn"]

CMD ["--config", "gunicorn.conf", "privaterelay.wsgi:application"]
