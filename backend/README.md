# Progressive Steering - Backend
This directory contains the files of the backend for the progressive steering application.

```
backend
|- boxGenerator.py -->
|- boxGenerator2.py -->
|- DB_server.py --> Launches the eel backend
|- evaluation_pipeline.py -->
|- evaluationMetrics.py -->
|- steering_module.py -->
|- Update_DB.py -->
```

## Prerequisites
The backend module assumes that your have a recent version of Python 3.x installed on your machine, together with pip for downloading dependencies.
Please follow [the official Python tutorial](https://wiki.python.org/moin/BeginnersGuide/Download) to learn more.

The backend also assumes that you have a [MySQL](https://dev.mysql.com/downloads/) database server running on `localhost:3306`.


### Install Python dependencies
Withon Python and pip installed, install ProSteer's dependencies by running the following command on your terminal:

```sh
$ pip install eel mysql-connector-python sklearn
```

Make sure that there are no breaking errors before moving to the next section.
In case there are errors, it might be due to a faulty pip setup.


### Setup MySQL
Per default, ProSteer will connect to the local instance of `mysql-server` on `localhost:3306`, using the default username `root` and the default password `password`.
Change the user name and password properties defined in `DB_server.py:192` to reflect your own configuration.

To work with the airbnb data, create a new schema on your MySQL instance and name it `airbnb`.
Then import the data from `/MySQL data/listings.csv` into a new table and name it `listings` (see the [MySQL workbench documentation](https://dev.mysql.com/doc/workbench/en/wb-admin-export-import-table.html) for a description on how to import CSV files into a database). Likewise, import the data from `plotted.csv` into a table named `plotted`.


### Precompute the metrics
ProSteer assumes that two dimensions of the data (_Distance_ and _Saving opportunity_) are already pre-computed for a certain location in Paris.
They denote the distance between a listing on AirBnB and a conference hotel, as well as the amount of money that can be saved at each listing, compared to the listings in its neighborhood.
To precompute these values for the default location that we describe in our paper, run the following script inside the `backend/` directory.
(To precompute other locations, change the paramters inside `Update_DB.py`)

```sh
$ python Update_DB.py
```

This takes some time.
Once the process terminates, you should be able to find that two new columns appear in the schema for listings in your database.


## Launching the Backend
To launch the backend, run the following command:

```sh
$ python eel_backend.py
```

Your terminal should now show the following output:
```sh
Backend launched successfully. Waiting for requests ...
```
