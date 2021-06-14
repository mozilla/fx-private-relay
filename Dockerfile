FROM python:3.7.9

RUN curl -fsSL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y libpq-dev
RUN apt-get install -y nodejs
RUN pip install --upgrade pip

RUN groupadd --gid 10001 app && \
    useradd -g app --uid 10001 --shell /usr/sbin/nologin --create-home --home-dir /app app

WORKDIR /app

EXPOSE 8000

USER app

COPY --chown=app ./requirements.txt /app/requirements.txt
RUN pip install -r requirements.txt

COPY package*.json ./
RUN npm install

COPY --chown=app . /app
COPY --chown=app .env-dist /app/.env

RUN mkdir -p /app/staticfiles
RUN python manage.py collectstatic --no-input -v 2

ENTRYPOINT ["/app/.local/bin/gunicorn"]

CMD ["--config", "gunicorn.conf", "privaterelay.wsgi:application"]
