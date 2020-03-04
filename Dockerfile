FROM python:3.7.6

RUN apt-get update && apt-get -y install libpq-dev
RUN pip install --upgrade pip

RUN groupadd --gid 10001 app && \
    useradd -g app --uid 10001 --shell /usr/sbin/nologin --create-home --home-dir /app app

WORKDIR /app

EXPOSE 8000

USER app

COPY . /app

RUN pip install -r requirements.txt

CMD ["/app/.local/bin/gunicorn", "--bind", "0.0.0.0:8000", "privaterelay.wsgi:application"]
