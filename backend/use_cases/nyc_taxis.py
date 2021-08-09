from use_cases.use_case import UseCase

# source of dataset: https://data.cityofnewyork.us/Transportation/2018-Yellow-Taxi-Trip-Data/t29m-gskq
FILE_PATH = "../data/nyc_taxis.csv"
TABLE_NAME = "taxis"
X_ENCODING = "trip_distance"
Y_ENCODING = "tip_amount"

class UseCaseTaxis(UseCase):
  def __init__(self):
    super().__init__(FILE_PATH, TABLE_NAME, X_ENCODING, Y_ENCODING)

  def get_user_parameters(self, user_data):
    return {}

  def get_dict_for_use_case(self, tuple, df):
    result = {}

    for i, col in enumerate(df.columns):
      result[col] = tuple[i]

    return result

  def transform_df(self, df):
      df["id"] = df["id"].dt.strftime("%Y-%m-%d-%H:%M:%S")
      return df

  def send_info(self, eel, df):
    eel.send_dimension_total_extent({
      "name": X_ENCODING,
      "min": 0,
      "max": 1
    })
    eel.send_dimension_total_extent({
      "name": Y_ENCODING,
      "min": 0,
      "max": 1
    })

    for col in df.columns:
      min = df[col].min()
      max = df[col].max()
      eel.send_dimension_total_extent({
        "name": col,
        "min": min,
        "max": max
      })