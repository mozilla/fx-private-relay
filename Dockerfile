FROM python:3.7.6

RUN apt-get update && apt-get -y install libpq-dev

RUN groupadd --gid 10001 app && \
    useradd -g app --uid 10001 --shell /usr/sbin/nologin --create-home --home-dir /app app

WORKDIR /app

EXPOSE 8000

USER app

COPY . /app

RUN pip install -r requirements.txt

ENTRYPOINT ["python"]
CMD ["/app/manage.py", "runserver", "0.0.0.0:8000"]
