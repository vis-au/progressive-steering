import pandas as pd
import eel
from typing import List

class UseCase():
  def __init__(self, file_path, table_name, x_encoding, y_encoding, training_features=[]):
    self.file_path = file_path
    self.table_name = table_name
    self.x_encoding = x_encoding
    self.y_encoding = y_encoding
    self.feature_columns = training_features
    return None


  def get_user_parameters(self, user_data):
    '''
    Given the parameters provided by the user when launching the application, this function transforms
    them into a uniformed format from which we generate steered/non-steered SQL queries.
    '''
    return {}


  def transform_df(self, df):
    '''
    Describes the transformation function over the dataframe, for example right after it was loaded
    from disk. Defaults to the identity function.
    '''
    return df


  def get_dict_for_use_case(self, tuple: List[float], df: pd.DataFrame):
    '''
    Describes the transformation of a tuple from the airbnb data to the format required by the
    duckdb server. The returned dict is required to encode the x and y dimensions. Defaults to a
    simple conversion from tuple to dict.
    '''
    result = {}

    for i, col in enumerate(df.columns):
      result[col] = tuple[i]

    return result


  def send_info(self, eel: eel, df: pd.DataFrame):
    '''
    Sends value ranges to the frontend for all dimensions that are included by the
    airbnb_tuple_to_dict() function above. Defaults to loading min/max from the dataframe for all
    dimensions and sending those.
    '''
    for col in df.columns:
      min = df[col].min()
      max = df[col].max()
      eel.send_dimension_total_extent({
        "name": col,
        "min": min,
        "max": max
      })