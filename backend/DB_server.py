import mysql.connector
import math
import time
import os
import platform
import random
import sys
import steering_module as sm

#**********************************************************

#**********************************************************




import eel
from threading import Thread


#simple sync with Steering module
global modifier
global queryAtt
global treeReady #it is used to interrupt the main chunking cycle
global bBox
global chunkSize

global X
global y
treeReady=False

chunkSize=50

modifier='True'
#modifier='price >69' #for testing chunks transiction

queryAtt='id, street, price, latitude, longitude'
queryAtt='*'

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

#------------Listener thread: will listen and execute the methods coming from frontend-------
class FrontEndListener(Thread):
   def __init__(self, name):
      Thread.__init__(self)
      self.name = name
   def run(self):
      while True:
          print ("Thread '" + self.name + "' avviato")
          #time.sleep(self.durata)
          print ("Thread '" + self.name + "' terminato")
#------------Listener thread: will listen and execute the methods coming from frontend-------




def sendChunk(chunk):
    eel.send_data_chunk(chunk)
    #print('----------------------',len(chunk),chunk)



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
        if 0 < distance(userLat,userLon,x[10],x[11])-distance(userLat,userLon,lat,long)<=more:
            minimo=min(minimo,x[16])
            minimoX=(x[0],distance(userLat,userLon,x[10],x[11])-distance(userLat,userLon,lat,long))
    return {"neighborhood_min":minimo,"saving":actualPrice-minimo,"alternativeId":minimoX[0],"extraSteps":minimoX[1]}

def buildQuery(userLat,userLon,userRange,userDay,att,modifier,chunkSize):
    global LIMIT
    SELECT = "SELECT "+att+"  "
    FROM   = "FROM listings "
    WHERE  = "WHERE price >="+str(userRange[0])+" AND price <="+str(userRange[1])+"  AND id NOT IN (SELECT id from plotted ) "
    LIMIT  = "LIMIT 0,50"
    return SELECT+' '+FROM+' '+ WHERE + ' AND '+modifier+' LIMIT 0,'+str(chunkSize)
global x
global qquery

def getPrecision(diz):
    global bBox
    inb=0
    for k in diz:
        if diz[k]['inside']==1:
            inb+=1
    return(inb/len(diz))
            

def feedTuples(query,chunkSize):
    global modifier
    global DIZ_plotted
    global treeReady #it is used to interrupt the main chunking cycle
    global x
    global qquery
    mydb=dbConnect("localhost",'root', USER_PW,'airbnb')
    
    mycursor = mydb.cursor()
    mycursor.execute('DELETE FROM plotted')
    mydb.commit()
    plotted=0
    chunks=0
    mycursor.execute(query)
    myresult = mycursor.fetchall()
    print('Entering LOOP1 - Query:',query,modifier)
    while len(myresult)>0 and not treeReady:
         chunks+=1
         actualChunk={}
         for x in myresult:
           mycursor.execute('INSERT INTO plotted (id) VALUES (' +str(x[0])+')')
           #print('LOOP1-',chunks,x,'distance=',distance(userLat,userLon,x[10],x[11]),'aboveM=',aboveMinimum(x[0],x[16],userLat,userLon,1.5))

           DIZ_plotted[x[0]]={'host_id':x[0], 'zipcode':x[7], 'latitude':x[10],'longitude':x[11],'accommodates':x[12],'bathrooms':x[13],'bedrooms':x[14],'beds':x[15],'price':x[16],'cleaning_fee':x[18],'minimum_nights':x[21],'maximum_nights':x[22],'dist2user':distance(userLat,userLon,x[10],x[11]), 'aboveM':aboveMinimum(x[0],x[16],userLat,userLon,0.5),'chunk':chunks,'inside':0}

           actualChunk[x[0]]={'chunk':chunks,'values':x, 'dist2user':distance(userLat,userLon,x[10],x[11]), 'aboveM':aboveMinimum(x[0],x[16],userLat,userLon,0.5)}

           plotted+=1
           mydb.commit()

           #if chunks==20:
               #treeReady=True  #sumulate decision tree intervention,should be set by the Steering module
           eel.sleep(0.001)
         sendChunk(actualChunk)
         mycursor.execute(query)
         myresult = mycursor.fetchall()
         
    
    

    
    print('plotted',plotted,'tuples in',chunks,'chunks')
    #modifier='True'            #should be set by the Steering module
    qquery=query=buildQuery(userLat,userLon,userRange,userDay,queryAtt,modifier,chunkSize)
    mycursor.execute(query)
    myresult = mycursor.fetchall()
    print('Entering LOOP2 - Query:',query,'Precision:',getPrecision(DIZ_plotted)/chunks)
    while len(myresult)>0 and chunks <50:
         chunks+=1
         actualChunk={}
         #print('Precision:',getPrecision(DIZ_plotted))
         for x in myresult:
           mycursor.execute('INSERT INTO plotted (id) VALUES (' +str(x[0])+')')

           #print('TreeReady',query,chunks,x,'distance=',distance(userLat,userLon,x[10],x[11]),'aboveM=',aboveMinimum(x[0],x[16],userLat,userLon,0.5))
           DIZ_plotted[x[0]]={'host_id':x[0], 'zipcode':x[7], 'latitude':x[10],'longitude':x[11],'accommodates':x[12],'bathrooms':x[13],'bedrooms':x[14],'beds':x[15],'price':x[16],'cleaning_fee':x[18],'minimum_nights':x[21],'maximum_nights':x[22],'dist2user':distance(userLat,userLon,x[10],x[11]), 'aboveM':aboveMinimum(x[0],x[16],userLat,userLon,0.5),'chunk':chunks,'inside':0}

           plotted+=1
           actualChunk[x[0]]={'chunk':chunks,'values':x, 'dist2user':distance(userLat,userLon,x[10],x[11]), 'aboveM':aboveMinimum(x[0],x[16],userLat,userLon,0.5)}
           mydb.commit()
           eel.sleep(0.001)
         sendChunk(actualChunk)
         eel.sleep(0.001)
         inb=0
         for k in DIZ_plotted:
             if DIZ_plotted [k]['inside']==1 and DIZ_plotted [k]['chunk']==chunks:
                 inb+=1     
         
         print('Inside LOOP2 - chunk ',chunks ,' sent. Query: ',query,'Precision:',inb/chunks)
         pres=inb/chunks
         eel.send_evaluation_metric({"name":"precision","value":pres})
        
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
  eel.send_dimension_total_extent({"name": "Saving opportunity", "min": 0, "max": 30})
  eel.send_dimension_total_extent({"name": "Distance", "min": 0, "max": 10})

  #eel.set_min_selection_size({"name": "Saving opportunity", "min": 0, "max": x["moneyRange"][1]-["moneyRange"][0]})

  sql=buildQuery(userLat,userLon,userRange,userDay,queryAtt,modifier,10)
  eel.spawn(feedTuples(sql,10))
  #eel.spawn(my_other_thread())
  #feedTuples(sql,10)
global app
@eel.expose
def send_user_selection(selected_items):
    global DIZ_plotted
    global modifier
    global treeReady
    app=selected_items
    print("new selected items received",app)
    if len(app)==0:
        print('Ignoring empty selection')
        return 0
    #exmaple of selections by user [22979, 219871, 215638, 111155, 278842]
    for k in selected_items:
        #print('k=',k)
        DIZ_plotted[k]['inside']=1
    '''    
    res=obtainTuples(app)
    print("-----------------------------------------RES,APP-----------------------------")
    print(res)
    print(app)
    '''
    if not treeReady:
        modifier=sm.getSteeringCondition(DIZ_plotted)
        if len(modifier)>0:
            treeReady=True
            print('New modifier:',modifier)
        else:
            print('Wrong empty modifier:',modifier)
            modifier='True AND True'
    return len(app)

@eel.expose
def send_selection_bounds(x_bounds, y_bounds):
    global bBox
    print("new selected region received",x_bounds, y_bounds)
    bBox=[x_bounds,y_bounds]
    #for k in DIZ_plotted:
    #    DIZ_plotted[k]['inside']=0
    

@eel.expose
def send_user_params(parameters):
    print("new user parameters received")

def start_eel(develop):
    """Start Eel with either production or development configuration."""
    
    print(develop)

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
    #eel.say_hello_js('Python World!')   # Call a JavaScript function (must be after `eel.init()`)

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
    
    #while True:
    #    print("I'm a main loop")
    #    eel.sleep(1.0) 
def obtainTuples(arrayID):
    result=[]
    for elem in arrayID:
        result.append(DIZ_plotted[elem])
    return result


def my_other_thread():
    while True:
        print("I'm a thread")
        #eel.sleep(1.0)


if __name__ == '__main__':
    import sys
    
    #feThread=FrontEndListener("fethread")
    #feThread.start()
    # Uses the production version in the "build" directory if passed a second argument
    start_eel(develop=len(sys.argv) == 1)
     
    
