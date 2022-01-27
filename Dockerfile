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

FROM debian as react-builder

# Install Volta, to use the same toolchain (Node+npm) as developers locally:
RUN apt-get update && apt-get install -y curl ca-certificates --no-install-recommends
ENV VOLTA_HOME $HOME/.volta
ENV PATH $VOLTA_HOME/bin:$PATH
RUN curl https://get.volta.sh | bash

WORKDIR /app
COPY privaterelay/locales ./privaterelay/locales
# TODO: Move static files from /static/ to /frontend/public/ and remove this COPY:
COPY static ./static

WORKDIR /app/frontend
COPY frontend ./
RUN npm install
RUN npm run lint
RUN npm run test
RUN npm run build

FROM python:3.7.9

ARG CIRCLE_BRANCH
ARG CIRCLE_SHA1
ARG CIRCLE_TAG
ENV CIRCLE_BRANCH=${CIRCLE_BRANCH:-unknown} \
    CIRCLE_TAG=${CIRCLE_TAG:-unknown} \
    CIRCLE_SHA1=${CIRCLE_SHA1:-unknown}

RUN apt-get update && apt-get install -y libpq-dev
RUN pip install --upgrade pip

RUN groupadd --gid 10001 app && \
    useradd -g app --uid 10001 --shell /usr/sbin/nologin --create-home --home-dir /app app

WORKDIR /app

EXPOSE 8000

USER app
COPY --from=gulp-builder --chown=app /app/static ./static
COPY --from=react-builder --chown=app /app/frontend ./frontend

COPY --chown=app ./requirements.txt /app/requirements.txt
RUN pip install -r requirements.txt
COPY --chown=app . /app
COPY --chown=app .env-dist /app/.env

RUN mkdir -p /app/staticfiles
RUN python manage.py collectstatic --no-input -v 2

ENTRYPOINT ["/app/.local/bin/gunicorn"]

CMD ["--config", "gunicorn.conf", "privaterelay.wsgi:application"]
