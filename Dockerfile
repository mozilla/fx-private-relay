FROM python:3.9.13

ARG CIRCLE_BRANCH
ARG CIRCLE_SHA1
ARG CIRCLE_TAG
ENV CIRCLE_BRANCH=${CIRCLE_BRANCH:-unknown} \
    CIRCLE_TAG=${CIRCLE_TAG:-unknown} \
    CIRCLE_SHA1=${CIRCLE_SHA1:-unknown}

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

RUN mkdir -p /app/staticfiles && \
    python manage.py collectstatic --no-input -v 2

ENTRYPOINT ["/app/.local/bin/gunicorn"]

CMD ["--config", "gunicorn.conf", "privaterelay.wsgi:application"]
