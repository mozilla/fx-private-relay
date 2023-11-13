# Generated by Django 4.2.7 on 2023-11-13 21:03
# This index was added in 0006_add_email_indexes.py
# The same index was added by django-allauth 0.56.0
# https://github.com/pennersr/django-allauth/blob/main/allauth/account/migrations/0005_emailaddress_idx_upper_email.py
# This drops Relay's redundant index on upper(email)

from django.apps.registry import Apps
from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor


INDEX_NAME = "account_emailaddress_email_upper"


def add_account_email_index(
    apps: Apps, schema_editor: BaseDatabaseSchemaEditor
) -> None:
    if schema_editor.connection.vendor.startswith("postgres"):
        engine = "postgres"
    elif schema_editor.connection.vendor.startswith("sqlite"):
        engine = "sqlite"
    else:
        raise Exception(f'Unknown database vendor "{schema_editor.connection.vendor}"')

    if_not_exists = "IF NOT EXISTS" if engine == "postgres" else ""
    schema_editor.execute(
        f"CREATE INDEX {if_not_exists} {INDEX_NAME} ON account_emailaddress"
        " (upper(email));"
    )


def drop_account_email_index(
    apps: Apps, schema_editor: BaseDatabaseSchemaEditor
) -> None:
    schema_editor.execute(f"DROP INDEX IF EXISTS {INDEX_NAME};")


class Migration(migrations.Migration):
    dependencies = [
        ("privaterelay", "0007_set_verified_email"),
        ("account", "0005_emailaddress_idx_upper_email"),
    ]

    operations = [
        migrations.RunPython(
            code=drop_account_email_index,
            reverse_code=add_account_email_index,
        )
    ]
