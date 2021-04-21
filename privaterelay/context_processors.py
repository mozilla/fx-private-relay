from django.conf import settings


def django_settings(request):
    return {'settings': settings}

def ftl_mode(request):
    return {'ftl_mode': 'server'}
