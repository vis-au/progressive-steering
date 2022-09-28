# ProSteer

This repository contains the source code of ProSteer, a benchmarking environment for steering-by-example for progressive visual analytics.

ProSteer consists of two components: A [`backend`](./backend/) component that reads data from a file using SQL, and a [`frontend`](./frontend/) component that progressively visualizes this data chunk-by-chunk and that allows to select data of interest using brushing.

## Contents

The ProSteer project is structured in the following way:

```
data/                       datasets used in the use cases
backend/                    the code for the backend component
exploratory-environment/    benchmarking results
frontend/                   the code fo the interactive frontend component
```

## Prerequisites

ProSteer requires a local installation of the latest versions of [Python](https://www.python.org/downloads/), [NodeJS](https://nodejs.org/), and [MySQL Community Server](https://dev.mysql.com/downloads/mysql/5.7.html).
Please find detailed installation instructions on the linked pages for each product.


## Installing

Detailed installation instructions can be found in the respective READMEs for the [frontend](./frontend/) and [backend](./backend/) components.


## Citing ProSteer

```bib
@article{10.1145/3531229,
  title = {Steering-by-example for {P}rogressive {V}isual {A}nalytics},
  author = {Hogr\"{a}fer, Marius and Angelini, Marco and Santucci, Giuseppe and Schulz, Hans-J\"{o}rg},
  volume = {13},
  number = {6},
  issn = {2157-6904},
  doi = {10.1145/3531229},
  journal = {ACM Transactions on Intelligent Systems and Technology},
  year = {2022},
  pages = {96:1--96:26}
}
```
