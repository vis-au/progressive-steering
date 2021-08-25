import platform
import eel
import duckdb
import pandas as pd
import numpy as np

import steering_duckdb as steer
from use_cases.use_case import UseCase
from use_cases.airbnb import UseCaseAirbnb
from use_cases.spotify import UseCaseSpotify
from use_cases.taxis import UseCaseTaxis
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

# each item in the data is required to have a unique identifier column ID
ID = "id"

# names of helper tables used to store information about data inside/outside the selection
PLOTTED = "plotted" # for steerable progression
PLOTTED_RANDOM = "plotted_random" # for random progression

# we reorder the columns when loading the data such that a unique id sits at position 0
ID_COLUMN_INDEX = 0

# isomorphic term added to queries while no steering query has been genereated
DEFAULT_MODIFIER = "True"

# phases that the steering can be in
IN_NON_STEERING_PHASE = "flushing"
IN_ACTIVATION_PHASE = "collectingData"
IN_STEERING_PHASE = "usingTree"

# enum of states for progression
READY = "ready"
RUNNING = "running"
PAUSED = "paused"
DONE = "done"
PROGRESSTION_STATES = {
    READY: 0,
    RUNNING: 1,
    PAUSED: 2,
    DONE: 3
}

# meta properties added to processed data items
CHUNK_PROP = "chunk" # indicates the chunk an item was retrieved in
INSIDE_PROP = "inside" # indicates whether an item is inside/outside the selection
STATE_PROP = "state" # indicates state of progression during an item's retrieval

# user constants
user_parameters={}

# Global variables
plotted_points = {} # all plotted points
selected_points = [] # cumulated airb&b ID of points plotted in the user box till the actual chunk

user_selection_updated = False # new box
total_inside_box = 0 # number of points plotted in the user box till the actual chunk
has_tree_been_trained_before = False # it is used to interrupt the initial chunking cycle
chunk_size = 100 # number of points retrieved per chunk
modifier = DEFAULT_MODIFIER # modify initial query with conditions coming from the tree
numeric_columns = [] # list of all columns containing numeric values
use_floats_for_savings = True

# progression state can be paused/restarted interactively by the user
progression_state = PROGRESSTION_STATES[READY]

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
  SELECT = f'SELECT {ID},"'+'","'.join(include_columns)+'"'
  FROM   = f"FROM {USE_CASE.table_name}"
  WHERE  = f"WHERE {USE_CASE.table_name}.id NOT IN (SELECT {ID} from {plotted_db})"

  for p in user_parameters:
      param = str(p)
      value = user_parameters[p]

      if isinstance(value, list):
          min_value = str(value[0])
          max_value = str(value[1])
          WHERE += f" AND {param} >= {min_value} AND {param} <= {max_value}"
      elif isinstance(value, str):
          WHERE += f" AND {param} = {value}"
      elif isinstance(value, (int, float, complex)):
          WHERE += f" AND {param} = {str(value)}"

  if use_modifier:
    return f"{SELECT} {FROM} {WHERE}  AND {modifier} LIMIT {str(chunk_size)}"
  else:
    return f"{SELECT} {FROM} {WHERE} LIMIT {str(chunk_size)}"


def reset():
    global plotted_points, selected_points, user_selection_updated, total_inside_box
    global has_tree_been_trained_before, chunk_size, modifier, use_floats_for_savings
    global numeric_columns, progression_state

    print("resetting global state")

    plotted_points = {}
    selected_points = []

    user_selection_updated = False
    total_inside_box = 0
    has_tree_been_trained_before = False
    chunk_size = 100
    modifier = DEFAULT_MODIFIER
    numeric_columns = get_numeric_columns()
    use_floats_for_savings = True

    progression_state = PROGRESSTION_STATES[READY]


def tuple_to_dict(tuple, steering_phase, chunk_number):
    # first use the use-case-specific transform function to generate the dict that is send to the
    # frontend from the touple
    include_columns = numeric_columns + USE_CASE.get_additional_columns()
    transformed_dict = USE_CASE.get_dict_for_use_case(tuple, [ID]+include_columns)

    # then add the required properties
    transformed_dict[CHUNK_PROP] = chunk_number
    transformed_dict[STATE_PROP] = steering_phase
    transformed_dict[INSIDE_PROP] = 0

    return transformed_dict


def mark_results_as_plotted(steered_result, random_result):
    results = [steered_result, random_result]
    tables = [PLOTTED, PLOTTED_RANDOM]

    for result, table in zip(results, tables):
        ids = [str(tuple[ID_COLUMN_INDEX]) for tuple in result]
        value_string = "('"+"'),('".join(ids)+"')"

        # only run the query if there are actual values to insert, otherwise there will be an error.
        if len(ids) > 0:
            cursor.execute(f"INSERT INTO {table} ({ID}) VALUES {value_string};")


def get_items_inside_selection_at_chunk(chunk):
    inb = 0

    for k in plotted_points:
        if plotted_points[str(k)][INSIDE_PROP]==1 and plotted_points[str(k)][CHUNK_PROP]==chunk:
            inb+=1

    return inb


def was_progression_reset_during_sleep():
    while progression_state == PROGRESSTION_STATES[PAUSED]:
        eel.sleep(1)
    if progression_state == PROGRESSTION_STATES[READY]:
        return True
    elif progression_state == PROGRESSTION_STATES[DONE]:
        return True

    return False


def send_results_to_frontend(chunk_number, steered_result, random_result, steering_phase):
    global plotted_points

    chunk = {}
    random_chunk = {}

    for tuple in steered_result:
        plotted_points[str(tuple[ID_COLUMN_INDEX])]=tuple_to_dict(tuple, steering_phase, chunk_number)
        chunk[str(tuple[ID_COLUMN_INDEX])]={
            CHUNK_PROP: chunk_number,
            STATE_PROP: steering_phase,
            "values": plotted_points[str(tuple[ID_COLUMN_INDEX])]
        }

    # ensure equal chunk size between random and steered chunk
    for tuple in random_result:
        random_chunk[str(tuple[ID_COLUMN_INDEX])] = {
            CHUNK_PROP: chunk_number,
            "values": tuple_to_dict(tuple, steering_phase, chunk_number)
        }

    send_chunks(chunk, random_chunk)


def get_next_result(chunk_number, steering_phase, steered_query, random_query):
    global total_inside_box, selected_points

    cursor.execute(steered_query)
    steered_result = cursor.fetchall()
    cursor.execute(random_query)
    random_result = cursor.fetchall()

    if len(steered_result) < len(random_result):
        random_result = random_result[0:len(steered_result)]

    send_results_to_frontend(chunk_number, steered_result, random_result, steering_phase)
    mark_results_as_plotted(steered_result, random_result)

    # IMPORTANT: within this waiting period, the backend receives the "in-/outside" information by
    # the frontend, which influences precision/insde calculation below
    eel.sleep(WAIT_INTERVAL)
    if was_progression_reset_during_sleep():
        return None

    recent_inside = get_items_inside_selection_at_chunk(chunk_number)
    total_inside_box += recent_inside
    precision = recent_inside/chunk_size
    print("chunk:", chunk_number, steering_phase, "in selection:", total_inside_box, "Precision:", precision)

    send_statistics_to_frontend(precision, total_inside_box)

    return steered_result


def run_steered_progression(chunk_size):
    global progression_state, modifier, total_inside_box

    chunk = 0
    steered_query = build_query(chunk_size, PLOTTED, True)
    random_query = build_query(chunk_size, PLOTTED_RANDOM, True)

    min_box_items = USE_CASE.get_min_points_before_training()

    # reset databases of plotted points
    cursor.execute(f"DELETE FROM {PLOTTED}")
    cursor.execute(f"DELETE FROM {PLOTTED_RANDOM}")
    progression_state = PROGRESSTION_STATES[READY]

    # wait until user starts progression
    while progression_state == PROGRESSTION_STATES[READY]:
        eel.sleep(.1)
        # HACK: if the user reloads the page, the state variable is briefly set to DONE before a
        # new progression is spawned, causing this function to return, which terminates its "thread"
        if progression_state == PROGRESSTION_STATES[DONE]:
            return

    ####################### NON-STEERING PHASE #####################################################
    print("Entering NON-STEERING PHASE 1 - Query:", steered_query, modifier)
    print("user parameters:", user_parameters)
    steering_phase=IN_NON_STEERING_PHASE
    modifier=DEFAULT_MODIFIER
    steered_query = build_query(chunk_size, PLOTTED, True)
    random_query = build_query(chunk_size, PLOTTED_RANDOM, True)
    my_result = []
    my_result_empty = False

    while not my_result_empty and (not has_tree_been_trained_before or total_inside_box<min_box_items or len(modifier)<=3) and len(selected_points) == 0:
        my_result = get_next_result(chunk, steering_phase, steered_query, random_query)
        chunk += 1
        if my_result is None:
            return
        my_result_empty = len(my_result) == 0

    ####################### ACTIVATION PHASE #######################################################
    print("Entering ACTIVATION PHASE - Query:", steered_query, modifier)
    print(steered_query)
    total_inside_box=0
    steering_phase=IN_ACTIVATION_PHASE
    my_result_empty = False

    while not my_result_empty and (not has_tree_been_trained_before or total_inside_box<min_box_items or len(modifier)<=3):
        my_result = get_next_result(chunk, steering_phase, steered_query, random_query)
        chunk += 1
        if my_result is None:
            return
        my_result_empty = len(my_result) == 0

    print("Exiting ACTIVATION PHASE")

    ########################## STEERING PHASE ######################################################
    steering_phase=IN_STEERING_PHASE
    steered_query=build_query(chunk_size, PLOTTED, True)
    print("Entering STEERING PHASE - Query:", steered_query, len(my_result))
    my_result_empty = False

    while not my_result_empty:
        my_result = get_next_result(chunk, steering_phase, steered_query, random_query)
        chunk += 1
        if my_result is None:
            return
        my_result_empty = len(my_result) == 0

    print("Exiting STEERING PHASE")

    ######################### NON-STEERING PHASE ###################################################
    steering_phase=IN_NON_STEERING_PHASE
    modifier=DEFAULT_MODIFIER
    steered_query=build_query(chunk_size, PLOTTED, True)
    print("Entering NON-STEERING PHASE 2", has_tree_been_trained_before, "modifier =", modifier)
    my_result_empty = False

    while not my_result_empty:
        my_result = get_next_result(chunk, steering_phase, steered_query, random_query)
        chunk += 1
        if my_result is None:
            return
        my_result_empty = len(my_result) == 0

    print("Exiting NON-STEERING PHASE 2")
    print(DONE)

    return


def start_progression():
    global progression_state

    while True:
        reset()
        # HACK: set the state variable to DONE here, in order to terminate all progression
        # "threads" currently running, ensuring that only a single progression is run over the data.
        progression_state = PROGRESSTION_STATES[DONE]
        eel.sleep(.1)
        eel.spawn(run_steered_progression(chunk_size))
        if progression_state == PROGRESSTION_STATES[DONE]:
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

    total_size = USE_CASE.get_total_dataset_size()

    # if use case does not specify a size, compute it dynamically.
    if total_size < 0:
        total_size = cursor.execute(f"SELECT COUNT(*) FROM {USE_CASE.table_name};").fetchall()[0][0]

    eel.send_total_data_size(total_size)

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
    modifier=f"({steer.get_steering_condition(features, of_interest_np, 'sql')})"

    if len(modifier)>3:
        has_tree_been_trained_before=True
    else:
        modifier = DEFAULT_MODIFIER

    return modifier


@eel.expose
def send_user_selection(selected_item_ids: list):
    global plotted_points
    global selected_points

    if len(selected_item_ids)==0:
        return (0)

    print(len(selected_item_ids), "new selected items received...")

    for id in selected_item_ids:
        plotted_points[str(id)][INSIDE_PROP]=1

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
def send_progression_state(new_state):
    global progression_state, PROGRESSTION_STATES

    if new_state == READY:
        progression_state = PROGRESSTION_STATES[READY]
    elif new_state == RUNNING:
        progression_state = PROGRESSTION_STATES[RUNNING]
    elif new_state == PAUSED:
        progression_state = PROGRESSTION_STATES[PAUSED]
    elif new_state == DONE:
        progression_state = PROGRESSTION_STATES[DONE]

    print("new progression state", new_state)


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
        if col[1] in numeric_types and col[0] != ID:
            numeric_columns.append(col[0])

    return numeric_columns


def register_dataset_as_view():
    print(f"importing data from {USE_CASE.file_path} ...")

    table = USE_CASE.table_name
    path = USE_CASE.file_path

    if USE_CASE.file_path.find(".csv") > 0:
        path = f"read_csv_auto('{path}')"
    elif USE_CASE.file_path.find(".parquet") > 0:
        path = f"parquet_scan('{path}')"

    id_columns = USE_CASE.get_pk_columns()
    filter = USE_CASE.get_view_filter()
    where_clause = f"WHERE {filter}" if len(filter) > 0 else ""

    # the server expects a unique column ID to identify each item in the data. If the dataset of
    # a use case does not have that, we create one for the view here from the primary key.
    if len(id_columns) == 1 and id_columns[0] == ID:
        query = f"CREATE VIEW {table} AS SELECT * FROM {path} {where_clause};"
    else:
        subquery_id = f"CONCAT({','.join(id_columns)}) as {ID}"
        query = f"CREATE VIEW {table} AS SELECT {subquery_id}, * FROM {path} {where_clause};"

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
    cursor.execute(f"CREATE TABLE {PLOTTED}({ID} VARCHAR UNIQUE PRIMARY KEY)")
    cursor.execute(f"CREATE TABLE {PLOTTED_RANDOM}({ID} VARCHAR UNIQUE PRIMARY KEY)")


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
