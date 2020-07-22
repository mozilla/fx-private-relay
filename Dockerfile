FROM python:3.7.6 AS builder

WORKDIR /app

RUN python -m venv ./python-venv
ENV PATH="/app/python-venv/bin:$PATH"
RUN python -m pip install --upgrade --no-cache-dir pip setuptools wheel

COPY . /app
COPY .env-dist /app/.env

RUN apt-get update \
    && apt-get install --yes libpq-dev \
    && python -m pip install --no-cache-dir -r requirements.txt

# Create final image.
FROM python:3.7.6-slim

RUN groupadd --gid 10001 app && \
    useradd -g app --uid 10001 --shell /usr/sbin/nologin --create-home --home-dir /app app

RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
        libpq5 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

USER app
WORKDIR /app

COPY --chown=app --from=builder /app /app

ENV PATH="/app/python-venv/bin:$PATH"
RUN mkdir -p /app/staticfiles
RUN python manage.py collectstatic --no-input -v 2

EXPOSE 8000

ENTRYPOINT ["gunicorn"]

CMD ["--config", "gunicorn.conf", "privaterelay.wsgi:application"]
