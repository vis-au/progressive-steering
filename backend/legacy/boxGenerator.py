import os
import random as rd

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

        testcaseID=str(xpos)+str(ypos)+str(width)+str(height)
        if testcaseID not in diz_cases.keys():
            diz_cases[testcaseID]=1
            file.write("{'boxMinRange':"+str(xpos)+", 'boxMaxRange':"+str(xpos+width)+",'boxMinDistance':"+str(ypos)+", 'boxMaxDistance':"+str(ypos+height)+", 'tuples':5972, 'tuplesF':4742},")                       
            file.write("\n")
            break 

file.write("]")
file.close()

