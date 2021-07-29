import numpy as np
from sklearn.tree import DecisionTreeClassifier

# global variables used for generating the steering condition
feature = None
threshold = None


def _find_path(tree, node_numb, path, x):
    path.append(node_numb)

    children_left = tree.children_left
    children_right = tree.children_right

    if node_numb == x:
        return True

    left = False
    right = False

    if (children_left[node_numb] != -1):
        left = _find_path(tree, children_left[node_numb], path, x)
    if (children_right[node_numb] != -1):
        right = _find_path(tree, children_right[node_numb], path, x)
    if left or right :
        return True

    path.remove(node_numb)

    return False


def _extract_paths(X, model):
    tree = model.tree_
    paths = {}
    leave_id = model.apply(X)
    for leaf in np.unique(leave_id):
        if model.classes_[np.argmax(model.tree_.value[leaf])] == 1:
            path_leaf = []
            _find_path(tree, 0, path_leaf, leaf)
            paths[leaf] = np.unique(np.sort(path_leaf))

    return paths


def _get_rule(tree, path, column_names):
    children_left = tree.children_left

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


def _extract_conjunction(rule, conjunction):
    condition = ""
    listconditions=rule.strip( ).split("&")
    i=0
    for s in listconditions:
        #print(s)
        listLabel = s.strip().split("'")
        condition = condition+listLabel[1] + " " + listLabel[2][1 : len(listLabel[2]) - 1]

        if (i != len(listconditions) - 1):
            condition = condition + " " + conjunction + " "

        i += 1

    return condition


def _generate_expression(sample, tree, paths, mode):
    rules = {}
    expression = ""
    conjunctor = "AND" if mode == "sql" else "and"
    disjunctor = "OR" if mode == "sql" else "or"

    j = 0
    for key in paths:
        rules[key] = _get_rule(tree, paths[key], sample.columns)
        new_conjunction = _extract_conjunction(rules[key], conjunctor)

        if j == 0:
            expression = "(" + new_conjunction + ")"
        else:
            expression = expression + " " + disjunctor + " (" + new_conjunction + ")"


        j += 1

    return expression


def get_steering_condition(features, labels, mode="pandas"):
    global feature, threshold

    if mode not in ["pandas", "sql"]:
        print("mode must be one of 'pandas' and 'sql'")
        return ""

    classifier = DecisionTreeClassifier(criterion="entropy", max_depth=None)

    print("training tree")
    model = classifier.fit(features, y=labels)
    tree = model.tree_
    feature = tree.feature
    threshold = tree.threshold

    print("extract paths from tree")
    paths = _extract_paths(features, model)

    print("generate conditional expression")
    expression = _generate_expression(features, tree, paths, mode)

    return expression