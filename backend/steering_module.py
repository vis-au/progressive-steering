#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Created on Sun Feb 23 19:18:12 2020

@author: Marco
"""

#example input file



#from sklearn.datasets import load_iris
#from sklearn.model_selection import cross_val_score
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import train_test_split # Import train_test_split function
#from sklearn.tree.export import export_text
import numpy as np
import os
import pandas as pd


#global n_nodes
#global children_left
#global children_right
#global feature
#global threshold


def getSteeringCondition(dataPS):
    
    def find_path(node_numb, path, x):
        path.append(node_numb)
        #print(node_numb,x)
        if node_numb == x:
            return True
        left = False
        right = False
        if (children_left[node_numb] !=-1):
            left = find_path(children_left[node_numb], path, x)
        if (children_right[node_numb] !=-1):
            right = find_path(children_right[node_numb], path, x)
        if left or right :
            return True
        path.remove(node_numb)
        return False
    
    def get_rule(path, column_names):
        mask = ''
        for index, node in enumerate(path):
            #We check if we are not in the leaf
            if index!=len(path)-1:
                # Do we go under or over the threshold ?
                if (children_left[node] == path[index+1]):
                    mask += "(df['{}']<= {}) \t ".format(column_names[feature[node]], threshold[node])
                else:
                    mask += "(df['{}']> {}) \t ".format(column_names[feature[node]], threshold[node])
        # We insert the & at the right places
        mask = mask.replace("\t", "&", mask.count("\t") - 1)
        mask = mask.replace("\t", "")
        return mask

    def extractCondition(rule):
        condition="";
        listconditions=rule.strip( ).split("&");
        i=0
        for s in listconditions:
            #print(s)
            listLabel=s.strip().split("'")
            condition=condition+listLabel[1]+" "+listLabel[2][1:len(listLabel[2])-1]
            if (i!=len(listconditions)-1):
                condition=condition + " AND "
            i=i+1
        return condition
    
    
    array_steering=[]
    for key in dataPS:
        #print(item["values"])
        array_steering.append(dataPS[key])
    
    #for item in array_steering:
    #    print(item)
    #dataPS=[{'chunk': 1, 'inside': 1, 'host_id': 215638, 'zipcode': 75002, 'latitude': 48.86526, 'longitude': 2.34421, 'accommodates': 2, 'bathrooms': 2, 'bedrooms': 1, 'beds': 1, 'price': 70, 'cleaning_fee': 65, 'minimum_nights': 2, 'maximum_nights': 29, 'dist2user': 1.888, 'aboveM': {'neighborhood_min': 48, 'saving': 22, 'alternativeId': 74561, 'extraSteps': 0.219}}, {'chunk': 2, 'inside': 1, 'host_id': 281357, 'zipcode': 75011, 'latitude': 48.8736, 'longitude': 2.37785, 'accommodates': 2, 'bathrooms': 1, 'bedrooms': 1, 'beds': 1, 'price': 70, 'cleaning_fee': '', 'minimum_nights': 7, 'maximum_nights': 1124, 'dist2user': 2.191, 'aboveM': {'neighborhood_min': 48, 'saving': 22, 'alternativeId': 74561, 'extraSteps': 0.219}}]
    #array_steering=dataPS
    
    DATASET_PATH = ''
    data_path = os.path.join(DATASET_PATH, 'pima-indians-diabetes.csv')
    #col_names = ['pregnant', 'glucose', 'bp', 'skin', 'insulin', 'bmi', 'pedigree', 'age', 'label']
    col_names = ['chunk','inside','host_id', 'zipcode', 'latitude', 'longitude', 'accommodates','bathrooms','bedrooms','beds','price','minimum_nights','maximum_nights','dist2user','aboveM']
    #dataset = pd.read_csv(data_path, header=None, names=col_names)
    
    dataset = pd.DataFrame(data=array_steering)
    #print(dataset)
    
    #print(dataset)
    #feature_cols = ['pregnant', 'insulin', 'bmi', 'age','glucose','bp','pedigree']
    #feature_cols = ['host_id', 'zipcode', 'latitude', 'longitude', 'accommodates','bathrooms','bedrooms','beds','price','cleaning_fee','minimum_nights','maximum_nights']
    feature_cols = ['zipcode', 'latitude', 'longitude','price']
    X = dataset[feature_cols] # Features
    for e in X:
        pass
        #print(e)
    y = dataset.inside # Target variable
    #print(y)
    #X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0, random_state=1) # 70% training and 30% test
    X_train=X
    
    clf = DecisionTreeClassifier(criterion="entropy", max_depth=3)
    
    clf=clf.fit(X,y)
    
    
    n_nodes = clf.tree_.node_count
    #print(n_nodes)
    children_left = clf.tree_.children_left
    #print(children_left)
    children_right = clf.tree_.children_right
    feature = clf.tree_.feature
    threshold = clf.tree_.threshold
    
    # Leaves
    leave_id = clf.apply(X_train)
    paths ={}
    for leaf in np.unique(leave_id):
        #print(leaf)
        if (clf.classes_[np.argmax(clf.tree_.value[leaf])]==1):  #filter on the class to look for;better use 0 for NON INCLUSION and 1 for INCLUSION
            path_leaf = []
            find_path(0, path_leaf, leaf)
            paths[leaf] = np.unique(np.sort(path_leaf))
    #print("qui cammini")
    #print(paths)
    rules = {}
    
    final_condition=""
    j=0;
    for key in paths:
        rules[key] = get_rule(paths[key], X.columns)
        #print(get_rule(paths[key], X.columns))
        #begin creation of SQL cadditional condition
        #print(extractCondition(get_rule(paths[key], X.columns)))
        if (j==0):
            final_condition=extractCondition(get_rule(paths[key], X.columns))
        else:
            final_condition=final_condition+" OR "+extractCondition(get_rule(paths[key], X.columns))
        j=j+1
    #print(final_condition)
    return final_condition

    

'''
#data=[{'chunk': 1, 'values': [{"a1":219871, "a2":100, "a3":70, "a4":48.86464, "a5":2.38298, "label":1}], 'dist2user': 1.623, 'aboveM': {'neighborhood_min': 48, 'saving': 22, 'alternativeId': 74561, 'extraSteps': 0.219}}, {'chunk': 1, 'values': [{"a1":215638, "a2":50, "a3":70, "a4":48.86526, "a5":2.34421, "label":0}], 'dist2user': 1.888, 'aboveM': {'neighborhood_min': 48, 'saving': 22, 'alternativeId': 74561, 'extraSteps': 0.219}}]
data=[{'chunk': 22, 'inside': 0, 'host_id': 39651, 'zipcode': 75011, 'latitude': 48.8493, 'longitude': 2.39022, 'accommodates': 2, 'bathrooms': 1, 'bedrooms': 1, 'beds': 1, 'price': 59, 'cleaning_fee': 15, 'minimum_nights': 5, 'maximum_nights': 365, 'dist2user': 1.942, 'aboveM': {'neighborhood_min': 48, 'saving': 11, 'alternativeId': 74561, 'extraSteps': 0.219}}, {'chunk': 22, 'inside': 1, 'host_id': 43355, 'zipcode': 75010, 'latitude': 48.86965, 'longitude': 2.36719, 'accommodates': 2, 'bathrooms': 1, 'bedrooms': 1, 'beds': 1, 'price': 60, 'cleaning_fee': 30, 'minimum_nights': 28, 'maximum_nights': 360, 'dist2user': 1.561, 'aboveM': {'neighborhood_min': 48, 'saving': 12, 'alternativeId': 74561, 'extraSteps': 0.219}},{'chunk': 21, 'inside': 1, 'host_id': 12268, 'zipcode': 75011, 'latitude': 48.8509, 'longitude': 2.38695, 'accommodates': 2, 'bathrooms': 1, 'bedrooms': 1, 'beds': 1, 'price': 60, 'cleaning_fee': 20, 'minimum_nights': 6, 'maximum_nights': 40, 'dist2user': 1.656, 'aboveM': {'neighborhood_min': 48, 'saving': 12, 'alternativeId': 74561, 'extraSteps': 0.219}}]
getSteeringCondition(data)
'''
        
        
    
    
