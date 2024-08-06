# Django Migrations Standards

From Django 3.2 documentation on [Migrations][]

> Migrations are Django’s way of propagating changes you make to your models (adding a field, deleting a model, etc.) into your database schema. They’re designed to be mostly automatic, but you’ll need to know when to make migrations, when to run them, and the common problems you might run into.

For creating migrations use [Django's built-in commands][].

[Django's built-in commands]: https://docs.djangoproject.com/en/3.2/topics/migrations/#the-commands
[Migrations]: https://docs.djangoproject.com/en/3.2/topics/migrations/#module-django.db.migrations

### Adding New Model Field

The Django migration command `./manage.py makemigrations` utilizes [AddField operation][] from `django.db.migrations` and creates the new column in the database. If specified on the field, the migration applies the default value to the existing entries when the new column is added in the database. However, the migration never specifies the default value in the database column. The code and the database can be misaligned and cause errors when:

1. Version X code is happily running in several pods.
2. The migrations for Version X+1 run.
   - New empty tables are added.
   - New columns are added to existing tables.
3. Version X code needs to run happily against the X+1 database:

   - When writing a new entry to the updated table with a new column, version X doesn't know about new columns and will omit them from INSERT statements.
     > [!NOTE]
     > These columns need a database default or allow `NULL`

4. Canary pod with Version X+1 starts. It is running the same time as all the Version X pods.
5. Kubernetes rollout of Version X+1 starts:
   - New pod with Version X+1 starts.
   - When the Version X+1 pod is running, the Version X pod is shut down. This continues until no pods run Version X.
6. Version X+1 code is happily running in several pods.
   > [!WARNING]
   > Misaligned code and database happens in Step 3 when Version X adds a new entry to the table without proper default set. In Step 6, the Version X+1 retrieves the entry. The fetched entry added by Version X does not meet the field validation in Version X+1 causing validation error.

<!-- TODO: MPP-3464 Add instructions to prevent or mitigate the error while add new field -->

> [!Note]
> Workaround explained below will not be needed after upgrading Django to 5.0 or above. Django 5.0 adds `db_default` on Django model field which will set the appropriate default on the database. Read more on [database-computed default values][]

To prevent the error we can:

1. Set the newly added Django model field with a default value, `null=True` and `blank=True` options.
2. Create migration using Django's built-in command `./manage.py makemigrations` which sets the database schema for the corresponding field to accept `NULL` value.
3. Once the newly added field and its migration are in a tagged version of code and deployed, remove the `null=True` and `blank=True` in the model field.
   > [!NOTE]
   > If the field does utilize `null` and `blank` options skip this step. Read documentation on [null][] and [blank][] option to learn more on when it is appropriate to use the field options.
4. Create migration to remove the field options from the database schema
5. Merge, tag and deploy the removed `null` and `blank` code and migration.

Alternatively, use custom SQL queries to set default values in database schema for the old entries and any new entry such that we prevent integrity error on our entries while transitioning from version X to X+1:

1. After adding the new model field run Django's built-in command `./manage.py makemigrations`
2. Then run `./manage.py sqlmigrate app_label migration_name`. E.g. For `0058_profile_onboarding_free_state.py` migration in the `emails` app the command looks like `./manage.py sqlmigrate emails 0058`
   > [!Note]
   > Since local setup of Relay uses SQLite, the generated queries will be in SQLite. Dev, stage, and production uses PostgresSQL. If the `./manage.py sqlmigrate` is ran in environments other than local, it will return queries in PostgresSQL.
3. Use a [SQL formatter][] to better structure the query.
4. Add the SQL code snippets to the corresponding `add_db_default_forward_func` template:

```python
def add_db_default_forward_func(apps, schema_editor):
    """
    Add a database default of false for sent_welcome_email, for PostgreSQL and SQLite3
    Note: set sent_welcome_email = true for existing users

    Using `./manage.py sqlmigrate` for the SQL, and the technique from:
    https://stackoverflow.com/a/45232678/10612
    """
    if schema_editor.connection.vendor.startswith("postgres"):
        # completed in step 6
    elif schema_editor.connection.vendor.startswith("sqlite"):
        # TODO: copy paste the CREATE TABLE query
        schema_editor.execute(
            """
            CREATE TABLE ...
            """
        )
        # TODO: copy paste the INSERT INTO query including the first FROM clause
        schema_editor.execute(
            """
            INSERT INTO ...
            """
        )
        # TODO: copy paste the DROP TABLE query
        schema_editor.execute('DROP TABLE ...')
        # TODO: copy paste the ALTER TABLE query
        schema_editor.execute(
            'ALTER TABLE ...'
        )
        # TODO: copy paste every CREATE INDEX query to its own execute method
        schema_editor.execute(
            'CREATE INDEX ...'
        )
    else:
        raise Exception(f'Unknown database vendor "{schema_editor.connection.vendor}"')
```

5. In the `CREATE TABLE` query, ensure that default value of the newly add column is set.
6. Create another query for PostgreSQL and update the if-clause for PostgreSQL in the `add_db_default_forward_func` template:

```python
def add_db_default_forward_func(apps, schema_editor):
    """
    Add a database default of false for sent_welcome_email, for PostgreSQL and SQLite3
    Note: set sent_welcome_email = true for existing users

    Using `./manage.py sqlmigrate` for the SQL, and the technique from:
    https://stackoverflow.com/a/45232678/10612
    """
    if schema_editor.connection.vendor.startswith("postgres"):
        # TODO: copy paste the {TABLE_NAME} and {COLUMN_NAME} found in SQLite query
        schema_editor.execute(
            'ALTER TABLE "{TABLE_NAME}"'
            ' ALTER COLUMN "{COLUMN_NAME}" SET DEFAULT {DEFAULT_VALUE};'
        )
        # TODO: copy paste the {TABLE_NAME} and {COLUMN_NAME} found in SQLite query
        # and set the values of old entries with the new column by replacing the
        # {OLD_ENTRY_DEFAULT_VALUE}
        schema_editor.execute(
            'UPDATE "{TALBE_NAME}"'
            ' SET "{COLUMN_NAME}" = {OLD_ENTRY_DEFAULT_VALUE};'
        )
    elif schema_editor.connection.vendor.startswith("sqlite"):
        # completed in step 4 and 5
```

7. Append the following `migrations.RunPython` call in `operations` attribute of the `Migration` object defined in the migration file:

```python
migrations.RunPython(
    code=add_db_default_forward_func,
    reverse_code=migrations.RunPython.noop,
    elidable=True,
),
```
8. When the the migration file is execuated, the appropriate SQL query defined in previous steps will run to populate old entries with specified value and enforce the default value for new entries for the newly added field.

> [!Note]
> See `emails/migrations/0058_profile_onboarding_free_state.py` for an example of this workaround.

[AddField operation]: https://docs.djangoproject.com/en/3.2/ref/migration-operations/#addfield
[SQL formatter]: https://codebeautify.org/sqlformatter
[blank]: https://docs.djangoproject.com/en/3.2/ref/models/fields/#blank
[database-computed default values]: https://docs.djangoproject.com/en/dev/releases/5.0/#database-computed-default-values
[null]: https://docs.djangoproject.com/en/3.2/ref/models/fields/#null

### Deleting Existing Model or Model Field

Like adding a new field in an existing model, when deleting an existing model or a field in the model there is a possibility that the code referencing the fields can run while the table or the column no longer exists in the database. All reference to the field and the field is removed from the code. The Django migration command `./manage.py makemigrations` utilizes [RemoveField operation][] from `django.db.migrations` and deletes the corresponding column in the database. The code and the database can be misaligned when:

1. Version X code is happily running in several pods.
2. The migrations for Version X+1 run.
   - Old columns are removed.
3. Version X code needs to run happily against the X+1 database:
   - The deleted field is already removed from the Django model in version X.
   - Meanwhile the column remains in the database.
     > [!NOTE]
     > When writing to an existing table, version X should not refer to deleted columns.
4. Canary pod with Version X+1 starts. It is running the same time as all the Version X pods.
5. Kubernetes rollout of Version X+1 starts:
   - New pod with Version X+1 starts.
   - When the Version X+1 pod is running, the Version X pod is shut down. This continues until no pods run Version X.
6. Version X+1 code is happily running in several pods.
   > [!WARNING]
   > Error happens when Version X or Version X+1 code refers to the deleted column.

To prevent the error we need to:

1. Remove all references of the field or the model in the code.
2. Deploy the code removals to production.
3. Then remove the field or model from the `models.py` file and create a migration that removes the column or the table from the database.
4. Deploy the model changes and its migration to production.

[RemoveField operation]: https://docs.djangoproject.com/en/3.2/ref/migration-operations/#removefield

## Terms

<!-- TODO: MPP-3464 Add terminology definitions -->

Relay developers will see these terms as they work in this topic:

- **[Field][]**: Required part of a model that correlates to the database column. Comes with various built-in [field types][]
- **[Field Option][]**: Optional set of common arguments available to all field types. The field option is used for further validation that results to any save.
  Column
  Migration
  Model
  Entry

[Field]: https://docs.djangoproject.com/en/3.2/topics/db/models/#fields
[Field Option]: https://docs.djangoproject.com/en/3.2/topics/db/models/#field-options
[field types]: https://docs.djangoproject.com/en/3.2/ref/models/fields/#model-field-types

## Links

- [Database Refactoring] - a technique which enables Continuous Delivery

[Database Refactoring]: https://www.databaserefactoring.com/
