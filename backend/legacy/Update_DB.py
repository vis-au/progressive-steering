#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Created on Mon Mar 16 17:41:31 2020

@author: beppes
"""

import mysql.connector
import math
import platform
import sys
import steering_module as sm
import eel
import evaluationMetrics as mm


#simple sync with Steering module
global modifier
global queryAtt
global treeReady #it is used to interrupt the main chunking cycle
global bBox

global X
global y
treeReady=False

global floatSaving

modifier='True'
queryAtt='*'

USER_PW = 'password' # configure according to MySQL setup



global userLat
global userLon
userLat=48.85565
userLon=2.365492

global userRange
userRange= [60, 90]

global userDay
userDay= '2020-04-31'
global userMaxDistance
userMaxDistance=10



global plotted
global mydb

DIZ_plotted={}

global x  #debug

global cos
def distance(lat1, long1, lat2, long2, sleep=0.001):
    if lat1==lat2 and long1==long2:
        return 0
    global cos
    #print(lat1,long1,lat2,long2)
    degrees_to_radians = math.pi/180.0
    phi1 = (90.0 - lat1)*degrees_to_radians
    phi2 = (90.0 - lat2)*degrees_to_radians
    theta1 = long1*degrees_to_radians
    theta2 = long2*degrees_to_radians

    cos = (math.sin(phi1)*math.sin(phi2)*math.cos(theta1 - theta2) + math.cos(phi1)*math.cos(phi2))
    arc = math.acos( cos )
    #time.sleep(sleep)
    return int(arc * 6371*1000)/1000


def loadConfig():
    global floatSaving
    global testCases
    s=eval(open("DB_server_config.txt",encoding="UTF8").read())
    floatSaving=s['floatSaving']
    testCases=eval(open("testCases.txt",encoding="UTF8").read()) 
    print("Configuration loaded")
    print('floatSaving:',floatSaving)
    print("testCases loaded")
    for i in range(len(testCases)):
        print(i+1,testCases[i]) 


def dbConnect(h,u,p,d):
    global mydb
    mydb = mysql.connector.connect(
       host=h,
       user=u,
       passwd=p,
       database=d
     )
    return mydb


def aboveMinimum(bbId,actualPrice,lat,long,more,myresult): #,chunkSize)
    '''
    mycursor = mydb.cursor()  
    #qq = "SELECT * FROM listings WHERE price>0 and price <="+str(userRange[1])+" LIMIT 0,100" #not related with chunkSize
    qq = "SELECT id,latitude,longitude,price FROM listings WHERE price>=0 and price <="+str(userRange[1])#+" LIMIT 0,100" #not related with chunkSize
    mycursor.execute(qq)
    myresult = mycursor.fetchall()
    '''
    minimo=actualPrice
    minimoX=(bbId,0)
    vicini=0
    for x in myresult:
        #if 0 < distance(userLat,userLon,x[1],x[2])-distance(userLat,userLon,lat,long)<=more:
        #print(lat,long,x[1],x[2])
        if distance(lat,long,x[1],x[2])<=more and bbId!=x[0]:
            vicini+=1
            #print(x[3])
            if x[3]<minimo:
                minimo=x[3]
                minimoX=(x[0],distance(lat,long,x[1],x[2]))
    delta=2*minimoX[1]/more            
    return {"neighborhood_min":minimo,"saving":(actualPrice-minimo),"savingf":max((actualPrice-minimo)+delta-1,0),"alternativeId":minimoX[0],"extraSteps":minimoX[1],'vicini':vicini}

def enrich_DB(lat=userLat,lon=userLon):
    print('\nUpdating DB ...')
    global x  #debug
    global userRange
    mydb=dbConnect("localhost",'root', USER_PW,'airbnb')
    mycursor = mydb.cursor()

    query="Delete from listings where price=0"
    mycursor.execute(query)
    
    try:
        query="ALTER TABLE listings ADD distance float"   
        mycursor.execute(query)
    except:
        pass
    
    try:
        query="ALTER TABLE listings ADD abovem int"   
        mycursor.execute(query)
    except:
        pass
    
    try:
        query="ALTER TABLE listings ADD abovemF float"   
        mycursor.execute(query)
    except:
        pass
    
    mydb.commit()
    dbCopy={}
    
    
    query="Select id,latitude,longitude,price from listings WHERE price>="+str(userRange[0])+" and price <=" +str(userRange[1]) #LIMIT 0,50"
    mycursor.execute(query)
    myresult = mycursor.fetchall()
    i=0
    xx=[0,0,0]
    for x in myresult:      
        xx[0]=distance(lat,lon,x[1],x[2],0)
        xx[1]=aboveMinimum(x[0],x[3],x[1],x[2],0.3,myresult)['saving']
        xx[2]=aboveMinimum(x[0],x[3],x[1],x[2],0.3,myresult)['savingf']
        dbCopy[x[0]]=xx.copy()
        i+=1
        #print(xx, '|',x[0],x[16],lat,lon)
        if i%1000==0:
            print(i,'out of',len(myresult))#,x[0],x[3],x[1],x[2],xx,aboveMinimum(x[0],x[3],x[1],x[2],0.3,myresult))

    i=0
    for id in dbCopy:    
        query="Update listings set distance="+str(dbCopy[id][0])+", abovem="+str(dbCopy[id][1])+", abovemF="+str(dbCopy[id][2])+" WHERE id="+str(id)
        #print(query)
        mycursor.execute(query)
        i+=1
        if i%1000==0:
            print('*',i,len(myresult))
    mydb.commit()
    mydb.close()
    print('DB updated successfully')





#############################################################################
loadConfig()
enrich_DB()
################################################