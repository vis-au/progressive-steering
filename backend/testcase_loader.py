preset_test_cases={} # preset scenarios of selections in view space (get loaded from testCases.txt)

def get_box_data(test_case, cursor):
    qq = str('SELECT * FROM listings WHERE price>=60 and price<=90 and "Saving opportunity"<='+str(test_case["boxMaxRange"])+
             ' and "Saving opportunity">='+str(test_case["boxMinRange"]) +' and Distance>='+str(test_case["boxMinDistance"])+' and Distance<='+str(test_case["boxMaxDistance"]))
    cursor.execute(qq)
    myresult = cursor.fetchall()
    tuplesF=len(myresult)

    qq = str("SELECT * FROM listings WHERE price>=60 and price<=90 and abovem<="+str(test_case["boxMaxRange"])+
             " and abovem>="+str(test_case["boxMinRange"]) +" and Distance>="+str(test_case["boxMinDistance"])+" and Distance<="+str(test_case["boxMaxDistance"]))
    cursor.execute(qq)
    myresult = cursor.fetchall()
    tuples=len(myresult)
    return tuples, tuplesF


def load_preset_scenarios(cursor):
    global use_floats_for_savings
    global preset_test_cases
    s=eval(open("DB_server_config.txt", encoding="UTF8").read())
    use_floats_for_savings=s["floatSaving"]
    preset_test_cases=eval(open("testCases.txt", encoding="UTF8").read())
    print("Configuration loaded")
    print("floatSaving: ", use_floats_for_savings)
    print("testCases loaded")
    for i in range(len(preset_test_cases)):
        t=get_box_data(preset_test_cases[i], cursor)
        preset_test_cases[i]["tuples"]=t[0]
        preset_test_cases[i]["tuplesF"]=t[1]
        print(i+1, preset_test_cases[i])
    f=open("testCases.txt", "w", encoding="UTF8")
    print(str(preset_test_cases).replace("{", "\n{"), file=f)
    f.close()


def get_test_cases():
    test_cases={}
    for i in range(len(preset_test_cases)):
        test_cases["testcase"+str(i+1)]={
            "name": "case"+str(i+1)+"_"+str(preset_test_cases[i]["boxMinRange"])+"_"+str(preset_test_cases[i]["boxMaxRange"])+"_"+str(preset_test_cases[i]["boxMinDistance"])+"_"+str(preset_test_cases[i]["boxMaxDistance"]),
            "x_bounds":[preset_test_cases[i]["boxMinRange"], preset_test_cases[i]["boxMaxRange"]],
            "y_bounds":[preset_test_cases[i]["boxMinDistance"], preset_test_cases[i]["boxMaxDistance"]]
        }
    return test_cases