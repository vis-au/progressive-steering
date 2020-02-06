# Progressive Steering - Backend
This directory contains the files of the backend for the progressive steering application.

```
backend
|- eel_backend.py --> Launches the eel backend
```

## Prerequisites
The backend requires a Python 3.x environment with pip and a local few packages. These can be obtained launching the following command:

```sh
> pip install eel bottle bottle-websocket future whichcraft pyinstaller mysql mysql-connector-python
```

The backend also assumes that you have a [MySQL](https://dev.mysql.com/downloads/) database server running on `localhost:3306`.
Change the user name and password properties defined in `DB_server.py:192` to reflect your configuration.

To work with the airbnb data, create a new schema on your MySQL instance and name it `airbnb`.
Then import the data from `MySQL data/listings.csv` into a new table and name it `listings`  (see the [MySQL workbench documentation](https://dev.mysql.com/doc/workbench/en/wb-admin-export-import-table.html) for a description on how to import CSV files into a database).

## Launching the Backend
To launch the backend, run the following command:

```sh
> python eel_backend.py
```

Your terminal should now show the following output:
```sh
Backend launched successfully. Waiting for requests ...
```
