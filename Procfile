release: python manage.py migrate
web: gunicorn privaterelay.wsgi
worker: python ./manage.py process_emails_from_sqs
