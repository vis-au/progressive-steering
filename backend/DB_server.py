import eel
import mysql.connector
import math
import time

eel.init('web')

#simple sync with Steering module
global modifier
global queryAtt
global treeReady
treeReady=False

modifier='True'
modifier='price >69' #for testing chunks transicion

queryAtt='id, street, price, latitude, longitude'

global userLat
global userLon
global userRange
global userDay




global plotted
global mydb

DIZ_plotted={}

# @eel.expose
def send_to_backend_userData(x={'lat':48.85565,'lon':2.365492,'moneyRange':(30,70),'day':"2020-04-31"}): #Place des Vosges, VIS deadline
  global userLat
  global userLon
  global userRange
  global userDay  
  print("received data",x)
  userLat=x['lat']
  userLon=x['lon']
  userRange=x['moneyRange']
  userDay=x['lat']


def sendChunk(chunk):
    #eel.sendData(chunk)
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
    for x in myresult:
        if 0 < distance(userLat,userLon,x[3],x[4])-distance(userLat,userLon,lat,long)<=more:     
            minimo=min(minimo,x[2])
    return actualPrice-minimo

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
    global treeReady
    mydb=dbConnect("localhost",'root','Pk1969beppe','airbnb')
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
           print(chunks,x,'distance=',distance(userLat,userLon,x[3],x[4]),'aboveM=',aboveMinimum(x[0],x[2],userLat,userLon,0.5))
           DIZ_plotted[x[0]]={'chunk':chunks,'values':x, 'dist2user':distance(userLat,userLon,x[3],x[4]), 'aboveM':aboveMinimum(x[0],x[2],userLat,userLon,0.5)}
           actualChunk[x[0]]={'chunk':chunks,'values':x, 'dist2user':distance(userLat,userLon,x[3],x[4]), 'aboveM':aboveMinimum(x[0],x[2],userLat,userLon,0.5)}
           plotted+=1
           mydb.commit()  
           if chunks==2:
               treeReady=True  #sumulate tree  ready,should be set by the Steering module 
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
    
    
send_to_backend_userData() #simulate frontend provided data 

sql=buildQuery(userLat,userLon,userRange,userDay,queryAtt,modifier,10)

feedTuples(sql,10)

