# See https://discuss.circleci.com/t/docker-build-fails-with-nonsensical-eperm-operation-not-permitted-copyfile/37364/12 for the .8 version pin:
FROM node:14.8 AS builder

RUN groupadd --gid 10001 app && \
    useradd -g app --uid 10001 --shell /usr/sbin/nologin --create-home --home-dir /app app
USER app

WORKDIR /app

RUN whoami
RUN ls -ltr /app
RUN ls -ltr /
COPY --chown=app privaterelay/locales ./privaterelay/locales/
COPY --chown=app package*.json ./
COPY --chown=app static ./static/
RUN npm install @mozilla-protocol/core@14.0.3
RUN mkdir --parents /app/static/scss/libs/protocol/
RUN mv node_modules/@mozilla-protocol/core/protocol /app/static/scss/libs/

COPY --chown=app react-ui ./react-ui/
WORKDIR /app/react-ui
RUN npm install
RUN npm run build -- --outdir=out

FROM python:3.7.9

WORKDIR /app
RUN apt-get update && apt-get install -y libpq-dev
RUN pip install --upgrade pip

WORKDIR /app

EXPOSE 8000

COPY --from=builder --chown=app /app/static ./static

COPY --chown=app ./requirements.txt /app/requirements.txt
RUN pip install -r requirements.txt
COPY --chown=app . /app
COPY --chown=app .env-dist /app/.env

RUN mkdir -p /app/staticfiles
RUN python manage.py collectstatic --no-input -v 2

ENTRYPOINT ["/app/.local/bin/gunicorn"]

CMD ["--config", "gunicorn.conf", "privaterelay.wsgi:application"]
