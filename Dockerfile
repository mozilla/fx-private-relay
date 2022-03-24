# TODO: Remove until next FROM once we've transitioned to the React-based website
FROM node:14 AS gulp-builder
WORKDIR /app
COPY package*.json ./
COPY gulpfile.js ./
COPY .eslint* ./
COPY .stylelintrc.json ./
COPY static ./static/
RUN npm install
RUN ./node_modules/.bin/gulp build
RUN npm run lint:js -- --max-warnings=0
RUN npm run lint:css

FROM python:3.9.10-alpine

ARG CIRCLE_BRANCH
ARG CIRCLE_SHA1
ARG CIRCLE_TAG
ENV CIRCLE_BRANCH=${CIRCLE_BRANCH:-unknown} \
    CIRCLE_TAG=${CIRCLE_TAG:-unknown} \
    CIRCLE_SHA1=${CIRCLE_SHA1:-unknown}

# Install libraries needed for psycopg and cryptography
RUN apk add --update --no-cache postgresql-dev gcc musl-dev python3-dev libffi-dev openssl-dev cargo
RUN pip install --upgrade pip

RUN addgroup -g 10001 app && \
    adduser -D -G app -h /app -u 10001 app

WORKDIR /app

EXPOSE 8000

USER app
COPY --from=gulp-builder --chown=app /app/static ./static

COPY --chown=app ./requirements.txt /app/requirements.txt
RUN pip install -r requirements.txt
COPY --chown=app . /app
COPY --chown=app .env-dist /app/.env

RUN mkdir -p /app/staticfiles
RUN python manage.py collectstatic --no-input -v 2

ENTRYPOINT ["/app/.local/bin/gunicorn"]

CMD ["--config", "gunicorn.conf", "privaterelay.wsgi:application"]
