# Generated by Django 4.2.7 on 2023-12-18 18:00

from django.db import migrations


def add_db_default_forward_func(apps, schema_editor):
    """
    Add database defaults for new fields provider_id and settings in table socialapp.
    This field was added by 0004_app_provider_id_settings.
    https://github.com/pennersr/django-allauth/blob/32c9eaf2d70cfae4f52f8e51b0ac4cd1523c5915/allauth/socialaccount/migrations/0004_app_provider_id_settings.py

    The database default is used by our migrations tests. In practice, it is unlikely
    and unwise to add a new SocialApp in the middle of a deployment.

    `./manage.py sqlmigrate` did not work, so the sqlite3 steps are manual.
    """
    if schema_editor.connection.vendor.startswith("postgres"):
        schema_editor.execute(
            """
            ALTER TABLE "socialaccount_socialapp"
                ALTER COLUMN "provider_id" SET DEFAULT '';
            """
        )
        schema_editor.execute(
            """
            ALTER TABLE "socialaccount_socialapp"
                ALTER COLUMN "settings" SET DEFAULT '{}';
            """
        )
    elif schema_editor.connection.vendor.startswith("sqlite"):
        schema_editor.execute(
            """
            CREATE TABLE "new__socialaccount_socialapp" (
                "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
                "provider" varchar(30) NOT NULL,
                "name" varchar(40) NOT NULL,
                "client_id" varchar(191) NOT NULL,
                "secret" varchar(191) NOT NULL,
                "key" varchar(191) NOT NULL,
                "provider_id" varchar(200) NOT NULL DEFAULT '',  -- Add default
                "settings" text NOT NULL
                  DEFAULT '{}'
                  CHECK ((JSON_VALID("settings") OR "settings" IS NULL))
            );
            """
        )
        schema_editor.execute(
            """
            INSERT INTO "new__socialaccount_socialapp"
                ("id", "provider", "name", "client_id", "secret", "key", "provider_id",
                 "settings")
              SELECT
                "id", "provider", "name", "client_id", "secret", "key", "provider_id",
                "settings"
              FROM "socialaccount_socialapp";
            """
        )
        schema_editor.execute('DROP TABLE "socialaccount_socialapp";')
        schema_editor.execute(
            """
            ALTER TABLE "new__socialaccount_socialapp"
              RENAME TO "socialaccount_socialapp";
            """
        )
    else:
        raise Exception(f'Unknown database vendor "{schema_editor.connection.vendor}"')


class Migration(migrations.Migration):
    dependencies = [
        ("privaterelay", "0007_set_verified_email"),
        ("socialaccount", "0004_app_provider_id_settings"),
    ]

    operations = [
        migrations.RunPython(
            code=add_db_default_forward_func,
            reverse_code=migrations.RunPython.noop,
            elidable=True,
        ),
    ]
