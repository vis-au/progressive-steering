import duckdb
import math
import platform
import steering_module as sm
import eel

# initialize the database connection
cursor = duckdb.connect()
listings_df = cursor.execute("SELECT * FROM read_csv_auto('../data/listings_alt.csv');").fetchdf()
cursor.register("listings", listings_df)
cursor.execute("CREATE TABLE plotted(id VARCHAR)")

# enum of states for progression
PROGRESSTION_STATES = {
    "ready": 0,
    "running": 1,
    "paused": 2,
    "done": 3
}

# Global variables
DIZ_plotted={} #a ll plotted points
IN=[] # cumulated airb&b ID of points plotted in the user box till the actual chunk
user_selection_updated=False # new box
total_chunk_number=0
total_inside_box=0 # number of points plotted in the user box till the actual chunk
tree_ready=False # it is used to interrupt the initial chunking cycle
chunk_size=100
modifier="True" # modify initial query with conditions coming from the tree
query_att="*" # attributes of the main query
last_selected_items=[]
float_saving=None
double_sending=True

# progression state can be paused/restarted interactively by the user
progression_state = PROGRESSTION_STATES["ready"]

# user data for test
user_lat = 48.85565
user_lon = 2.365492
user_range = [60, 90]
user_day = "2020-04-31"
user_max_distance = 10 + 1
c={
    "lat": user_lat,
    "lon": user_lon,
    "range": user_range,
    "day": user_day,
    "MaxDistance": user_max_distance
}

# user selection in view coordinates
X1 = -1
X2 = -1
Y1 = -1
Y2 = -1


def send_chunk(chunk):
    eel.send_data_chunk(chunk)


def send_random_chunk(chunk):
    eel.send_random_data_chunk(chunk)


def distance(lat1, long1, lat2, long2):
    degrees_to_radians = math.pi/180.0
    phi1 = (90.0 - lat1)*degrees_to_radians
    phi2 = (90.0 - lat2)*degrees_to_radians
    theta1 = long1*degrees_to_radians
    theta2 = long2*degrees_to_radians
    cos = (math.sin(phi1)*math.sin(phi2)*math.cos(theta1 - theta2) +
    math.cos(phi1)*math.cos(phi2))
    arc = math.acos( cos )
    return int(arc * 6371*1000)/1000


def above_m(saving, saving_as_float): # the search is bound to a
    return {
        "neighborhood_min": 5,
        "saving": saving_as_float if float_saving else saving,
        "alternativeId": 100,
        "extraSteps": 0.1,
        "vicini": 100
    }


def build_query(user_range, att, modifier, chunk_size):
    SELECT = "SELECT "+att+"  "
    FROM   = "FROM listings "
    WHERE  = "WHERE price >="+str(user_range[0])+" AND price <="+str(user_range[1])+"  AND listings.id NOT IN (SELECT id from plotted ) "
    return SELECT+" "+FROM+" "+WHERE+" AND "+modifier+" LIMIT "+str(chunk_size)


def reset():
    global user_selection_updated, total_chunk_number, total_inside_box, tree_ready, chunk_size
    global modifier, query_att, IN, DIZ_plotted

    IN = []
    DIZ_plotted = {}
    user_selection_updated = False
    total_chunk_number = 0
    total_inside_box = 0
    tree_ready = False
    chunk_size = 100
    modifier = "True"
    query_att = "*"


def airbnb_tuple_to_dict(tuple, state, chunk):
    return {
        "host_id": tuple[0],
        "state": state,
        "zipcode": tuple[7],
        "latitude": tuple[10],
        "longitude": tuple[11],
        "accommodates": tuple[12],
        "bathrooms": tuple[13],
        "bedrooms": tuple[14],
        "beds": tuple[15],
        "price": tuple[16],
        "cleaning_fee": tuple[18],
        "minimum_nights": tuple[21],
        "maximum_nights": tuple[22],
        # "dist2user": distance(user_lat, user_lon, tuple[10], tuple[11]),
        "dist2user": tuple[44],
        "aboveM": above_m(tuple[45], tuple[46]),
        "chunk": chunk,
        "inside": 0
    }


def mark_ids_plotted(result):
    value_string = ""
    for i, tuple in enumerate(result):
        value_string += "("+str(tuple[0])+"), " if i < len(result)-1 else "("+str(tuple[0])+");"

    cursor.execute("INSERT INTO plotted (id) VALUES "+value_string)


def process_result(chunk_number, result, state):
    global DIZ_plotted
    global total_inside_box

    chunk = {}

    for tuple in result:
        DIZ_plotted[tuple[0]]=airbnb_tuple_to_dict(tuple, state, chunk_number)
        chunk[tuple[0]]={
            "chunk": chunk_number,
            "state": state,
            "values": DIZ_plotted[tuple[0]],
            "dist2user": tuple[44],
            "aboveM": above_m(tuple[45], tuple[46])
        }

    send_chunk(chunk)
    return chunk_number


def process_random_result(chunk_number, random_result, state):
    state = "random_("+state+")"
    chunk = {}

    for tuple in random_result[chunk_number*chunk_size:(chunk_number+1)*chunk_size]:
        chunk[tuple[0]] = {
            "chunk": chunk_number,
            "state": state,
            "values": airbnb_tuple_to_dict(tuple, state, chunk_number),
            "dist2user": tuple[44],
            "aboveM": above_m(tuple[45], tuple[46])
        }

    send_random_chunk(chunk)


def get_items_inside_selection_at_chunk(chunk):
    inb = 0

    for k in DIZ_plotted:
        if DIZ_plotted[k]["inside"]==1 and DIZ_plotted[k]["chunk"]==chunk:
            inb+=1

    return inb


def was_progression_reset_during_pause():
    while progression_state == PROGRESSTION_STATES["paused"]:
        eel.sleep(1)
    if progression_state == PROGRESSTION_STATES["ready"]:
        return True

    return False


def progress_over_dataset(chunk_number, result, random_result, state, query):
    global total_inside_box, IN

    chunk_number += 1
    process_result(chunk_number, result, state)
    if double_sending:
        process_random_result(chunk_number, random_result, state)

    mark_ids_plotted(result)

    # IMPORTANT: within this waiting period, the backend receives the "in-/outside" information by
    # the frontend, which influences precision/insde calculation below
    eel.sleep(1)
    if was_progression_reset_during_pause():
        return None, None

    recent_inside = get_items_inside_selection_at_chunk(chunk_number)
    total_inside_box += recent_inside
    print("chunk:", chunk_number, state, "items in selection:", total_inside_box, "Precision:", recent_inside/chunk_size, recent_inside, distances())

    eel.send_evaluation_metric({"name": "precision", "value": recent_inside/chunk_size})
    eel.send_evaluation_metric({"name": "recall", "value": total_inside_box})

    cursor.execute(query)
    result = cursor.fetchall()

    return chunk_number, result


def run_steered_progression(query, chunkSize, min_box_items=50):
    global modifier, DIZ_plotted, tree_ready, total_inside_box, total_chunk_number
    global progression_state, PROGRESSTION_STATES, double_sending

    double_sending=True
    chunk=0

    # reset database of plotted points
    cursor.execute("DELETE FROM plotted")

    # wait until user starts progression
    while progression_state == PROGRESSTION_STATES["ready"]:
        eel.sleep(1)

    if double_sending: #compute the whole results
        queryA=query.replace("AND True LIMIT 100", "")
        queryA=query[0: query.find("LIMIT")]
        cursor.execute(queryA)

        print(queryA, query)
        my_result_random = cursor.fetchall()

    ####################### NON-STEERING PHASE #####################################################
    print("Entering LOOP0 - Query:", query, modifier)
    print("c", c)
    state="flushing"
    modifier="True"
    query=build_query(user_range, query_att, modifier, chunkSize)
    cursor.execute(query)
    my_result = cursor.fetchall()

    while len(my_result)>0 and (not tree_ready or total_inside_box<min_box_items or len(modifier)<=3) and len(IN) == 0:
        chunk, my_result = progress_over_dataset(chunk, my_result, my_result_random, state, query)
        if my_result is None:
            return

    ####################### ACTIVATION PHASE #######################################################
    print("Entering ACTIVATION PHASE - Query:", query, modifier)
    print("c", c)
    print(query)
    total_inside_box=0
    state="collectingData"

    while len(my_result)>0 and (not tree_ready or total_inside_box<min_box_items or len(modifier)<=3):
        chunk, my_result = progress_over_dataset(chunk, my_result, my_result_random, state, query)
        if my_result is None:
            return

    print("Exiting ACTIVATION PHASE")
    total_chunk_number=chunk

    ########################## STEERING PHASE ######################################################
    state="usingTree"
    query=build_query(user_range, query_att, modifier, chunkSize)
    cursor.execute(query)
    my_result = cursor.fetchall()
    print("Entering STEERING PHASE - Query: ", query, len(my_result))

    while len(my_result)>0:
        chunk, my_result = progress_over_dataset(chunk, my_result, my_result_random, state, query)
        if my_result is None:
            return

    print("Exiting STEERING PHASE")
    total_chunk_number=chunk

    ######################### NON-STEERING PHASE ###################################################
    state="flushing"
    modifier="True"
    query=build_query(user_range, query_att, modifier, chunkSize)
    cursor.execute(query)
    my_result = cursor.fetchall()
    print("Entering NON-STEERING PHASE 2", tree_ready, "modifier=", modifier)

    while len(my_result)>0:
        chunk, my_result = progress_over_dataset(chunk, my_result, my_result_random, state, query)
        if my_result is None:
            return

    print("Exiting NON-STEERING PHASE 2")
    total_chunk_number=chunk


def start_progression():
    global progression_state

    while True:
        reset()
        sql=build_query(user_range, query_att, modifier, chunk_size)
        progression_state = PROGRESSTION_STATES["ready"]
        eel.spawn(run_steered_progression(sql, chunk_size))


def encodeTestCases(testCases):
    r={}
    for i in range(len(testCases)):
        r["testcase"+str(i+1)]={"name": "case"+str(i+1)+"_"+str(testCases[i]["boxMinRange"])+"_"+str(testCases[i]["boxMaxRange"])+"_"+str(testCases[i]["boxMinDistance"])+"_"+str(testCases[i]["boxMaxDistance"]),
          "x_bounds":[testCases[i]["boxMinRange"], testCases[i]["boxMaxRange"]], "y_bounds":[testCases[i]["boxMinDistance"], testCases[i]["boxMaxDistance"]]}
    return r


@eel.expose
def get_use_cases():
    return encodeTestCases(testCases)


@eel.expose
def send_to_backend_userData(x):
  global user_lat
  global user_lon
  global user_range
  global user_day
  global user_max_distance
  c={"lat": 48.85565, "lon": 2.365492, "range": [60, 90], "day": "2020-04-31", "MaxDistance":10+1}
  print("received user selection", c)

  user_lat=x["lat"]
  user_lon=x["lon"]
  user_range=x["moneyRange"]
  user_day=x["day"]
  user_max_distance=x["userMaxDistance"]

  user_lat=c["lat"]
  user_lon=c["lon"]
  user_range=c["range"]
  user_day=c["day"]
  user_max_distance=c["MaxDistance"]

  # send parameters to frontend before sending data
  eel.send_city("Paris")
  eel.set_x_name("Saving opportunity")
  eel.set_y_name("Distance")
  eel.send_dimension_total_extent({"name": "Saving opportunity", "min": -1, "max": 2+user_range[1]-user_range[0]})
  eel.send_dimension_total_extent({"name": "Distance", "min": 0, "max": 10})
  eel.send_dimension_total_extent({"name": "price", "min": 50, "max": 95})
  eel.send_dimension_total_extent({"name": "cleaning_fee", "min": 0, "max": 325})
  eel.send_dimension_total_extent({"name": "bedrooms", "min": 0, "max": 4})
  eel.send_dimension_total_extent({"name": "bathrooms", "min": 0, "max": 4})
  eel.send_dimension_total_extent({"name": "beds", "min": 0, "max": 5})
  eel.send_dimension_total_extent({"name": "accommodates", "min": 0, "max": 5})
  eel.send_dimension_total_extent({"name": "longitude", "min": 2.2, "max": 2.5})
  eel.send_dimension_total_extent({"name": "latitude", "min": 48.8, "max": 49})
  eel.send_dimension_total_extent({"name": "zipcode", "min": 74400, "max": 750011})

  start_progression()


@eel.expose
def send_user_selection(selected_item_ids):
    global last_selected_items
    global DIZ_plotted
    global modifier
    global tree_ready
    global IN

    if len(selected_item_ids)==0:
        return(0)

    last_selected_items=selected_item_ids.copy()
    print("new", len(selected_item_ids), "items received...", selected_item_ids)

    for k in selected_item_ids:
        DIZ_plotted[k]["inside"]=1

    IN.extend(selected_item_ids)

    eel.sleep(0.01)

    # FIXME: the code below can be used together with the generalized steering module that uses
    #        pandas and numpy instead of dicts
    # plotted_list = []
    # of_interest_list = []

    # for id in DIZ_plotted:
    #     plotted_list.append(DIZ_plotted[id])
    #     of_interest_list.append(1 if id in IN else 0)

    # plotted = pd.DataFrame(plotted_list)
    # of_interest = np.array(of_interest_list)
    # features = plotted.loc[:,['zipcode', 'latitude', 'longitude','price']]
    # modifier="("+steer.get_steering_condition(features, of_interest, "sql")+")"
    modifier="("+sm.getSteeringCondition(DIZ_plotted)+")"

    if len(modifier)>3:
        tree_ready=True
    else:
        modifier="True"

    return modifier


@eel.expose
def send_selection_bounds(x_bounds, y_bounds):
    global X1, X2, Y1, Y2
    global total_inside_box
    global DIZ_plotted
    global user_selection_updated
    global last_selected_items

    print("new selected region received bounds", x_bounds, y_bounds)
    X1=x_bounds["xMin"]
    X2=y_bounds["yMin"]
    Y1=y_bounds["yMax"]
    Y2=x_bounds["xMax"]

    total_inside_box=0
    for k in DIZ_plotted:
        DIZ_plotted[k]["inside"]=0
        if k in last_selected_items:
            DIZ_plotted[k]["inside"]=1
            total_inside_box+=1

    user_selection_updated=True
    return x_bounds, y_bounds


@eel.expose
def send_selection_bounds_values(x_bounds_val, y_bounds_val):
    global total_inside_box
    global DIZ_plotted
    print("new selected region received_pixel", x_bounds_val, y_bounds_val)
    return x_bounds_val, y_bounds_val


@eel.expose
def send_user_params(parameters):
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

    print("new progression state", progression_state)


def get_box_data(test_case):
    global user_range
    qq = str("SELECT * FROM listings WHERE price>="+str(user_range[0])+" and price <=" +str(user_range[1])+" and abovemF<="+str(test_case["boxMaxRange"])+
             " and abovemF>="+str(test_case["boxMinRange"]) +" and distance>="+str(test_case["boxMinDistance"])+" and distance<="+str(test_case["boxMaxDistance"]))
    cursor.execute(qq)
    myresult = cursor.fetchall()
    tuplesF=len(myresult)

    qq = str("SELECT * FROM listings WHERE price>="+str(user_range[0])+" and price <=" +str(user_range[1])+" and abovem<="+str(test_case["boxMaxRange"])+
             " and abovem>="+str(test_case["boxMinRange"]) +" and distance>="+str(test_case["boxMinDistance"])+" and distance<="+str(test_case["boxMaxDistance"]))
    cursor.execute(qq)
    myresult = cursor.fetchall()
    tuples=len(myresult)
    return tuples, tuplesF


def load_config():
    global float_saving
    global testCases
    s=eval(open("DB_server_config.txt", encoding="UTF8").read())
    float_saving=s["floatSaving"]
    testCases=eval(open("testCases.txt", encoding="UTF8").read())
    print("Configuration loaded")
    print("floatSaving: ", float_saving)
    print("testCases loaded")
    for i in range(len(testCases)):
        t=get_box_data(testCases[i])
        testCases[i]["tuples"]=t[0]
        testCases[i]["tuplesF"]=t[1]
        print(i+1, testCases[i])
    f=open("testCases.txt", "w", encoding="UTF8")
    print(str(testCases).replace("{", "\n{"), file=f)
    f.close()



def start_eel(develop):
    """Start Eel with either production or development configuration."""

    print(develop)

    if develop:
        directory = "../frontend/src"
        app = None
        page = {"port": 3000}
    else:
        directory = "build"
        app = "chrome-app"
        page = "index.html"


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

def distances():
    global DIZ_plotted
    mind=100
    maxd=0
    for k in DIZ_plotted:
        if DIZ_plotted[k]["dist2user"]>maxd and DIZ_plotted[k]["inside"]==1:
            maxd=DIZ_plotted[k]["dist2user"]
        if DIZ_plotted[k]["dist2user"]<mind and DIZ_plotted[k]["inside"]==1:
            mind=DIZ_plotted[k]["dist2user"]
    return mind, maxd


if __name__ == "__main__":
    import sys
    load_config()

    # Uses the production version in the "build" directory if passed a second argument
    start_eel(develop=len(sys.argv) == 1)
