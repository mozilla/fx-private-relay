# Generated by Django 4.2.16 on 2024-10-09 21:19

from django.contrib.postgres.operations import CryptoExtension
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("privaterelay", "0010_move_profile_and_registered_subdomain_models"),
    ]

    operations = [CryptoExtension()]