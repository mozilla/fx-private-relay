FROM node:lts AS frontend

WORKDIR /home/node

COPY package*.json .
COPY frontend frontend
COPY privaterelay/locales privaterelay/locales

RUN npm ci --workspace frontend
RUN npm run build --workspace frontend


FROM python:3.11.8 AS app

RUN pip install --no-cache --upgrade pip

RUN groupadd --gid 10001 app && \
    useradd -g app --uid 10001 --shell /usr/sbin/nologin --create-home --home-dir /app app

WORKDIR /app

EXPOSE 8000

USER app

COPY --chown=app ./requirements.txt /app/requirements.txt
RUN pip install --no-cache -r requirements.txt
COPY --chown=app . /app
# When the user's Accept-Language is set to `fy`, Django's LocaleMiddleware
# doesn't load `fy-NL`. This is a workaround to force the Frysian and Swedish
# localisations to load anyway when appropriate.
RUN ln --symbolic /app/privaterelay/locales/fy-NL/ privaterelay/locales/fy
RUN ln --symbolic /app/privaterelay/locales/sv-SE/ privaterelay/locales/sv
RUN ln --symbolic /app/privaterelay/locales/pt-BR/ privaterelay/locales/pt
RUN ln --symbolic /app/privaterelay/locales/es-ES/ privaterelay/locales/es
COPY --chown=app .env-dist /app/.env

# TODO The email tracker list commands are a duplicate of a CircleCI job
# https://github.com/jbuck/fx-private-relay/blob/57cdfc5421b5faf0fe1f228aeb524d4232a221e0/.circleci/python_job.bash#L69-L77
RUN python manage.py get_latest_email_tracker_lists --skip-checks
RUN python manage.py get_latest_email_tracker_lists --skip-checks --tracker-level=2

# Collect all staticfiles, including for apps that may be disabled
COPY --from=frontend --chown=app /home/node/frontend/out frontend/out
RUN PHONES_ENABLED=True \
    API_DOCS_ENABLED=True \
    mkdir -p /app/staticfiles && \
    python manage.py collectstatic --no-input -v 2

# These arguments change frequently so define them last
# TODO remove `CIRCLE_*` vars after we move off CircleCI
ARG CIRCLE_BRANCH
ARG CIRCLE_SHA1
ARG CIRCLE_TAG
ARG GITHUB_REPOSITORY
ARG GITHUB_RUN_ID
ARG GITHUB_SERVER_URL
ARG GIT_BRANCH
ARG GIT_SHA
ARG GIT_TAG
ENV CIRCLE_BRANCH=${CIRCLE_BRANCH:-unknown} \
    CIRCLE_SHA1=${CIRCLE_SHA1:-unknown} \
    CIRCLE_TAG=${CIRCLE_TAG:-unknown} \
    GITHUB_REPOSITORY=${GITHUB_REPOSITORY:-mozilla/fx-private-relay} \
    GITHUB_RUN_ID=${GITHUB_RUN_ID:-unknown} \
    GITHUB_SERVER_URL=${GITHUB_SERVER_URL:-https://github.com} \
    GIT_BRANCH=${GIT_BRANCH:-unknown} \
    GIT_SHA=${GIT_SHA:-unknown} \
    GIT_TAG=${GIT_TAG:-unknown}

# Do not override the CircleCI version if created
RUN if [ ! -f "/app/version.json" ]; then \
    printf '{"commit":"%s","version":"%s","source":"https://github.com/%s","build":"%s/%s/actions/runs/%s"}\n' \
    "$GIT_SHA" \
    "$GIT_TAG" \
    "$GITHUB_REPOSITORY" \
    "$GITHUB_SERVER_URL" \
    "$GITHUB_REPOSITORY" \
    "$GITHUB_RUN_ID" > /app/version.json; \
    fi

ENTRYPOINT ["/app/.local/bin/gunicorn"]

CMD ["--config", "gunicorn.conf.py", "privaterelay.wsgi:application"]
