class UseCase():
  def __init__(self, file_path, table_name, x_encoding, y_encoding):
    self.file_path = file_path
    self.table_name = table_name
    self.x_encoding = x_encoding
    self.y_encoding = y_encoding
    return None


  def get_user_parameters(self, user_data):
    '''
    Given the parameters provided by the user when launching the application, this function transforms
    them into a uniformed format from which we generate steered/non-steered SQL queries.
    '''
    return {}


  def get_dict_for_use_case(self, tuple):
    '''
    Describes the transformation of a tuple from the airbnb data to the format required by the
    duckdb server. The returned dict is required to encode the x and y dimensions.
    '''
    return {
        self.x_encoding: tuple[-1],
        self.y_encoding: tuple[-1],
    }


  def send_info(self, eel):
    '''
    Sends value ranges to the frontend for all dimensions that are included by the
    airbnb_tuple_to_dict() function above.
    '''
    # eel.send_dimension_total_extent({"name": "accommodates", "min": 0, "max": 5})

    return True