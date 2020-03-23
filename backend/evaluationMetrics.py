#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Created on Mon Mar 16 09:58:01 2020

@author: Marco
"""


def getP(diz):
    l=[]
    for k in diz:
        if (diz[k]==1):
           l.append(k)
    return l

def getN(diz):
    l=[]
    for k in diz:
        if (diz[k]==0):
           l.append(k)
    return l

def evaluateCumulatedResults(actualHistDiz,totalDiz):
    #print("evaluation")
    
    HTP_list=[]
    HFP_list=[]
    HTN_list=[]
    HFN_list=[]
    
    P_list=getP(totalDiz)
    N_list=getN(totalDiz)
    P=len(P_list)
    N=len(N_list)
       
    for k in totalDiz:
        if (totalDiz[k]==1):
            if k in actualHistDiz:
                HTP_list.append(k)
            else:
                HFN_list.append(k)
        else:
            if k in actualHistDiz:
                HFP_list.append(k)
            else:
                HTN_list.append(k)
    '''
    print("HISTORICAL TRUE POSITIVE")
    print(len(HTP_list))
    
    print("HISTORICAL FALSE POSITIVE")
    print(len(HFP_list))
    
    print("HISTORICAL TRUE NEGATIVE")
    print(len(HTN_list))
    
    print("HISTORICAL FALSE NEGATIVE")
    print(len(HFN_list))
    
    print("HISTORICAL REAL POSITIVE")
    print(P)
    
    print("HISTORICAL REAL NEGATIVE")
    print(N)
    '''
    
    TP=len(HTP_list)
    TN=len(HTN_list)
    FP=len(HFP_list)
    FN=len(HFN_list)
    
    
    c_precision= TP / (TP+FP)
    c_recall= TP / (TP+FN)
    c_TPR= TP / P
    c_TNR = TN / N
    c_accuracy = (TP + TN)/(TP+FP+FN+TN)
    c_bal_accuracy = (c_TPR + c_TNR) /2
    result={"true_positive":TP,"false_positive":FP,"true_negative":TN,"false_negative":FN,"cumulated_precision":c_precision,"cumulated_recall":c_recall,"cumulated_TPR":c_TPR,"cumulated_TNR":c_TNR,"cumulated_accuracy":c_accuracy,"cumulated_balanced_accuracy":c_bal_accuracy}
    for k in result:
        pass
        #print(k,result[k])
    return result
       


def evaluateChunkResults(actualHistDiz,actualDiz, totalDiz):
    #print("evaluation")
    
    TP_list=[]
    FP_list=[]
    TN_list=[]
    FN_list=[]
    
    P_list=getP(totalDiz)
    N_list=getN(totalDiz)
    P=len(P_list)
    N=len(N_list)
    
    for k in totalDiz:
        if (totalDiz[k]==1):
            if k in actualDiz:
                TP_list.append(k)
            else:
                FN_list.append(k)
        else:
            if k in actualDiz:
                FP_list.append(k)
            else:
                TN_list.append(k)
    '''
    print("TRUE POSITIVE")
    print(len(TP_list))
    
    print("FALSE POSITIVE")
    print(len(FP_list))
    
    print("TRUE NEGATIVE")
    print(len(TN_list))
    
    print("FALSE NEGATIVE")
    print(len(FN_list))
    
    print("REAL POSITIVE")
    print(P)
    
    print("REAL NEGATIVE")
    print(N)
    '''
    
    


'''
diz={'1':1,'2':1,'5':1,'7':1}
totalDiz={'1':1,'2':0,'3':1,'4':1,'5':1,'6':0,'7':1,'8':0,'9':0,'10':1}
P_list=getP(totalDiz)
N_list=getN(totalDiz)
cardinality=len(totalDiz.keys())
evaluateChunkResults(diz,diz,totalDiz)
evaluateCumulatedResults(diz,diz,totalDiz)
'''