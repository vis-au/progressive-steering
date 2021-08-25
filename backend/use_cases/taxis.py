import eel
from typing import Any, List
from use_cases.use_case import UseCase

# source of dataset: https://data.cityofnewyork.us/Transportation/2018-Yellow-Taxi-Trip-Data/t29m-gskq
FILE_PATH = "../data/nyc_taxis.shuffled_full.csv.gz"
TABLE_NAME = "taxis"
X_ENCODING = "trip_duration"
Y_ENCODING = "tip_percentile"
TRAINING_FEATURES = ["passenger_count", "trip_distance", "fare_amount", "extra", "mta_tax", "tip_amount", "improvement_surcharge", "total_amount"]

class UseCaseTaxis(UseCase):
    def __init__(self):
        super().__init__(FILE_PATH, TABLE_NAME, X_ENCODING, Y_ENCODING, TRAINING_FEATURES)


    def get_pk_columns(self):
        return ["tripID"]


    def get_view_filter(self):
        return "total_amount > 0"


    def get_total_dataset_size(self):
        # data contains items with total_amount == 0, so sizes are a bit off.
        if "nyc_taxis." in FILE_PATH:
            return 112145904
        elif "nyc_taxis_10Mil." in FILE_PATH:
            return 9992803
        elif "nyc_taxis_1Mil." in FILE_PATH:
            return 999298
        else:
            return 100000


    def get_min_points_before_training(self):
        return 200


    def send_info(self, eel: eel, column_names: List[str], cursor: Any):
        # computing min/max over large data takes long, so use precomputed values for this use case
        eel.send_dimension_total_extent({ "name": "VendorID", "min": 1, "max": 2 })
        eel.send_dimension_total_extent({ "name": "passenger_count", "min": 0, "max": 192 })
        eel.send_dimension_total_extent({ "name": "trip_distance", "min": 0, "max": 189483.84 })
        eel.send_dimension_total_extent({ "name": "RatecodeID", "min": 1, "max": 6 })
        eel.send_dimension_total_extent({ "name": "PULocationID", "min": 1, "max": 265 })
        eel.send_dimension_total_extent({ "name": "DOLocationID", "min": 1, "max": 265 })
        eel.send_dimension_total_extent({ "name": "payment_type", "min": 1, "max": 5 })
        eel.send_dimension_total_extent({ "name": "fare_amount", "min": -800, "max": 907070.24 })
        eel.send_dimension_total_extent({ "name": "extra", "min": -80, "max": 96.64 })
        eel.send_dimension_total_extent({ "name": "mta_tax", "min": -80, "max": 150 })
        eel.send_dimension_total_extent({ "name": "tip_amount", "min": -322.42, "max": 945.97 })
        eel.send_dimension_total_extent({ "name": "toll_amount", "min": -52.5, "max": 1650 })
        eel.send_dimension_total_extent({ "name": "improvement_surcharge", "min": -0.3, "max": 4000.3 })
        eel.send_dimension_total_extent({ "name": "total_amount", "min": -800.3, "max": 907071.04 })

        # true max for trip_duration is much higher, but that is probably due to errors in the data.
        eel.send_dimension_total_extent({ "name": X_ENCODING, "min": 0, "max": 6000 })
        eel.send_dimension_total_extent({ "name": Y_ENCODING, "min": 0, "max": 1 })


    def get_additional_columns(self):
        return ["tpep_pickup_datetime", "tpep_dropoff_datetime"]


    def get_dict_for_use_case(self, tuple: List[float], column_names: List[str]):
        result = super().get_dict_for_use_case(tuple, column_names)

        dropoff_date = result["tpep_dropoff_datetime"]
        pickup_date = result["tpep_pickup_datetime"]
        result[X_ENCODING] = (dropoff_date - pickup_date).total_seconds()
        result[Y_ENCODING] = (result["tip_amount"] / result["total_amount"])

        return result
