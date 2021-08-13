import eel
from typing import Any, List

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


  def get_pk_columns(self):
    '''
    Returns the columns of the data that make up the primary key of the dataset.
    Use this whenever the data does not contain a column named 'id'. If more than one column are
    supplied, they are concatenated in the CREATE query.
    '''
    return ["id"]


  def get_view_filter(self):
    ''''
    Returns filter conditions that are appended to the query creating the view on the imported data.
    Defaults to empty string, which corresponds to "no filter".
    '''
    return ""


  def get_additional_columns(self):
    '''
    Returns additional columns that should be included in the result set. Per default, the server
    retrieves only numerical columns.
    '''
    return []


  def get_min_points_before_training(self):
    '''
    Returns the minimum number of selected points, before the server should start train the decision
    tree. Depends on the variance and size of the dataset: The more varied the data in the feature
    columns, the more points need to be included to ensure that the tree captures the features
    for the region of interest. Defaults to 50.
    '''
    return 50


  def get_dict_for_use_case(self, tuple: List[float], column_names: List[str]):
    '''
    Describes the transformation of a tuple retrieved from the data to the format expected by the
    client. The returned dict is required to encode the x and y dimensions. Defaults to a
    simple conversion from tuple to dict. Takes a duckdb cursor as parameter to get SQL access on
    the data.
    '''
    result = {}

    for i, col in enumerate(column_names):
      result[col] = tuple[i]

    return result


  def send_info(self, eel: eel, column_names: List[str], cursor: Any):
    '''
    Sends value ranges to the frontend for all dimensions that are included by the
    get_dict_for_use_case() function above. Defaults to loading min/max from the database for all
    dimensions and sending those over eel. Takes a duckdb cursor as attribute to get SQL access on
    the data. Note that this min/max aggregations can take a while for large datasets.
    '''

    for col in column_names:
      query = f"SELECT MIN({col}),MAX({col}) FROM {self.table_name};"
      min_max_tuple = cursor.execute(query).fetchall()[0]
      min = min_max_tuple[0]
      max = min_max_tuple[1]
      eel.send_dimension_total_extent({
        "name": col,
        "min": min,
        "max": max
      })