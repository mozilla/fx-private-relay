# mypy type hints for 3rd party modules

This folder contains type hints for 3rd party Python modules, used by
[mypy](https://mypy.readthedocs.io/en/latest/index.html) for static
analysis of Python code.

## Generation and Maintenance

The files are initially generated with `stubgen` from `mypy`. They can be
generated for a whole package:

```
stubgen -o mypy_stubs -p package_name
```

They can be generated for just one module:

```
stubgen -o mypy_stubs -m package_name.submodule
```

Some Django packages require `DJANGO_SETTINGS_MODULE`, or `stubgen` will fail:

```
export DJANGO_SETTINGS_MODULE=privaterelay.settings
stubgen -o mypy_stubs -p package_name
```

The generated stubs are placeholders, and often require significant
modifications to run without errors. They are also tied to the specific
version of the package. For this reason, we don't require stubs for
all third-party packages.

## Documentation

When generating stubs, add a docstring header to the file that specifies the
`pip` package name and header. This gives us a chance to recognize that the
stub is out-of-date when updating the package.

Add the same data here:

|package name|version|module name|
|-:|-:|-:|
|`python-decouple`|3.6|`decouple`|
