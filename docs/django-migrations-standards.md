# Django Migrations Standards

From Django 3.2 documentation on [Migrations](https://docs.djangoproject.com/en/3.2/topics/migrations/#module-django.db.migrations)

> Migrations are Django’s way of propagating changes you make to your models (adding a field, deleting a model, etc.) into your database schema. They’re designed to be mostly automatic, but you’ll need to know when to make migrations, when to run them, and the common problems you might run into.

For creating migrations use [Django's built-in commands](https://docs.djangoproject.com/en/3.2/topics/migrations/#the-commands).

### Adding New Model Field and Migrations

When adding new fields in an existing model, there is a possibility that the code referencing the fields can run before the new fields are populated with default values in the database. There are two ways to handle this race condition:

1. Run `./manage.py sqlmigrate` and manually update the SQL query to accept `NULL` value for the new field in the databse. See example of this in [emails/migrations/0054_profile_forwarded_first_reply.py](https://github.com/mozilla/fx-private-relay/blob/main/emails/migrations/0054_profile_forwarded_first_reply.py). The migration for the newly added Django field `forwarded_first_reply` is set to default to `False` for new entries, while [this code](https://github.com/mozilla/fx-private-relay/blob/main/emails/migrations/0054_profile_forwarded_first_reply.py#L43) sets the database column `forwarded_first_reply` to allow `NULL` value. As a result, new instance of the model `Profile` will be populated with the defualt value `False` on the Django level while the old entries and the database level allows `forwarded_first_reply` column to be `NULL`.

- Cons: Discrepancy between the code and the database. Room for error on generating our own SQL queries that requires the engineers to tinker with the Django's `sqlmigrate` command.

2. Add `null=True` and `blank=True` the argument to the new Django fieldso that the model field's value can be null or empty. Read more about `null` and `blank` Django field arguments [here](https://docs.djangoproject.com/en/4.2/ref/models/fields/#field-options).

- Cons: It is best practice to remove the `null` and `blank` especially if there is a default value set. This results in additional follow-up pull request with the changes on the code and migration to reflect the schema changes on the database. The follow-up PR can be merged only after the initial migrations with `null` and `blank` set to `True` are applied on production

Our current preference is to use Option 1 but it is not requirement.

### Deleting Existing Model or Model Field and Migrations

Similar to when adding a new field in an existing model, when deleting an existing model or a field in the model, there is a possibility that the code referencing the fields can run while the table or the column no longer exists in the database. To prevent such errors we need to:

1. Remove all references of the field or the model in the code.
2. Deploy the removals to production.
3. Then create a migration that removes the field or the model from the database.
