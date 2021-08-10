from use_cases.use_case import UseCase
import numpy as np
import eel

# source of dataset: https://data.cityofnewyork.us/Transportation/2018-Yellow-Taxi-Trip-Data/t29m-gskq
FILE_PATH = "../data/nyc_taxis.csv"
TABLE_NAME = "taxis"
X_ENCODING = "trip_duration"
Y_ENCODING = "tip_percentile"

class UseCaseTaxis(UseCase):
  def __init__(self):
    super().__init__(FILE_PATH, TABLE_NAME, X_ENCODING, Y_ENCODING)


  def transform_df(self, df):
      ids = np.arange(df.shape[0])
      df["id"] = np.core.defchararray.add('ID', ids.astype(str))

      df["tpep_dropoff_datetime"] = df["tpep_dropoff_datetime"].astype("int64") / 10 ** 9
      df["tpep_pickup_datetime"] = df["tpep_pickup_datetime"].astype("int64") / 10 ** 9

      df[X_ENCODING] = np.random.rand(df.shape[0])
      df[Y_ENCODING] = np.random.rand(df.shape[0])

      return df

  def send_info(self, eel: eel, df):
      super().send_info(eel, df)
      # true max lies at 86392.0, but that's an extreme outlier.
      eel.send_dimension_total_extent({
        "name": X_ENCODING,
        "min": 0,
        "max": 8000
      })


  def get_dict_for_use_case(self, tuple, df):
    result = {}

    for i, col in enumerate(df.columns):
      result[col] = tuple[i]

    result[X_ENCODING] = result["tpep_dropoff_datetime"] - result["tpep_pickup_datetime"]
    result[Y_ENCODING] = (result["tip_amount"] / result["total_amount"])

    return result
