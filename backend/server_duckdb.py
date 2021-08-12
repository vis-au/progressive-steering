import platform
import eel
import duckdb
import pandas as pd
import numpy as np

import steering_duckdb as steer
from use_cases.use_case import UseCase
from use_cases.airbnb import UseCaseAirbnb
from use_cases.spotify import UseCaseSpotify
from use_cases.nyc_taxis import UseCaseTaxis
from testcase_loader import load_preset_scenarios, get_test_cases

WAIT_INTERVAL = 0.25

# contains information about the particular use case and is populated by load_use_case() on launch
USE_CASE: UseCase = None

# enum of the use case presets
USE_CASE_PRESETS = {
    "airbnb": UseCaseAirbnb,
    "spotify": UseCaseSpotify,
    "taxis": UseCaseTaxis
}

# we reorder the columns when loading the data such that a unique id sits at position 0
ID_COLUMN_INDEX = 0

# enum of states for progression
PROGRESSTION_STATES = {
    "ready": 0,
    "running": 1,
    "paused": 2,
    "done": 3
}

# user constants
user_parameters={}

# Global variables
plotted_points = {} # all plotted points
selected_points = [] # cumulated airb&b ID of points plotted in the user box till the actual chunk

user_selection_updated = False # new box
total_inside_box = 0 # number of points plotted in the user box till the actual chunk
has_tree_been_trained_before = False # it is used to interrupt the initial chunking cycle
chunk_size = 100 # number of points retrieved per chunk
modifier = "True" # modify initial query with conditions coming from the tree
last_selected_items = []
numeric_columns = [] # list of all columns containing numeric values
use_floats_for_savings=True

# progression state can be paused/restarted interactively by the user
progression_state = PROGRESSTION_STATES["ready"]

# initialize the database connection
cursor = duckdb.connect()


def send_chunks(steered_chunk, random_chunk):
    eel.send_both_chunks(steered_chunk, random_chunk)


def send_statistics_to_frontend(precision, total_inside_box):
    eel.send_evaluation_metric({"name": "precision", "value": precision})
    eel.send_evaluation_metric({"name": "recall", "value": total_inside_box})


def build_query(chunk_size, plotted_db, use_modifier):
  global modifier

  include_columns = numeric_columns + USE_CASE.get_additional_columns()
  SELECT = 'SELECT id,"'+'","'.join(include_columns)+'"'
  FROM   = "FROM "+USE_CASE.table_name
  WHERE = f"WHERE {USE_CASE.table_name}.id NOT IN (SELECT id from {plotted_db})"

  for p in user_parameters:
      param = str(p)
      value = user_parameters[p]

      if isinstance(value, list):
          min_value = str(value[0])
          max_value = str(value[1])
          WHERE += " AND "+param+" >= "+min_value+" AND "+param+" <= "+max_value
      elif isinstance(value, str):
          WHERE += " AND "+param+" = "+value
      elif isinstance(value, (int, float, complex)):
          WHERE += " AND "+param+" = "+str(value)

  if use_modifier:
    return SELECT+" "+FROM+" "+WHERE+" AND "+modifier+" LIMIT "+str(chunk_size)
  else:
    return SELECT+" "+FROM+" "+WHERE+" LIMIT "+str(chunk_size)


def reset():
    global plotted_points, selected_points
    global user_selection_updated, total_inside_box, has_tree_been_trained_before, chunk_size, modifier
    global last_selected_items, use_floats_for_savings, numeric_columns
    global progression_state

    print("resetting global state")

    plotted_points = {}
    selected_points = []

    user_selection_updated=False
    total_inside_box=0
    has_tree_been_trained_before=False
    chunk_size=100
    modifier="True"
    last_selected_items=[]
    numeric_columns = get_numeric_columns()
    use_floats_for_savings=True

    progression_state = PROGRESSTION_STATES["ready"]


def tuple_to_dict(tuple, state, chunk_number):
    # first use the use-case-specific transform function to generate the dict that is send to the
    # frontend from the touple
    include_columns = numeric_columns + USE_CASE.get_additional_columns()
    transformed_dict = USE_CASE.get_dict_for_use_case(tuple, ["id"]+include_columns)

    # then add the required properties
    transformed_dict["chunk"] = chunk_number
    transformed_dict["state"] = state
    transformed_dict["inside"] = 0

    return transformed_dict


def mark_ids_plotted(steered_result, random_result):
    results = [steered_result, random_result]
    tables = ["plotted", "plotted_random"]

    for pair in zip(results, tables):
        result = pair[0]
        value_string = ""
        for i, tuple in enumerate(result):
            value_string += "('"+str(tuple[ID_COLUMN_INDEX])+"'), " if i < len(result)-1 else "('"+str(tuple[ID_COLUMN_INDEX])+"');"

        # only run the query if there are actual values to insert, otherwise there will be an error.
        if len(value_string) > 0:
            cursor.execute(f"INSERT INTO {pair[1]} (id) VALUES {value_string}")


def get_items_inside_selection_at_chunk(chunk):
    inb = 0

    for k in plotted_points:
        if plotted_points[str(k)]["inside"]==1 and plotted_points[str(k)]["chunk"]==chunk:
            inb+=1

    return inb


def was_progression_reset_during_sleep():
    while progression_state == PROGRESSTION_STATES["paused"]:
        eel.sleep(1)
    if progression_state == PROGRESSTION_STATES["ready"]:
        return True
    elif progression_state == PROGRESSTION_STATES["done"]:
        return True

    return False


def send_results_to_frontend(chunk_number, steered_result, random_result, state):
    global plotted_points

    chunk = {}
    random_chunk = {}

    for tuple in steered_result:
        plotted_points[str(tuple[ID_COLUMN_INDEX])]=tuple_to_dict(tuple, state, chunk_number)
        chunk[str(tuple[ID_COLUMN_INDEX])]={
            "chunk": chunk_number,
            "state": state,
            "values": plotted_points[str(tuple[ID_COLUMN_INDEX])]
        }

    # ensure equal chunk size between random and steered chunk
    for tuple in random_result:
        random_chunk[str(tuple[ID_COLUMN_INDEX])] = {
            "chunk": chunk_number,
            "state": "random",
            "values": tuple_to_dict(tuple, state, chunk_number)
        }

    send_chunks(chunk, random_chunk)


def get_next_result(chunk_number, state, steered_query, random_query):
    global total_inside_box, selected_points

    cursor.execute(steered_query)
    steered_result = cursor.fetchall()
    cursor.execute(random_query)
    random_result = cursor.fetchall()

    if len(steered_result) < len(random_result):
        random_result = random_result[0:len(steered_result)]

    send_results_to_frontend(chunk_number, steered_result, random_result, state)
    mark_ids_plotted(steered_result, random_result)

    # IMPORTANT: within this waiting period, the backend receives the "in-/outside" information by
    # the frontend, which influences precision/insde calculation below
    eel.sleep(WAIT_INTERVAL)
    if was_progression_reset_during_sleep():
        return None

    recent_inside = get_items_inside_selection_at_chunk(chunk_number)
    total_inside_box += recent_inside
    precision = recent_inside/chunk_size
    print("chunk:", chunk_number, state, "in selection:", total_inside_box, "Precision:", precision)

    send_statistics_to_frontend(precision, total_inside_box)

    return steered_result


def run_steered_progression(chunk_size, min_box_items=50):
    global progression_state, modifier, total_inside_box

    chunk = 0
    steered_query = build_query(chunk_size, "plotted", True)
    random_query = build_query(chunk_size, "plotted_random", True)

    # reset databases of plotted points
    cursor.execute("DELETE FROM plotted")
    cursor.execute("DELETE FROM plotted_random")
    progression_state = PROGRESSTION_STATES["ready"]

    # wait until user starts progression
    while progression_state == PROGRESSTION_STATES["ready"]:
        eel.sleep(.1)
        # HACK: if the user reloads the page, the state variable is briefly set to "done" before a
        # new progression is spawned, causing this function to return, which terminates its "thread"
        if progression_state == PROGRESSTION_STATES["done"]:
            return


    ####################### NON-STEERING PHASE #####################################################
    print("Entering NON-STEERING PHASE 1 - Query:", steered_query, modifier)
    print("user parameters:", user_parameters)
    state="flushing"
    modifier="True"
    steered_query = build_query(chunk_size, "plotted", True)
    random_query = build_query(chunk_size, "plotted_random", True)
    my_result = []
    my_result_empty = False

    while not my_result_empty and (not has_tree_been_trained_before or total_inside_box<min_box_items or len(modifier)<=3) and len(selected_points) == 0:
        my_result = get_next_result(chunk, state, steered_query, random_query)
        chunk += 1
        if my_result is None:
            return
        my_result_empty = len(my_result) == 0

    ####################### ACTIVATION PHASE #######################################################
    print("Entering ACTIVATION PHASE - Query:", steered_query, modifier)
    print(steered_query)
    total_inside_box=0
    state="collectingData"
    my_result_empty = False

    while not my_result_empty and (not has_tree_been_trained_before or total_inside_box<min_box_items or len(modifier)<=3):
        my_result = get_next_result(chunk, state, steered_query, random_query)
        chunk += 1
        if my_result is None:
            return
        my_result_empty = len(my_result) == 0

    print("Exiting ACTIVATION PHASE")

    ########################## STEERING PHASE ######################################################
    state="usingTree"
    steered_query=build_query(chunk_size, "plotted", True)
    print("Entering STEERING PHASE - Query:", steered_query, len(my_result))
    my_result_empty = False

    while not my_result_empty:
        my_result = get_next_result(chunk, state, steered_query, random_query)
        chunk += 1
        if my_result is None:
            return
        my_result_empty = len(my_result) == 0

    print("Exiting STEERING PHASE")

    ######################### NON-STEERING PHASE ###################################################
    state="flushing"
    modifier="True"
    steered_query=build_query(chunk_size, "plotted", True)
    print("Entering NON-STEERING PHASE 2", has_tree_been_trained_before, "modifier =", modifier)
    my_result_empty = False

    while not my_result_empty:
        my_result = get_next_result(chunk, state, steered_query, random_query)
        chunk += 1
        if my_result is None:
            return
        my_result_empty = len(my_result) == 0

    print("Exiting NON-STEERING PHASE 2")
    print("DONE")

    return


def start_progression():
    global progression_state

    while True:
        reset()
        # HACK: set the state variable to "done" here, in order to terminate all progression
        # "threads" currently running, ensuring that only a single progression is run over the data.
        progression_state = PROGRESSTION_STATES["done"]
        eel.sleep(.1)
        eel.spawn(run_steered_progression(chunk_size))
        if progression_state == PROGRESSTION_STATES["done"]:
            return


@eel.expose
def get_use_cases():
    return get_test_cases()


def save_as_user_parameters(user_data):
  global user_parameters
  user_parameters = USE_CASE.get_user_parameters(user_data)


def send_info_to_frontend():
  # send general information to the frontend
  eel.set_x_name(USE_CASE.x_encoding)
  eel.set_y_name(USE_CASE.y_encoding)

  # also send use case specific bounds to the frontend
  USE_CASE.send_info(eel, numeric_columns, cursor)

  return


@eel.expose
def send_to_backend_userData(user_data):
  print("received user selection", user_data)

  save_as_user_parameters(user_data)
  send_info_to_frontend()

  # TODO: it seems counter-intuitive that this function would also start the progression.
  start_progression()


def update_steering_modifier():
    global modifier
    global has_tree_been_trained_before
    global USE_CASE

    plotted_list = []
    of_interest_list = []

    for id in plotted_points:
        plotted_list.append(plotted_points[str(id)])
        of_interest_list.append(1 if id in selected_points else 0)

    plotted_df = pd.DataFrame(plotted_list)
    of_interest_np = np.array(of_interest_list)

    # if the use case specifies feature columns, use those, otherwise use all columns except the
    # ones used for x and y encoding in view (to avoid just trivial training).
    if len(USE_CASE.feature_columns) == 0:
        feature_names = numeric_columns.copy()

        if USE_CASE.x_encoding in feature_names:
            feature_names.remove(USE_CASE.x_encoding)
        if USE_CASE.y_encoding in feature_names:
            feature_names.remove(USE_CASE.y_encoding)
    else:
        feature_names = USE_CASE.feature_columns

    features = plotted_df.loc[:, feature_names]
    modifier="("+steer.get_steering_condition(features, of_interest_np, "sql")+")"

    if len(modifier)>3:
        has_tree_been_trained_before=True
    else:
        modifier="True"

    return modifier


@eel.expose
def send_user_selection(selected_item_ids):
    global plotted_points
    global selected_points
    global last_selected_items

    if len(selected_item_ids)==0:
        return(0)

    print(len(selected_item_ids), "new items received...", selected_item_ids)

    last_selected_items=selected_item_ids.copy()

    for k in selected_item_ids:
        plotted_points[str(k)]["inside"]=1

    selected_points.extend(selected_item_ids)

    eel.sleep(0.01)

    if not has_tree_been_trained_before:
        update_steering_modifier()


@eel.expose
def send_user_params(parameters):
    # this function is intended to define filters over the dimensions of the data. We currently do
    # not have any use for this feature, but the eel endpoint exists.
    print("new user parameters received")


@eel.expose
def send_progression_state(state):
    global progression_state, PROGRESSTION_STATES

    if state == "ready":
        progression_state = PROGRESSTION_STATES["ready"]
    elif state == "running":
        progression_state = PROGRESSTION_STATES["running"]
    elif state == "paused":
        progression_state = PROGRESSTION_STATES["paused"]
    elif state == "done":
        progression_state = PROGRESSTION_STATES["done"]

    print("new progression state", state)


def start_eel():
    """Start Eel with development configuration."""

    directory = "../frontend/src"
    page = {"port": 3000}
    eel.init(directory, [".tsx", ".ts", ".jsx", ".js", ".html"])
    print("Backend launched successfully. Waiting for requests ...")

    # These will be queued until the first connection is made, but won"t be repeated on a page reload
    eel_kwargs = dict(
        host="localhost",
        port=8080,
        size=(1280, 800),
    )
    try:
        eel.start(page, mode=None, **eel_kwargs)
    except EnvironmentError:
        # If Chrome isn"t found, fallback to Microsoft Edge on Win10 or greater
        if sys.platform in ["win32", "win64"] and int(platform.release()) >= 10:
            eel.start(page, mode="edge", **eel_kwargs)
        else:
            raise


def get_numeric_columns():
    if USE_CASE is None:
        return

    # see https://duckdb.org/docs/sql/data_types/overview
    numeric_types = ["BIGINT", "DOUBLE", "HUGEINT", "INTEGER", "REAL", "SMALLINT", "TINYINT"]
    numeric_columns = []

    response = cursor.execute(f"DESCRIBE {USE_CASE.table_name};").fetchall()

    all_column_names = map(lambda t: t[0], response)
    all_column_types = map(lambda t: t[1], response)
    all_columns = list(zip(all_column_names, all_column_types))

    for col in all_columns:
        # avoid having duplicate id column, even if it's numeric
        if col[1] in numeric_types and col[0] != "id":
            numeric_columns.append(col[0])

    return numeric_columns


def register_dataset_as_view():
    print("importing data from "+USE_CASE.file_path+" ...")

    table = USE_CASE.table_name
    path = USE_CASE.file_path

    if USE_CASE.file_path.find(".csv") > 0:
        path = "read_csv_auto('"+path+"')"
    elif USE_CASE.file_path.find(".parquet") > 0:
        path = "parquet_scan('"+path+"')"

    id_columns = USE_CASE.get_pk_columns()
    filter = USE_CASE.get_view_filter()
    where_clause = f"WHERE {filter}" if len(filter) > 0 else ""

    # the server expects a unique column "id" to identify each item in the data. If the dataset of
    # a use case does not have that, we create one for the view here from the primary key.
    if len(id_columns) == 1 and id_columns[0] == "id":
        query = f"CREATE VIEW {table} AS SELECT * FROM {path} {where_clause};"
    else:
        subquery_id = f"CONCAT({','.join(id_columns)}) as id,"
        query = f"CREATE VIEW {table} AS SELECT {subquery_id} * FROM {path} {where_clause};"

    cursor.execute(query)


def load_use_case(use_case_label: str):
    global USE_CASE, numeric_columns

    # load the constructor from the global enum and create the use case object
    USE_CASE = USE_CASE_PRESETS[use_case_label]()

    # create a view on the dataset linked in the use case, on which all queries are run
    register_dataset_as_view()

    # update the list of numeric columns that are retrieved for every chunk
    numeric_columns = get_numeric_columns()

    # also create new empty table for plotted ids
    cursor.execute("CREATE TABLE plotted(id VARCHAR)")
    cursor.execute("CREATE TABLE plotted_random(id VARCHAR)")


if __name__ == "__main__":
    import sys

    # ensure that the label provided as a script parameter is valid
    known_use_cases = list(USE_CASE_PRESETS.keys())
    use_case_label = sys.argv[1] if len(sys.argv) > 1 else "airbnb"
    if use_case_label not in known_use_cases:
        raise Exception("Unknown use case. Please provide one of the following use cases: "+str(known_use_cases))

    load_use_case(use_case_label)

    if use_case_label == "airbnb":
        load_preset_scenarios(cursor)

    # Uses the production version in the "build" directory if passed a second argument
    start_eel()
