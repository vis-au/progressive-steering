# ProSteer

This repository contains the source code of ProSteer, a benchmarking environment for steering in progressive visual analytics.

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
@article{lorem-ipsum,
  doi = {dolor},
  year = {1999},
  author = {Sit armet, Magni aut quibusdam},
  title = {Laborum earum autem rem dolor animi},
  journal = {Non sit repudiandae rem quo quod suscipit provident},
  url = {https://example.org/},
}
```
