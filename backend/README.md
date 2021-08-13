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
## Setup
### Prerequisites
The backend module assumes that your have a recent version of Python 3.x installed on your machine, together with pip for downloading dependencies.
Please follow [the official Python tutorial](https://wiki.python.org/moin/BeginnersGuide/Download) to learn more.

The backend also assumes that you have a [MySQL](https://dev.mysql.com/downloads/) database server running on `localhost:3306`.


#### Install Python dependencies
With Python and pip installed, install ProSteer's dependencies by running the following command in your terminal:

```sh
$ python -m pip install -r requirements.txt
```

(```python -m``` ensures that pip installs the dependecies to the same environment as your ```python``` version.)
Make sure that there are no errors before moving to the next section.
In case there are errors, it might be due to a faulty pip setup.


## Launching the Backend
To launch the backend, run the following command:

```sh
$ python server_duckdb.py
```

Your terminal should now show the following output:
```sh
Backend launched successfully. Waiting for requests ...
```

You can now launch [the frontend](../frontend), using the default use case (see below).


## Changing the Dataset
This repository supports running a steered progresion for different use cases (i.e., analyses over different particular datasets).
You can specify the use case as a parameter after the command above that launches the backend.
So for example, to launch the use case for NYC Cab rides, run
```bash
$ python server_duckdb.py taxis
```
The supported use cases are listed below:

| **parameter** | **description** | **link** |
|---|---|---|
| ```airbnb``` | The default dataset. The data consists of AirBnB listings for Paris. As a  use case, consider booking a hotel in the city that is located close to a  conference venue. We compute the walking distance in minutes from a preset  hotel to each listing in the dataset, as well as the price difference to  other listings in a 300m radius. | [airbnb.py](./use_cases/airbnb.py) |
| ```spotify``` | A dataset containing songs from spotify, which lists metrics like  danceability and loudness for each song. This use case primarily exists to  demonstrate steering-by-example without any additional computations on the  data. | [spotify.py](./use_cases/spotify.py) |
| ```taxis``` | A dataset containing (most) individual cab rides in New York City from 2018,  listing start and end time, as well as a subdivision of the total amount  paid into tips, taxes, tolls and more. For every ride, compute the duration  and the tipped percentage of the total amount.  | [nyc_taxis.py](./use_cases/nyc_taxis.py) |


## Adding your own Use Case
You can use ProSteer on your own dataset. All you need to do for this is add a script that describes the particular use case.
More specifically, you need to implement the ```UseCase``` class from [use_case.py](./use_cases/use_case.py) and override the necessary functions.
See the documentation for ```use_case.py``` for detailed descriptions of each function.
You may also want to have a look at the existing use cases to get an idea of how each function is intended to be used.