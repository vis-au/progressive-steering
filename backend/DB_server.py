import mysql.connector
import math
import time
import os
import platform
import random
import sys

import eel


#simple sync with Steering module
global modifier
global queryAtt
global treeReady #it is used to interrupt the main chunking cycle
treeReady=False

modifier='True'
modifier='price >69' #for testing chunks transicion

queryAtt='id, street, price, latitude, longitude'

USER_PW = 'password' # configure according to MySQL setup

global userLat
global userLon
global userRange
global userDay
global userMaxDistance
userMaxDistance=10 #likely this value should be included in the user


global plotted
global mydb

DIZ_plotted={}

#export from frontend
#export function sendDataChunk(chunk: any[]) {
#  dataManager.addData(chunk);
#}
#
#/**
# * Send the extent of the dimension mapped to the horizontal axis to the frontend.
# * @param extent minimum and maximum value for the dimension represented on the x axis.
# */
#export function sendXDomain(extent: number[]) {
#  const xDomain = dataManager.xDimension;
#  dataManager.setExtent(xDomain, extent);
#}
#
#/**
# * Send the extent of the dimension mapped to the vertical axis to the frontend.
# * @param extent minimum and maximum value for the dimension represented on the y axis.
# */
#export function sendYDomain(extent: number[]) {
#  const yDomain = dataManager.yDimension;
#  dataManager.setExtent(yDomain, extent);
#}
#
#/**
# * Send the lower and upper value bounds for a particular dimension of the data to the frontend.
# * @param message containing the name and extent of a dimension in the data
# */
#export function sendDimensionTotalExtent(message: {name: string, min: number, max: number}) {
#  const {name, min, max} = message;
#  dataManager.setExtent(name, [min, max]);
#  return;
#}
#
#/**
# * Sends the name of the dimension mapped to the horizontal axis to the frontend.
# * @param xName name of the x dimension
# */
#export function setXName(xName: string) {
#  dataManager.xDimension = xName;
#  return;
#}
#
#/**
# * Send the name of the dimension mapped to the vertical axis to the frontend.
# * @param yName name of the y dimension
# */
#export function setYName(yName: string) {
#  dataManager.yDimension = yName;
#}
#
#/**
# * Send the current value of an evaluation metric to the fronted.
# * @param message name and value of an evaluation metric
# */
#export function sendEvaluationMetric(message: {name: string, value: number}) {
#  return;
#}
#
#/**
# * Send the name of the city represented by the data and map to the fronted.
# * @param city name of the city
# */
#export function sendCity(city: string) {
#  return;
#}
#
#/**
# * Send the minimum number of points that must be contained in a selection to the frontend.
# * @param minSelectionSize minimum number of data poits to be contained in a filter selection.
# */
#export function setMinSelectionSize(minSelectionSize: number) {
#  return;
#}


#eel.sendXDomain(extent: number[])  #???
#eel.sendYDomain(extent: number[])  #???

#eel.sendEvaluationMetric(message: {name: string, value: number})

#eel.setMinSelectionSize(minSelectionSize: 5) #or ???


def sendChunk(chunk):
    eel.send_data_chunk(chunk)
    print('----------------------',len(chunk),chunk)
    pass


def distance(lat1, long1, lat2, long2, sleep=0.001):
    degrees_to_radians = math.pi/180.0
    phi1 = (90.0 - lat1)*degrees_to_radians
    phi2 = (90.0 - lat2)*degrees_to_radians
    theta1 = long1*degrees_to_radians
    theta2 = long2*degrees_to_radians
    cos = (math.sin(phi1)*math.sin(phi2)*math.cos(theta1 - theta2) +
    math.cos(phi1)*math.cos(phi2))
    arc = math.acos( cos )
    time.sleep(sleep)
    return int(arc * 6371*1000)/1000

def dbConnect(h,u,p,d):
    global mydb
    mydb = mysql.connector.connect(
       host=h,
       user=u,
       passwd=p,
       database=d
     )
    return mydb

def aboveMinimum(bbId,actualPrice,lat,long,more=0.3,chunkSize=50):
    mycursor = mydb.cursor()
    qq=buildQuery(userLat,userLon,userRange,userDay,queryAtt,'True',chunkSize)
    mycursor.execute(qq)
    myresult = mycursor.fetchall()
    minimo=actualPrice
    minimoX=(bbId,0)
    for x in myresult:
        if 0 < distance(userLat,userLon,x[3],x[4])-distance(userLat,userLon,lat,long)<=more:
            minimo=min(minimo,x[2])
            minimoX=(x[0],distance(userLat,userLon,x[3],x[4])-distance(userLat,userLon,lat,long))
    return {"neighborhood_min":minimo,"saving":actualPrice-minimo,"alternativeId":minimoX[0],"extraSteps":minimoX[1]}

def buildQuery(userLat,userLon,userRange,userDay,att,modifier,chunkSize):
    global LIMIT
    SELECT = "SELECT "+att+"  "
    FROM   = "FROM listings "
    WHERE  = "WHERE price >="+str(userRange[0])+" AND price <="+str(userRange[1])+"  AND id NOT IN (SELECT id from plotted ) "
    LIMIT  = "LIMIT 0,50"
    return SELECT+' '+FROM+' '+ WHERE + ' AND '+modifier+' LIMIT 0,'+str(chunkSize)

def feedTuples(query,chunkSize):
    global modifier
    global DIZ_plotted
    global treeReady #it is used to interrupt the main chunking cycle
    mydb=dbConnect("localhost",'root', USER_PW,'airbnb')
    mycursor = mydb.cursor()
    mycursor.execute('DELETE FROM plotted')
    mydb.commit()
    plotted=0
    chunks=0
    mycursor.execute(query)
    myresult = mycursor.fetchall()

    while len(myresult)>0 and not treeReady:
         chunks+=1
         actualChunk={}
         for x in myresult:
           mycursor.execute('INSERT INTO plotted (id) VALUES (' +str(x[0])+')')
           print(chunks,x,'distance=',distance(userLat,userLon,x[3],x[4]),'aboveM=',aboveMinimum(x[0],x[2],userLat,userLon,1.5))

           DIZ_plotted[x[0]]={'chunk':chunks,'values':x, 'dist2user':distance(userLat,userLon,x[3],x[4]), 'aboveM':aboveMinimum(x[0],x[2],userLat,userLon,0.5)}

           actualChunk[x[0]]={'chunk':chunks,'values':x, 'dist2user':distance(userLat,userLon,x[3],x[4]), 'aboveM':aboveMinimum(x[0],x[2],userLat,userLon,0.5)}

           plotted+=1
           mydb.commit()

           if chunks==2:
               treeReady=True  #sumulate decision tree intervention,should be set by the Steering module
         sendChunk(actualChunk)
         mycursor.execute(query)
         myresult = mycursor.fetchall()

    print('plotted',plotted,'tuples in',chunks,'chunks')
    modifier='True'            #should be set by the Steering module
    query=buildQuery(userLat,userLon,userRange,userDay,queryAtt,modifier,chunkSize)
    mycursor.execute(query)
    myresult = mycursor.fetchall()
    while len(myresult)>0 and chunks <10:
         chunks+=1
         actualChunk={}
         for x in myresult:
           mycursor.execute('INSERT INTO plotted (id) VALUES (' +str(x[0])+')')
           #print('--',x,x[4])
           print(chunks,x,'distance=',distance(userLat,userLon,x[3],x[4]),'aboveM=',aboveMinimum(x[0],x[2],userLat,userLon,0.5))
           DIZ_plotted[x[0]]={'chunk':chunks,'values':x, 'dist2user':distance(userLat,userLon,x[3],x[4]), 'aboveM':aboveMinimum(x[0],x[2],userLat,userLon,0.5)}
           plotted+=1
           actualChunk[x[0]]={'chunk':chunks,'values':x, 'dist2user':distance(userLat,userLon,x[3],x[4]), 'aboveM':aboveMinimum(x[0],x[2],userLat,userLon,0.5)}
           mydb.commit()
         sendChunk(actualChunk)
         mycursor.execute(query)
         myresult = mycursor.fetchall()
    print('plotted',plotted,'tuples in',chunks,'chunks')

@eel.expose
def send_to_backend_userData(x):
  global userLat
  global userLon
  global userRange
  global userDay
  global userMaxDistance

  print("received user selection",x)

  userLat=x['lat']
  userLon=x['lon']
  userRange=x['moneyRange']
  userDay=x['day']
  userMaxDistance=x['userMaxDistance']

  # send parameters to frontend before sending data
  eel.send_city("Paris")
  eel.set_x_name("Saving opportunity")
  eel.set_y_name("Distance")
  eel.set_min_selection_size({"name": "Distance", "min": 0, "max": 10}) #max value  deserves more thinking
  eel.send_dimension_total_extent({"name": "Saving opportunity", "min": 0, "max": 1000})
  eel.send_dimension_total_extent({"name": "Distance", "min": 0, "max": 1000})

  #eel.set_min_selection_size({"name": "Saving opportunity", "min": 0, "max": x["moneyRange"][1]-["moneyRange"][0]})

  sql=buildQuery(userLat,userLon,userRange,userDay,queryAtt,modifier,10)
  feedTuples(sql,10)

@eel.expose
def send_user_selection(selected_items):
    print("new selected items received")

@eel.expose
def send_selection_bounds(x_bounds, y_bounds):
    print("new selected region received")

@eel.expose
def send_user_params(parameters):
    print("new user parameters received")

def start_eel(develop):
    """Start Eel with either production or development configuration."""

    if develop:
        directory = '../frontend/src'
        app = None
        page = {'port': 3000}
    else:
        directory = 'build'
        app = 'chrome-app'
        page = 'index.html'

    eel.init(directory, ['.tsx', '.ts', '.jsx', '.js', '.html'])

    print('Backend launched successfully. Waiting for requests ...')

    # These will be queued until the first connection is made, but won't be repeated on a page reload
    eel.say_hello_js('Python World!')   # Call a JavaScript function (must be after `eel.init()`)

    eel_kwargs = dict(
        host='localhost',
        port=8080,
        size=(1280, 800),
    )
    try:
        eel.start(page, mode=None, **eel_kwargs)
    except EnvironmentError:
        # If Chrome isn't found, fallback to Microsoft Edge on Win10 or greater
        if sys.platform in ['win32', 'win64'] and int(platform.release()) >= 10:
            eel.start(page, mode='edge', **eel_kwargs)
        else:
            raise


if __name__ == '__main__':
    import sys

    # Uses the production version in the "build" directory if passed a second argument
    start_eel(develop=len(sys.argv) == 1)
