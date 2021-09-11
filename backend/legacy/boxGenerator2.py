


import os
import random as rd
import mysql.connector
USER_PW = 'password' # configure according to MySQL setup

global userRange
userRange= [60, 90]

def dbConnect(h,u,p,d):
    global mydb
    mydb = mysql.connector.connect(
       host=h,
       user=u,
       passwd=p,
       database=d
     )
    return mydb

def boxData(testCase): # Computes thetotal number of tuples in the box using both integer (tuples) and float (tuplesF) X values
    mydb=dbConnect("localhost",'root', USER_PW,'airbnb')
    mycursor = mydb.cursor()
    global userRange
    mycursor = mydb.cursor() 
    qq = str("SELECT * FROM listings WHERE price>="+str(userRange[0])+" and price <=" +str(userRange[1])+" and abovemF<="+str(testCase['boxMaxRange'])+
             " and abovemF>="+str(testCase['boxMinRange']) +" and distance>="+str(testCase['boxMinDistance'])+" and distance<="+str(testCase['boxMaxDistance']))
    mycursor.execute(qq)
    myresult = mycursor.fetchall()
    tuplesF=len(myresult)
    
    qq = str("SELECT * FROM listings WHERE price>="+str(userRange[0])+" and price <=" +str(userRange[1])+" and abovem<="+str(testCase['boxMaxRange'])+
             " and abovem>="+str(testCase['boxMinRange']) +" and distance>="+str(testCase['boxMinDistance'])+" and distance<="+str(testCase['boxMaxDistance']))
    mycursor.execute(qq)
    myresult = mycursor.fetchall()
    tuples=len(myresult)    
    mydb.close()
    return tuples,tuplesF



file=open("autoTestCases.txt","w")
file.write("[\n")
x_limit=[0.0,31.0]
y_limit=[0.0,12.0]

boxnumber=10

diz_cases={}

for i in range(0,boxnumber):

    xpos=rd.uniform(x_limit[0],x_limit[1])
    ypos=rd.uniform(y_limit[0],y_limit[1])

    while True:
        width=0
        while True:
            width=rd.uniform(0.1,x_limit[1])
            if (width <= x_limit[1] - xpos):
                break

        height=0
        while True:
            height=rd.uniform(0.1,y_limit[1])
            if (height <= y_limit[1] - ypos):
                break
        t=boxData(eval("{'boxMinRange':"+str(xpos)+", 'boxMaxRange':"+str(xpos+width)+",'boxMinDistance':"+str(ypos)+", 'boxMaxDistance':"+str(ypos+height)+"}"))
        if t[0]==0 or t[1]==0: #smarter filter needed 
            print("skipping test case :",eval("{'boxMinRange':"+str(xpos)+", 'boxMaxRange':"+str(xpos+width)+",'boxMinDistance':"+str(ypos)+", 'boxMaxDistance':"+str(ypos+height)+"}"),t)
            break
        testcaseID=str(xpos)+str(ypos)+str(width)+str(height)
        if testcaseID not in diz_cases.keys():
            diz_cases[testcaseID]=1
            t=boxData(eval("{'boxMinRange':"+str(xpos)+", 'boxMaxRange':"+str(xpos+width)+",'boxMinDistance':"+str(ypos)+", 'boxMaxDistance':"+str(ypos+height)+"}"))
            file.write("{'boxMinRange':"+str(xpos)+", 'boxMaxRange':"+str(xpos+width)+",'boxMinDistance':"+str(ypos)+", 'boxMaxDistance':"+str(ypos+height)+", 'tuples':"+str(t[0])+", 'tuplesF':"+str(t[1])+"}")                       
            file.write(",\n")
            break 

file.write("]")
file.close()

